"""
MindLearn API  (v26)
Changes vs your old main.py:
  * PDF index survives a server restart (it is re-loaded from ./chroma_db on demand)
  * Uploading a new PDF REPLACES the old index (before, old PDFs piled up inside the same store)
  * Safe JSON parsing for flashcards/quiz (the old lstrip("```json") could eat real letters)
  * Flashcards come back as {q, a} (what the frontend uses) as well as {term, definition}
  * /chat uses the tutor "personality" + answer language the frontend sends, and returns exact
    sources with 1-based page numbers
  * NEW  POST /chat/stream  -> answer streams in word by word
  * NEW  optional cloud sync (/sync/state) if sync_router.py sits next to this file
  * CORS origins can be set with ALLOWED_ORIGINS="https://yoursite.com,http://localhost:5173"
  * Friendly errors for empty / scanned PDFs and files that are too big
  v26:
  * Chat remembers the conversation (the web app sends the last few turns)
  * Multi-PDF LIBRARY: every upload is kept (max 20 per user); choose which documents are active
      GET /library, PUT /library/active, DELETE /library/{doc_id}
  * OCR for scanned PDFs (optional: pip install pypdfium2 pytesseract  +  brew install tesseract)
  * Quiz can return explanations + topics, and accepts count/topic
  * Daily AI request limit per user (env DAILY_AI_LIMIT, default 200, 0 = unlimited)  GET /usage
"""
from fastapi import FastAPI, UploadFile, File, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional
import os, tempfile, json, re, logging, sqlite3, uuid, time, datetime
from dotenv import load_dotenv
load_dotenv()

from auth import get_current_user, init_db

from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.document_loaders import PyPDFLoader
from langchain_community.vectorstores import Chroma
from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate, PromptTemplate, MessagesPlaceholder
from langchain_core.messages import HumanMessage, AIMessage
from langchain_core.output_parsers import StrOutputParser
from langchain_community.embeddings.fastembed import FastEmbedEmbeddings

log = logging.getLogger("mindlearn")
app = FastAPI(title="MindLearn API")
init_db()

# allow_origins must be a specific list (not "*") because allow_credentials=True.
_origins = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

CHROMA_DIR = "./chroma_db"
MODEL = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")
MAX_FILE_MB = 50
MAX_DOCS = 20
OCR_MAX_PAGES = 60
OCR_LANGS = os.getenv("OCR_LANGS", "eng")          # e.g. "eng+hin" after: brew install tesseract-lang
DAILY_LIMIT = int(os.getenv("DAILY_AI_LIMIT", "200"))
LIB_DB = "library.db"
# Each signed-in user gets their own isolated vector store, keyed by user id.
vector_stores = {}

# optional cloud sync (copy sync_router.py next to this file to enable)
SYNC_ON = False
try:
    from sync_router import build_router
    app.include_router(build_router(get_current_user))
    SYNC_ON = True
except ImportError:
    log.info("sync_router.py not found - cloud sync disabled")

# ---------------- library + usage (small sqlite file next to main.py) ----------------
def _db():
    c = sqlite3.connect(LIB_DB, timeout=10)
    c.execute("create table if not exists docs(id text primary key, user text, name text, chunks int, pages int, ocr int, created real)")
    c.execute("create table if not exists active(user text primary key, ids text)")
    c.execute("create table if not exists usage(user text, day text, n int, primary key(user, day))")
    return c

def lib_list(uid):
    c = _db(); rows = c.execute("select id, name, chunks, pages, ocr, created from docs where user=? order by created desc", (str(uid),)).fetchall(); c.close()
    return [{"id": r[0], "name": r[1], "chunks": r[2], "pages": r[3], "ocr": bool(r[4]), "created": r[5]} for r in rows]

def lib_add(uid, doc_id, name, chunks, pages, ocr):
    c = _db(); c.execute("insert into docs values(?,?,?,?,?,?,?)", (doc_id, str(uid), name, chunks, pages, ocr, time.time())); c.commit(); c.close()

def lib_delete(uid, doc_id):
    c = _db(); c.execute("delete from docs where id=? and user=?", (doc_id, str(uid))); c.commit(); c.close()

def get_active(uid):
    c = _db(); row = c.execute("select ids from active where user=?", (str(uid),)).fetchone(); c.close()
    have = {d["id"] for d in lib_list(uid)}
    ids = [i for i in (json.loads(row[0]) if row else []) if i in have]
    return ids

def set_active(uid, ids):
    c = _db(); c.execute("insert into active(user, ids) values(?,?) on conflict(user) do update set ids=excluded.ids", (str(uid), json.dumps(ids))); c.commit(); c.close()

def usage_today(uid):
    c = _db(); row = c.execute("select n from usage where user=? and day=?", (str(uid), datetime.date.today().isoformat())).fetchone(); c.close()
    return row[0] if row else 0

def ai_guard(user: dict = Depends(get_current_user)):
    """Counts one AI request for this user today; refuses past the daily limit."""
    if DAILY_LIMIT > 0:
        c = _db(); day = datetime.date.today().isoformat()
        c.execute("insert into usage(user, day, n) values(?,?,1) on conflict(user, day) do update set n=n+1", (str(user["id"]), day))
        n = c.execute("select n from usage where user=? and day=?", (str(user["id"]), day)).fetchone()[0]
        c.commit(); c.close()
        if n > DAILY_LIMIT:
            raise HTTPException(status_code=429, detail=f"You've used today's {DAILY_LIMIT} free AI requests. They reset tomorrow.")
    return user

_llm = None
def get_llm():
    global _llm
    if _llm is None:
        _llm = ChatGroq(model=MODEL, temperature=0.3, groq_api_key=os.getenv("GROQ_API_KEY"))
    return _llm

_emb = None
def get_embeddings():
    global _emb
    if _emb is None:
        _emb = FastEmbedEmbeddings(model_name="BAAI/bge-small-en-v1.5")
    return _emb

def _persist_dir(user_id):
    return f"{CHROMA_DIR}/user_{user_id}"

def get_store(user_id):
    """Return the user's vector store, re-loading it from disk after a server restart."""
    store = vector_stores.get(user_id)
    if store is not None:
        return store
    d = _persist_dir(user_id)
    if os.path.isdir(d) and os.listdir(d):
        try:
            store = Chroma(persist_directory=d, embedding_function=get_embeddings())
            if store._collection.count() > 0:
                vector_stores[user_id] = store
                return store
        except Exception as e:  # corrupted index -> treat as "no PDF"
            log.warning("could not reload index for %s: %s", user_id, e)
    return None

def doc_filter(user_id):
    """Chroma filter for the documents the user has switched on. No library rows = old-style index, no filter."""
    if not lib_list(user_id):
        return None
    ids = get_active(user_id)
    if not ids:
        raise HTTPException(status_code=400, detail="No document is selected. Pick one in the document menu.")
    return {"doc_id": ids[0]} if len(ids) == 1 else {"doc_id": {"$in": ids}}

def get_retriever(user_id, k=5):
    store = get_store(user_id)
    if not store:
        raise HTTPException(status_code=400, detail="No PDF uploaded yet")
    kw = {"k": k, "fetch_k": max(12, k * 2)}
    flt = doc_filter(user_id)
    if flt:
        kw["filter"] = flt
    return store.as_retriever(search_type="mmr", search_kwargs=kw)

def ocr_pages(path, idxs):
    """OCR the given 0-based pages. Returns {page_index: text} or None if OCR isn't installed."""
    try:
        import pypdfium2 as pdfium
        import pytesseract
    except ImportError:
        return None
    try:
        pdf = pdfium.PdfDocument(path); out = {}
        for i in idxs[:OCR_MAX_PAGES]:
            img = pdf[i].render(scale=2).to_pil()
            out[i] = pytesseract.image_to_string(img, lang=OCR_LANGS)
        return out
    except Exception as e:                       # tesseract binary missing, language pack missing, ...
        log.warning("OCR failed: %s", e)
        return None

def parse_json_loose(text):
    """Pull the first JSON array/object out of an LLM reply (handles ```json fences and chatter)."""
    t = re.sub(r"```(?:json)?", "", text or "", flags=re.I).strip()
    starts = [i for i in (t.find("["), t.find("{")) if i >= 0]
    if not starts:
        raise ValueError("no json")
    a = min(starts)
    close = "]" if t[a] == "[" else "}"
    b = t.rfind(close)
    if b <= a:
        raise ValueError("no json")
    chunk = t[a:b + 1]
    try:
        return json.loads(chunk)
    except json.JSONDecodeError:
        return json.loads(re.sub(r",\s*([}\]])", r"\1", chunk))

def llm_json(prompt_text, **vars):
    """Run a prompt that must return JSON; retry once, then give a friendly error."""
    chain = PromptTemplate.from_template(prompt_text) | get_llm() | StrOutputParser()
    for _ in range(2):
        try:
            return parse_json_loose(chain.invoke(vars))
        except (ValueError, json.JSONDecodeError):
            continue
    raise HTTPException(status_code=502, detail="The AI returned an unexpected format. Please try again.")

def clean_sources(docs):
    seen, out = set(), []
    for d in docs:
        f = d.metadata.get("source_file", "")
        p = d.metadata.get("page", None)
        try:
            page = int(p) + 1          # PyPDFLoader pages are 0-based
        except (TypeError, ValueError):
            page = None
        key = (f, page)
        if key in seen:
            continue
        seen.add(key)
        out.append({"file": f, "page": page, "snippet": d.page_content[:160].replace("\n", " ")})
    return out

LANG_MAP = {
    "English": "Respond in English.", "Hindi": "हिंदी में जवाब दो।", "Hinglish": "Hinglish mein jawab do.",
    "en": "Respond in English.", "hi": "हिंदी (देवनागरी) में जवाब दो।", "hinglish": "Hinglish mein jawab do.",
}

class ChatRequest(BaseModel):
    question: Optional[str] = None
    message: Optional[str] = None          # the web app sends the text as "message" too
    language: str = "English"
    personality: str = ""
    history: List[dict] = []               # [{"role": "user"|"assistant", "text": "..."}]

    def text(self):
        return (self.question or self.message or "").strip()

class LangRequest(BaseModel):
    language: str = "English"

class QuizRequest(BaseModel):
    language: str = "English"
    difficulty: str = "Mixed"
    count: int = 6
    topic: str = ""

class ActiveRequest(BaseModel):
    doc_ids: List[str]

class EssayRequest(BaseModel):
    topic: str
    essay_type: str = "Argumentative Essay"
    word_count: int = 500
    language: str = "English"

class ELI5Request(BaseModel):
    concept: str = ""
    topic: str = ""                        # the web app sends "topic" / "text"
    text: str = ""
    style: str = "10-year-old kid"
    language: str = "English"

class YoutubeRequest(BaseModel):
    url: str

class DebateRequest(BaseModel):
    topic: str
    side: str = "For"
    history: List[dict] = []
    language: str = "English"

class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str

class LoginRequest(BaseModel):
    email: str
    password: str

@app.get("/")
def root():
    return {"status": "MindLearn API running"}

@app.get("/health")
def health():
    return {"ok": True, "groq_key_set": bool(os.getenv("GROQ_API_KEY")), "sync": SYNC_ON}

def purge_user_data(uid, email=None):
    """Delete everything stored for a user (called after account deletion)."""
    import shutil
    vector_stores.pop(uid, None)
    shutil.rmtree(_persist_dir(uid), ignore_errors=True)
    c = _db()
    try:
        c.execute("delete from docs where user=?", (str(uid),))
        c.execute("delete from active where user=?", (str(uid),))
        c.execute("delete from usage where user=?", (str(uid),))
        c.commit()
    finally:
        c.close()
    try:
        s = sqlite3.connect("sync.db"); s.execute("delete from state where user in (?, ?)", (str(uid), str(email or ""))); s.commit(); s.close()
    except Exception:
        pass

# login, register, forgot/reset password, change password, delete account
if not os.getenv("MINDLEARN_SKIP_AUTH_ROUTER"):
    from auth_router import build_auth_router
    app.include_router(build_auth_router(purge_user_data))

@app.get("/status")
def status(user: dict = Depends(get_current_user)):
    return {"pdf_loaded": get_store(user["id"]) is not None and (not lib_list(user["id"]) or bool(get_active(user["id"])))}

@app.get("/usage")
def usage(user: dict = Depends(get_current_user)):
    return {"used": usage_today(user["id"]), "limit": DAILY_LIMIT}

@app.get("/library")
def library(user: dict = Depends(get_current_user)):
    act = set(get_active(user["id"]))
    return {"docs": [{**d, "active": d["id"] in act} for d in lib_list(user["id"])], "max": MAX_DOCS}

@app.put("/library/active")
def library_active(req: ActiveRequest, user: dict = Depends(get_current_user)):
    have = {d["id"] for d in lib_list(user["id"])}
    ids = [i for i in req.doc_ids if i in have]
    if not ids:
        raise HTTPException(status_code=400, detail="Select at least one document.")
    set_active(user["id"], ids)
    return {"active": ids}

def _delete_chunks(user_id, doc_id):
    store = get_store(user_id)
    if store is not None:
        try: store._collection.delete(where={"doc_id": doc_id})
        except Exception as e: log.warning("could not delete chunks: %s", e)

@app.delete("/library/{doc_id}")
def library_delete(doc_id: str, user: dict = Depends(get_current_user)):
    if doc_id not in {d["id"] for d in lib_list(user["id"])}:
        raise HTTPException(status_code=404, detail="Document not found")
    _delete_chunks(user["id"], doc_id)
    lib_delete(user["id"], doc_id)
    act = [i for i in get_active(user["id"]) if i != doc_id]
    if not act:
        left = lib_list(user["id"])
        act = [left[0]["id"]] if left else []
    set_active(user["id"], act)
    return {"ok": True, "active": act}

@app.post("/upload")
async def upload_pdf(files: List[UploadFile] = File(...), user: dict = Depends(get_current_user)):
    uid = user["id"]
    splitter = RecursiveCharacterTextSplitter(chunk_size=3000, chunk_overlap=100)
    chunks_all = []; names = []; new_docs = []; ocr_total = 0; ocr_missing = False
    existing = {d["name"]: d["id"] for d in lib_list(uid)}
    for file in files:
        fname = file.filename or "document.pdf"
        if not fname.lower().endswith(".pdf"):
            raise HTTPException(status_code=400, detail=f"{fname}: only PDF files are supported.")
        data = await file.read()
        if len(data) > MAX_FILE_MB * 1024 * 1024:
            raise HTTPException(status_code=413, detail=f"{fname} is larger than {MAX_FILE_MB} MB.")
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
            tmp.write(data); path = tmp.name
        try:
            try:
                pages = PyPDFLoader(path).load()
            except Exception:
                raise HTTPException(status_code=400, detail=f"Couldn't read {fname}. Is it a valid PDF?")
            blank = [i for i, d in enumerate(pages) if not (d.page_content or "").strip()]
            ocr_n = 0
            if blank:
                got = ocr_pages(path, blank)
                if got is None:
                    ocr_missing = True
                else:
                    for i, txt in got.items():
                        if txt and txt.strip():
                            pages[i].page_content = txt; ocr_n += 1
        finally:
            os.remove(path)
        doc_id = uuid.uuid4().hex[:12]
        for d in pages:
            d.metadata["source_file"] = fname; d.metadata["doc_id"] = doc_id
        chunks = [c for c in splitter.split_documents(pages) if c.page_content and c.page_content.strip()]
        if not chunks:
            hint = " Install OCR on the server (see README) to read scanned PDFs." if ocr_missing else ""
            raise HTTPException(status_code=400, detail=f"No readable text found in {fname}. It looks like a scanned PDF (images only).{hint}")
        chunks_all.extend(chunks); names.append(fname); ocr_total += ocr_n
        new_docs.append({"id": doc_id, "name": fname, "chunks": len(chunks), "pages": len(pages), "ocr": ocr_n})
    # library size check (re-uploading the same file name replaces it, so it doesn't count)
    replaced = [existing[n] for n in names if n in existing]
    if len(lib_list(uid)) - len(replaced) + len(new_docs) > MAX_DOCS:
        raise HTTPException(status_code=400, detail=f"Your library is full ({MAX_DOCS} documents). Delete one first.")
    for old_id in replaced:
        _delete_chunks(uid, old_id); lib_delete(uid, old_id)
    store = get_store(uid)
    if store is None:
        vector_stores[uid] = Chroma.from_documents(chunks_all, get_embeddings(), persist_directory=_persist_dir(uid))
    else:
        store.add_documents(chunks_all)
    for d in new_docs:
        lib_add(uid, d["id"], d["name"], d["chunks"], d["pages"], d["ocr"])
    set_active(uid, [d["id"] for d in new_docs])      # a fresh upload becomes the active document(s)
    return {"message": "Files processed", "files": names, "chunks": len(chunks_all), "docs": new_docs, "ocr_pages": ocr_total}

def _history_messages(req):
    msgs = []
    for m in (req.history or [])[-8:]:
        t = str(m.get("text") or m.get("content") or "")[:1500]
        if not t: continue
        msgs.append(AIMessage(content=t) if m.get("role") in ("assistant", "ai") else HumanMessage(content=t))
    return msgs

def _chat_parts(req: ChatRequest, user):
    q = req.text()
    if not q:
        raise HTTPException(status_code=400, detail="Empty question")
    hist = _history_messages(req)
    # short follow-ups ("explain more", "why?") retrieve better when combined with the previous question
    search_q = q
    if hist and len(q.split()) < 7:
        prev = [m.content for m in hist if isinstance(m, HumanMessage)]
        if prev: search_q = prev[-1][:300] + " " + q
    if get_store(user["id"]):
        docs = get_retriever(user["id"], k=5).invoke(search_q)
        context = "\n\n".join(d.page_content for d in docs)
        rule = "Answer ONLY from the context below. If the answer is not in it, say so briefly."
    else:
        docs = []
        context = "(No PDF uploaded.)"
        rule = "No PDF is uploaded, so answer from general knowledge and mention that."
    lang = LANG_MAP.get(req.language, "")
    persona = ("\nTutor style: " + req.personality.replace("{", "{{").replace("}", "}}")) if req.personality else ""
    system = f"You are an expert AI Study Assistant. Use the earlier messages of this conversation to understand follow-up questions.\n{rule} {lang}{persona}\n\nContext:\n{{context}}"
    prompt = ChatPromptTemplate.from_messages([("system", system), MessagesPlaceholder("history"), ("human", "{input}")])
    return prompt, {"input": q, "context": context, "history": hist}, docs

@app.post("/chat")
def chat(req: ChatRequest, user: dict = Depends(ai_guard)):
    prompt, vars, docs = _chat_parts(req, user)
    answer = (prompt | get_llm() | StrOutputParser()).invoke(vars)
    return {"answer": answer, "sources": clean_sources(docs)}

@app.post("/chat/stream")
def chat_stream(req: ChatRequest, user: dict = Depends(ai_guard)):
    """Server-sent events: {"t":"delta","v":"..."} ... then {"t":"done","sources":[...]}"""
    prompt, vars, docs = _chat_parts(req, user)
    chain = prompt | get_llm() | StrOutputParser()
    def gen():
        try:
            for chunk in chain.stream(vars):
                if chunk:
                    yield "data: " + json.dumps({"t": "delta", "v": chunk}) + "\n\n"
            yield "data: " + json.dumps({"t": "done", "sources": clean_sources(docs)}) + "\n\n"
        except Exception:
            log.exception("stream failed")
            yield "data: " + json.dumps({"t": "error", "v": "The AI service had a problem. Please try again."}) + "\n\n"
    return StreamingResponse(gen(), media_type="text/event-stream", headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})

@app.post("/notes")
def notes(req: LangRequest, user: dict = Depends(ai_guard)):
    docs = get_retriever(user["id"], k=8).invoke("main topics key concepts summary")
    context = "\n\n".join(d.page_content for d in docs)
    result = (PromptTemplate.from_template("Create structured study notes.\nFORMAT: # Title ## Key Concepts ## Definitions ## Important Points ## Summary\nLanguage: {lang}\nContent: {context}") | get_llm() | StrOutputParser()).invoke({"context": context, "lang": req.language})
    return {"notes": result, "sources": clean_sources(docs)}

@app.post("/flashcards")
def flashcards(req: LangRequest, user: dict = Depends(ai_guard)):
    docs = get_retriever(user["id"], k=6).invoke("key terms definitions")
    context = "\n\n".join(d.page_content for d in docs)
    raw = llm_json('Create 8 flashcards. Return ONLY JSON:\n[{{"term":"T","definition":"D"}}]\nLanguage:{lang}\nContent:{context}', context=context, lang=req.language)
    if isinstance(raw, dict):
        raw = raw.get("flashcards") or raw.get("cards") or []
    cards = []
    for c in raw if isinstance(raw, list) else []:
        if not isinstance(c, dict): continue
        q = c.get("term") or c.get("q") or c.get("question") or c.get("front") or ""
        a = c.get("definition") or c.get("a") or c.get("answer") or c.get("back") or ""
        if q:
            cards.append({"q": str(q), "a": str(a), "term": str(q), "definition": str(a)})
    if not cards:
        raise HTTPException(status_code=502, detail="Couldn't build flashcards from this document. Please try again.")
    return {"flashcards": cards}

@app.post("/quiz")
def quiz(req: QuizRequest, user: dict = Depends(ai_guard)):
    n = max(3, min(15, req.count or 6))
    docs = get_retriever(user["id"], k=6).invoke(req.topic.strip() or "facts definitions important points")
    context = "\n\n".join(d.page_content for d in docs)
    focus = f'Focus on the topic: "{req.topic.strip()}".' if req.topic.strip() else ""
    raw = llm_json('Create {n} MCQ. Difficulty:{difficulty}. {focus}\nReturn ONLY JSON:\n[{{"question":"Q?","options":["A) o1","B) o2","C) o3","D) o4"],"answer":"A) o1","explanation":"one sentence why","topic":"2-3 word topic"}}]\nLanguage:{lang}\nContent:{context}', context=context, lang=req.language, difficulty=req.difficulty, n=n, focus=focus)
    if isinstance(raw, dict):
        raw = raw.get("questions") or raw.get("quiz") or []
    qs = [q for q in raw if isinstance(q, dict) and q.get("question") and q.get("options")] if isinstance(raw, list) else []
    if not qs:
        raise HTTPException(status_code=502, detail="Couldn't build a quiz from this document. Please try again.")
    return {"questions": qs}

@app.post("/essay")
def essay(req: EssayRequest, user: dict = Depends(ai_guard)):
    result = (PromptTemplate.from_template('Write a {essay_type} on "{topic}" (~{word_count} words).\nInclude: Introduction, Body, Conclusion.\nLanguage:{lang}') | get_llm() | StrOutputParser()).invoke({"topic": req.topic, "essay_type": req.essay_type, "word_count": req.word_count, "lang": req.language})
    return {"essay": result}

@app.post("/eli5")
def eli5(req: ELI5Request, user: dict = Depends(ai_guard)):
    concept = (req.concept or req.topic or req.text).strip()
    if not concept:
        raise HTTPException(status_code=400, detail="Tell me what to explain.")
    result = (PromptTemplate.from_template('Explain "{concept}" simply for a {style}.\nUse simple words, fun analogies, emojis. 3-4 short paragraphs.\nLanguage:{lang}') | get_llm() | StrOutputParser()).invoke({"concept": concept, "style": req.style, "lang": req.language})
    return {"explanation": result}

@app.post("/youtube")
def youtube(req: YoutubeRequest, user: dict = Depends(ai_guard)):
    from youtube_transcript_api import YouTubeTranscriptApi
    m = re.search(r'v=([a-zA-Z0-9_-]{11})|youtu\.be/([a-zA-Z0-9_-]{11})', req.url)
    if not m: raise HTTPException(400, "Invalid URL")
    vid_id = m.group(1) or m.group(2)
    try:
        t = YouTubeTranscriptApi().fetch(vid_id)
        text = " ".join([x.text for x in t])[:8000]
    except Exception as e:
        raise HTTPException(400, str(e))
    result = (PromptTemplate.from_template('Create study notes from transcript.\n# Summary\n## Key Topics\n## Important Points\n## Takeaways\n\nTranscript:{text}') | get_llm() | StrOutputParser()).invoke({"text": text})
    return {"notes": result, "video_id": vid_id}

@app.post("/debate")
def debate(req: DebateRequest, user: dict = Depends(ai_guard)):
    if not req.topic.strip():
        raise HTTPException(status_code=400, detail="Give me a topic to debate.")
    if not req.history:
        # first turn: show both sides (what the "Generate Both Sides" button promises)
        both = (PromptTemplate.from_template('Debate the claim: "{topic}".\nWrite two short sections:\n## For\n(3 strongest arguments)\n## Against\n(3 strongest arguments)\n## Verdict\n(one balanced sentence)\nLanguage:{lang}') | get_llm() | StrOutputParser()).invoke({"topic": req.topic, "lang": req.language})
        return {"response": both, "ai_side": "Both"}
    ai_side = "Against" if req.side == "For" else "For"
    history = "\n".join([f"{m['role']}: {m['text']}" for m in req.history[-4:]])
    result = (PromptTemplate.from_template('Debate {side} on "{topic}".\nHistory:\n{history}\nGive strong counter-argument in 2-3 sentences.\nLanguage:{lang}') | get_llm() | StrOutputParser()).invoke({"side": ai_side, "topic": req.topic, "history": history, "lang": req.language})
    return {"response": result, "ai_side": ai_side}

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
import os, tempfile, json, re, logging, uuid, time, datetime, array, threading
from dotenv import load_dotenv
load_dotenv()

import db
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
db.init_schema()

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
MODEL = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")   # llama-3.3-70b-versatile was retired by Groq
MAX_FILE_MB = 50
MAX_DOCS = 20
OCR_MAX_PAGES = 60
OCR_LANGS = os.getenv("OCR_LANGS", "eng")          # e.g. "eng+hin" after: brew install tesseract-lang
DAILY_LIMIT = int(os.getenv("DAILY_AI_LIMIT", "200"))
LIB_DB = "library.db"
# Each signed-in user gets their own isolated vector store, keyed by user id.
vector_stores = {}
_rebuild_lock = threading.Lock()

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
    return db.connect("main")

def lib_list(uid):
    c = _db(); rows = c.execute('select id, name, chunks, pages, ocr, created from docs where "user"=? order by created desc', (str(uid),)).fetchall(); c.close()
    return [{"id": r[0], "name": r[1], "chunks": r[2], "pages": r[3], "ocr": bool(r[4]), "created": r[5]} for r in rows]

def lib_add(uid, doc_id, name, chunks, pages, ocr):
    c = _db(); c.execute("insert into docs values(?,?,?,?,?,?,?)", (doc_id, str(uid), name, chunks, pages, ocr, time.time())); c.commit(); c.close()

def lib_delete(uid, doc_id):
    c = _db(); c.execute("delete from docs where id=? and \"user\"=?", (doc_id, str(uid))); c.commit(); c.close()

def get_active(uid):
    c = _db(); row = c.execute('select ids from active where "user"=?', (str(uid),)).fetchone(); c.close()
    have = {d["id"] for d in lib_list(uid)}
    ids = [i for i in (json.loads(row[0]) if row else []) if i in have]
    return ids

def set_active(uid, ids):
    c = _db(); c.execute('insert into active("user", ids) values(?,?) on conflict("user") do update set ids=excluded.ids', (str(uid), json.dumps(ids))); c.commit(); c.close()

def usage_today(uid):
    c = _db(); row = c.execute('select n from usage where "user"=? and day=?', (str(uid), datetime.date.today().isoformat())).fetchone(); c.close()
    return row[0] if row else 0

def ai_guard(user: dict = Depends(get_current_user)):
    """Counts one AI request for this user today; refuses past the daily limit."""
    if DAILY_LIMIT > 0:
        c = _db(); day = datetime.date.today().isoformat()
        c.execute('insert into usage("user", day, n) values(?,?,1) on conflict("user", day) do update set n=usage.n+1', (str(user["id"]), day))
        n = c.execute('select n from usage where "user"=? and day=?', (str(user["id"]), day)).fetchone()[0]
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
        except Exception as e:  # corrupted index -> rebuild from the database copy below
            log.warning("could not reload index for %s: %s", user_id, e)
    try:
        with _rebuild_lock:
            store = vector_stores.get(user_id) or _rebuild_store(user_id)
        if store is not None and store._collection.count() > 0:
            vector_stores[user_id] = store
            return store
    except Exception as e:
        log.warning("could not rebuild index for %s: %s", user_id, e)
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
    return {"ok": True, "groq_key_set": bool(os.getenv("GROQ_API_KEY")), "sync": SYNC_ON, "db": "postgres" if db.IS_PG else "sqlite"}

def purge_user_data(uid, email=None):
    """Delete everything stored for a user (called after account deletion)."""
    import shutil
    vector_stores.pop(uid, None)
    shutil.rmtree(_persist_dir(uid), ignore_errors=True)
    c = _db()
    try:
        for t in ("docs", "active", "usage", "chunks", "feedback", "errors", "uploads", "shares"):
            c.execute(f'delete from {t} where "user"=?', (str(uid),))
        c.commit()
    finally:
        c.close()
    try:
        s = db.connect("sync"); s.execute('delete from state where "user" in (?, ?)', (str(uid), str(email or ""))); s.commit(); s.close()
    except Exception:
        log.warning("could not purge sync state", exc_info=True)

from extras_router import build_extras_router
app.include_router(build_extras_router(get_current_user))

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
    try:
        c = _db(); c.execute("delete from chunks where doc_id=? and \"user\"=?", (doc_id, str(user_id))); c.commit(); c.close()
    except Exception as e: log.warning("could not delete saved chunks: %s", e)

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

MAX_PAGES = int(os.getenv("MAX_PDF_PAGES", "500"))
EMBED_BATCH = 32

def _pack(vec): return array.array("f", vec).tobytes()
def _unpack(b):
    a = array.array("f"); a.frombytes(bytes(b)); return list(a)

def _chunk_id(doc_id, i): return f"{doc_id}_{i}"

def _open_store(uid):
    return Chroma(persist_directory=_persist_dir(uid), embedding_function=get_embeddings())

def _add_chunks(uid, doc_id, chunks, vecs):
    """Add already-embedded chunks to the vector store AND keep a copy in the database
    (so the index can be rebuilt after the server's disk is wiped)."""
    store = vector_stores.get(uid) or get_store(uid) or _open_store(uid)
    store._collection.add(
        ids=[_chunk_id(doc_id, i) for i in range(len(chunks))],
        embeddings=vecs,
        documents=[c.page_content for c in chunks],
        metadatas=[{k: v for k, v in c.metadata.items() if isinstance(v, (str, int, float, bool))} for c in chunks],
    )
    vector_stores[uid] = store
    c = _db()
    try:
        for i, (ch, v) in enumerate(zip(chunks, vecs)):
            meta = {k: v2 for k, v2 in ch.metadata.items() if isinstance(v2, (str, int, float, bool))}
            c.execute("insert into chunks(doc_id, \"user\", idx, content, meta, emb) values(?,?,?,?,?,?)",
                      (doc_id, str(uid), i, ch.page_content, json.dumps(meta), _pack(v)))
        c.commit()
    finally:
        c.close()

def _rebuild_store(uid):
    """Re-create the vector index from the chunks saved in the database. No re-embedding needed."""
    c = _db()
    try:
        rows = c.execute('select doc_id, idx, content, meta, emb from chunks where "user"=? order by doc_id, idx', (str(uid),)).fetchall()
    finally:
        c.close()
    if not rows:
        return None
    store = _open_store(uid)
    for i in range(0, len(rows), 200):
        part = rows[i:i + 200]
        store._collection.add(ids=[_chunk_id(r[0], r[1]) for r in part], embeddings=[_unpack(r[4]) for r in part],
                              documents=[r[2] for r in part], metadatas=[json.loads(r[3]) for r in part])
    log.info("rebuilt index for user %s from %d saved chunks", uid, len(rows))
    return store

def _process_upload(uid, items, progress=lambda pct, msg: None):
    """items = [(filename, bytes)]. Parses, (OCRs), splits, embeds and stores. Raises HTTPException with a friendly message."""
    splitter = RecursiveCharacterTextSplitter(chunk_size=3000, chunk_overlap=100)
    prepared = []; ocr_total = 0; ocr_missing = False
    existing = {d["name"]: d["id"] for d in lib_list(uid)}
    n = max(len(items), 1)
    for fi, (fname, data) in enumerate(items):
        base = fi * 100 / n; span = 100 / n
        if not fname.lower().endswith(".pdf"):
            raise HTTPException(status_code=400, detail=f"{fname}: only PDF files are supported.")
        if len(data) > MAX_FILE_MB * 1024 * 1024:
            raise HTTPException(status_code=413, detail=f"{fname} is larger than {MAX_FILE_MB} MB.")
        progress(base + span * 0.03, f"Reading {fname}")
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
            tmp.write(data); path = tmp.name
        try:
            try:
                pages = PyPDFLoader(path).load()
            except Exception:
                raise HTTPException(status_code=400, detail=f"Couldn't read {fname}. Is it a valid PDF?")
            if len(pages) > MAX_PAGES:
                raise HTTPException(status_code=400, detail=f"{fname} has {len(pages)} pages; the limit is {MAX_PAGES}. Split it into smaller PDFs.")
            blank = [i for i, d in enumerate(pages) if not (d.page_content or "").strip()]
            ocr_n = 0
            if blank:
                progress(base + span * 0.15, f"Reading scanned pages of {fname}")
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
        prepared.append({"fname": fname, "doc_id": doc_id, "chunks": chunks, "pages": len(pages), "ocr": ocr_n, "base": base, "span": span})
        ocr_total += ocr_n
    # library size check (re-uploading the same file name replaces it, so it doesn't count)
    names = [p["fname"] for p in prepared]
    replaced = [existing[x] for x in names if x in existing]
    if len(lib_list(uid)) - len(replaced) + len(prepared) > MAX_DOCS:
        raise HTTPException(status_code=400, detail=f"Your library is full ({MAX_DOCS} documents). Delete one first.")
    for old_id in replaced:
        _delete_chunks(uid, old_id); lib_delete(uid, old_id)
    emb = get_embeddings(); new_docs = []; total = 0
    for p in prepared:
        chunks = p["chunks"]; vecs = []
        for i in range(0, len(chunks), EMBED_BATCH):
            vecs.extend(emb.embed_documents([c.page_content for c in chunks[i:i + EMBED_BATCH]]))
            progress(p["base"] + p["span"] * (0.25 + 0.65 * len(vecs) / len(chunks)), f"Understanding {p['fname']} ({len(vecs)}/{len(chunks)})")
        progress(p["base"] + p["span"] * 0.93, "Saving")
        _add_chunks(uid, p["doc_id"], chunks, vecs)
        lib_add(uid, p["doc_id"], p["fname"], len(chunks), p["pages"], p["ocr"])
        new_docs.append({"id": p["doc_id"], "name": p["fname"], "chunks": len(chunks), "pages": p["pages"], "ocr": p["ocr"]})
        total += len(chunks)
    set_active(uid, [d["id"] for d in new_docs])      # a fresh upload becomes the active document(s)
    progress(100, "Done")
    return {"message": "Files processed", "files": names, "chunks": total, "docs": new_docs, "ocr_pages": ocr_total}

def _log_upload(uid, name, pages, chunks, ok, seconds, error=""):
    try:
        c = _db()
        c.execute('insert into uploads("user", name, pages, chunks, ok, seconds, error, created) values(?,?,?,?,?,?,?,?)',
                  (str(uid), name[:200], pages, chunks, 1 if ok else 0, seconds, error[:300], time.time()))
        c.commit(); c.close()
    except Exception:
        log.warning("could not log upload", exc_info=True)

async def _read_files(files):
    out = []
    for f in files:
        out.append((f.filename or "document.pdf", await f.read()))
    return out

def _run_logged(uid, items, progress=lambda p, m: None):
    t0 = time.time(); label = ", ".join(n for n, _ in items)
    try:
        res = _process_upload(uid, items, progress)
        _log_upload(uid, label, sum(d["pages"] for d in res["docs"]), res["chunks"], True, time.time() - t0)
        return res
    except HTTPException as e:
        _log_upload(uid, label, 0, 0, False, time.time() - t0, str(e.detail)); raise
    except Exception as e:
        _log_upload(uid, label, 0, 0, False, time.time() - t0, repr(e)); raise

@app.post("/upload")
async def upload_pdf(files: List[UploadFile] = File(...), user: dict = Depends(get_current_user)):
    """Synchronous upload (used by tests / old clients). The web app uses /upload/async."""
    items = await _read_files(files)
    return _run_logged(user["id"], items)

JOBS = {}          # job_id -> dict(user, pct, msg, done, error, result, t)
_jobs_lock = threading.Lock()

def _gc_jobs():
    cut = time.time() - 3600
    for k in [k for k, v in JOBS.items() if v["t"] < cut]:
        JOBS.pop(k, None)

def _start_job(uid, fn, busy_msg):
    """Run fn(progress) in a background thread; the web app polls GET /jobs/{id}."""
    with _jobs_lock:
        _gc_jobs()
        if any(j["user"] == uid and not j["done"] for j in JOBS.values()):
            raise HTTPException(status_code=409, detail=busy_msg)
        jid = uuid.uuid4().hex
        JOBS[jid] = {"user": uid, "pct": 1, "msg": "Starting", "done": False, "error": None, "result": None, "t": time.time()}
    def progress(p, m):
        JOBS[jid].update(pct=int(min(99, p)), msg=m, t=time.time())
    def run():
        try:
            JOBS[jid]["result"] = fn(progress)
            JOBS[jid].update(pct=100, msg="Done")
        except HTTPException as e:
            JOBS[jid]["error"] = str(e.detail)
        except Exception:
            log.exception("background job failed")
            JOBS[jid]["error"] = "Something went wrong. Please try again (or with a smaller file)."
        finally:
            JOBS[jid]["done"] = True; JOBS[jid]["t"] = time.time()
    threading.Thread(target=run, daemon=True).start()
    return jid

@app.post("/upload/async")
async def upload_async(files: List[UploadFile] = File(...), user: dict = Depends(get_current_user)):
    """Returns at once with a job id; poll GET /upload/job/{id} for progress."""
    items = await _read_files(files)
    uid = user["id"]
    jid = _start_job(uid, lambda progress: _run_logged(uid, items, progress), "An upload is still being processed. Please wait for it to finish.")
    return {"job_id": jid}

@app.get("/jobs/{job_id}")
@app.get("/upload/job/{job_id}")
def upload_job(job_id: str, user: dict = Depends(get_current_user)):
    j = JOBS.get(job_id)
    if not j or j["user"] != user["id"]:
        raise HTTPException(status_code=404, detail="Job not found (the server may have restarted). Please try again.")
    return {"pct": j["pct"], "msg": j["msg"], "done": j["done"], "error": j["error"], "result": j["result"]}

# ---------------- PYQ / past-paper mode ----------------
PYQ_MAX_PAGES = int(os.getenv("PYQ_MAX_PAGES", "12"))     # pages read per extraction (keeps it fast on the free server)
PYQ_MAX_Q = 40

class PyqExtractRequest(BaseModel):
    doc_id: Optional[str] = None
    page_from: int = 1
    page_to: int = 0            # 0 = up to PYQ_MAX_PAGES pages from page_from
    exam: str = "general"

class PyqSolveRequest(BaseModel):
    question: str
    options: List[str] = []
    user_answer: str = ""
    official_answer: str = ""
    exam: str = "general"
    language: str = "English"

def _doc_pages(uid, doc_id):
    """{page_number(1-based): text} for one document, from the saved chunks (falls back to the vector index)."""
    pages = {}
    def add(content, meta):
        try: p = int(meta.get("page")) + 1
        except (TypeError, ValueError): return
        pages[p] = (pages.get(p, "") + "\n" + (content or "")).strip()
    c = _db()
    try:
        for r in c.execute('select content, meta from chunks where doc_id=? and "user"=? order by idx', (doc_id, str(uid))).fetchall():
            add(r[0], json.loads(r[1] or "{}"))
    finally:
        c.close()
    if not pages:
        store = get_store(uid)
        if store is not None:
            try:
                got = store._collection.get(where={"doc_id": doc_id}, include=["documents", "metadatas"])
                for t, m in zip(got.get("documents") or [], got.get("metadatas") or []):
                    add(t, m or {})
            except Exception as e:
                log.warning("pyq: could not read pages: %s", e)
    return pages

def _pyq_windows(pages, lo, hi, max_chars=6500):
    out, cur, size = [], [], 0
    for p in sorted(k for k in pages if lo <= k <= hi):
        txt = f"[Page {p}]\n{pages[p]}"
        if cur and size + len(txt) > max_chars:
            out.append("\n\n".join(cur)); cur, size = [], 0
        cur.append(txt[:max_chars]); size += len(txt)
    if cur: out.append("\n\n".join(cur))
    return out

PYQ_PROMPT = (
    "You are extracting multiple-choice questions from the text of a past exam paper ({exam}).\n"
    "Extract every COMPLETE multiple-choice question that appears below, exactly as printed. Do not invent, rewrite or solve anything. "
    "Skip instructions, headers, page numbers, and questions whose text or options are cut off or have fewer than 2 options. "
    "If the paper itself prints the correct answer for a question right there, copy it into \"answer\" exactly as one of the options; otherwise use null.\n"
    'Return ONLY JSON: {{"questions":[{{"number":"12","question":"...","options":["A) ...","B) ...","C) ...","D) ..."],"answer":null,"topic":"2-3 word topic","page":3}}]}}\n'
    "Text (pages are marked like [Page 3]):\n{context}"
)

def _clean_pyq(raw, seen):
    if isinstance(raw, dict):
        raw = raw.get("questions") or []
    out = []
    for q in raw if isinstance(raw, list) else []:
        if not isinstance(q, dict): continue
        text = str(q.get("question") or "").strip()
        opts = [str(o).strip() for o in (q.get("options") or []) if str(o).strip()]
        if len(text) < 8 or not (2 <= len(opts) <= 6): continue
        key = re.sub(r"\W+", " ", text.lower())[:120]
        if key in seen: continue
        seen.add(key)
        ans = q.get("answer"); ans = str(ans).strip() if ans else None
        if ans and ans not in opts:
            m = next((o for o in opts if o[:1].upper() == ans[:1].upper() and len(ans) <= 3), None)
            ans = m
        try: page = int(q.get("page"))
        except (TypeError, ValueError): page = None
        out.append({"number": str(q.get("number") or ""), "question": text[:1200], "options": [o[:400] for o in opts], "answer": ans,
                    "topic": str(q.get("topic") or "General").strip()[:40] or "General", "page": page})
    return out

def _pyq_extract(uid, req, progress):
    docs = lib_list(uid)
    ids = {d["id"] for d in docs}
    doc_id = req.doc_id if req.doc_id in ids else (get_active(uid) or [None])[0]
    if not doc_id:
        raise HTTPException(status_code=400, detail="Upload a past-paper PDF first.")
    name = next((d["name"] for d in docs if d["id"] == doc_id), "paper")
    progress(3, "Reading the paper")
    pages = _doc_pages(uid, doc_id)
    if not pages:
        raise HTTPException(status_code=400, detail="This document has no saved text. Please upload it again.")
    lo = max(1, req.page_from); hi = req.page_to if req.page_to >= lo else lo + PYQ_MAX_PAGES - 1
    hi = min(hi, lo + PYQ_MAX_PAGES - 1)
    wins = _pyq_windows(pages, lo, hi)
    if not wins:
        raise HTTPException(status_code=400, detail=f"No text on pages {lo}-{hi}. This PDF has {max(pages)} pages.")
    seen, found = set(), []
    for i, w in enumerate(wins):
        progress(8 + 88 * i / len(wins), f"Finding questions ({i + 1}/{len(wins)})")
        try:
            raw = llm_json(PYQ_PROMPT, exam=req.exam or "general", context=w)
        except HTTPException:
            continue
        found.extend(_clean_pyq(raw, seen))
        if len(found) >= PYQ_MAX_Q: break
    if not found:
        raise HTTPException(status_code=422, detail=f"Couldn't find multiple-choice questions on pages {lo}-{hi}. Try other pages, or check that the PDF is a question paper (not just a key).")
    for i, q in enumerate(found[:PYQ_MAX_Q]): q["id"] = f"{doc_id}-{lo}-{i}"
    return {"doc_id": doc_id, "name": name, "page_from": lo, "page_to": hi, "total_pages": max(pages), "questions": found[:PYQ_MAX_Q]}

@app.post("/pyq/extract")
def pyq_extract(req: PyqExtractRequest, user: dict = Depends(ai_guard)):
    uid = user["id"]
    jid = _start_job(uid, lambda progress: _pyq_extract(uid, req, progress), "Another task is still running. Please wait for it to finish.")
    return {"job_id": jid}

@app.post("/pyq/solve")
def pyq_solve(req: PyqSolveRequest, user: dict = Depends(ai_guard)):
    q = (req.question or "").strip()
    if len(q) < 5:
        raise HTTPException(status_code=400, detail="Question is empty.")
    opts = "\n".join(req.options or [])
    known = f'The paper\'s official answer is: {req.official_answer}. Trust it and explain why.' if req.official_answer else "No official answer is available: solve it yourself carefully and say how sure you are."
    mine = f'The student chose: {req.user_answer}.' if req.user_answer else "The student has not chosen an answer."
    raw = llm_json(
        'You are a patient {exam} tutor. Solve this exam question step by step for a student.\n'
        'Question: {q}\nOptions:\n{opts}\n{known}\n{mine}\n'
        'Return ONLY JSON: {{"correct_option":"exactly one of the options","steps":["step 1","step 2"],"concept":"the idea being tested, one sentence",'
        '"shortcut":"a quick exam trick or empty string","why_wrong":"if the student chose a wrong option, why it is wrong, else empty string",'
        '"topic":"2-3 word topic","confidence":"high|medium|low"}}\nLanguage: {lang}. Keep each step short.',
        exam=req.exam or "exam", q=q, opts=opts, known=known, mine=mine, lang=req.language)
    if not isinstance(raw, dict) or not raw.get("steps"):
        raise HTTPException(status_code=502, detail="Couldn't solve this one. Please try again.")
    raw["steps"] = [str(x) for x in raw["steps"]][:12]
    if req.official_answer:
        raw["correct_option"] = req.official_answer
        raw["confidence"] = "high"
    return raw

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

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
import os, tempfile, json
from dotenv import load_dotenv
load_dotenv()

from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.document_loaders import PyPDFLoader
from langchain_community.vectorstores import Chroma
from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate, PromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_community.embeddings.fastembed import FastEmbedEmbeddings

app = FastAPI(title="MindLearn API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

CHROMA_DIR = "./chroma_db"
MODEL = "llama-3.3-70b-versatile"
vector_store = None

def get_llm():
    return ChatGroq(model=MODEL, temperature=0.3, groq_api_key=os.getenv("GROQ_API_KEY"))

def get_embeddings():
    return FastEmbedEmbeddings(model_name="BAAI/bge-small-en-v1.5")

def get_retriever(k=5):
    if not vector_store:
        raise HTTPException(status_code=400, detail="No PDF uploaded yet")
    return vector_store.as_retriever(search_type="mmr", search_kwargs={"k":k,"fetch_k":12})

class ChatRequest(BaseModel):
    question: str
    language: str = "English"

class LangRequest(BaseModel):
    language: str = "English"

class QuizRequest(BaseModel):
    language: str = "English"
    difficulty: str = "Mixed"

class EssayRequest(BaseModel):
    topic: str
    essay_type: str = "Argumentative Essay"
    word_count: int = 500
    language: str = "English"

class ELI5Request(BaseModel):
    concept: str
    style: str = "10-year-old kid"
    language: str = "English"

class YoutubeRequest(BaseModel):
    url: str

class DebateRequest(BaseModel):
    topic: str
    side: str = "For"
    history: List[dict] = []
    language: str = "English"

@app.get("/")
def root():
    return {"status": "MindLearn API running"}

@app.get("/status")
def status():
    return {"pdf_loaded": vector_store is not None}

@app.post("/upload")
async def upload_pdf(files: List[UploadFile] = File(...)):
    global vector_store
    splitter = RecursiveCharacterTextSplitter(chunk_size=3000, chunk_overlap=100)
    all_docs = []; file_names = []
    for file in files:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
            tmp.write(await file.read()); path = tmp.name
        docs = PyPDFLoader(path).load()
        for doc in docs: doc.metadata["source_file"] = file.filename
        all_docs.extend(splitter.split_documents(docs))
        file_names.append(file.filename); os.remove(path)
    vector_store = Chroma.from_documents(all_docs, get_embeddings(), persist_directory=CHROMA_DIR)
    return {"message": "Files processed", "files": file_names, "chunks": len(all_docs)}

@app.post("/chat")
def chat(req: ChatRequest):
    if vector_store:
        docs = get_retriever(k=5).invoke(req.question)
        context = "\n\n".join(d.page_content for d in docs)
    else:
        docs = []
        context = "No PDF uploaded. Answer from general knowledge."
    lang_map = {"English":"Respond in English.","Hindi":"हिंदी में जवाब दो।","Hinglish":"Hinglish mein jawab do."}
    system = f"You are an expert AI Study Assistant.\nAnswer ONLY from context. {lang_map.get(req.language,'')}\n\nContext:\n{context}"
    prompt = ChatPromptTemplate.from_messages([("system",system),("human","{input}")])
    answer = (prompt | get_llm() | StrOutputParser()).invoke({"input":req.question})
    return {"answer": answer, "sources": [{"file":d.metadata.get("source_file",""),"page":d.metadata.get("page","")} for d in docs]}

@app.post("/notes")
def notes(req: LangRequest):
    docs = get_retriever(k=8).invoke("main topics key concepts summary")
    context = "\n\n".join(d.page_content for d in docs)
    result = (PromptTemplate.from_template("Create structured study notes.\nFORMAT: # Title ## Key Concepts ## Definitions ## Important Points ## Summary\nLanguage: {lang}\nContent: {context}") | get_llm() | StrOutputParser()).invoke({"context":context,"lang":req.language})
    return {"notes": result}

@app.post("/flashcards")
def flashcards(req: LangRequest):
    docs = get_retriever(k=6).invoke("key terms definitions")
    context = "\n\n".join(d.page_content for d in docs)
    result = (PromptTemplate.from_template('Create 8 flashcards. Return ONLY JSON:\n[{{"term":"T","definition":"D"}}]\nLanguage:{lang}\nContent:{context}') | get_llm() | StrOutputParser()).invoke({"context":context,"lang":req.language})
    clean = result.strip().lstrip("```json").lstrip("```").rstrip("```").strip()
    return {"flashcards": json.loads(clean)}

@app.post("/quiz")
def quiz(req: QuizRequest):
    docs = get_retriever(k=6).invoke("facts definitions important points")
    context = "\n\n".join(d.page_content for d in docs)
    result = (PromptTemplate.from_template('Create 6 MCQ. Difficulty:{difficulty}\nReturn ONLY JSON:\n[{{"question":"Q?","options":["A) o1","B) o2","C) o3","D) o4"],"answer":"A) o1"}}]\nLanguage:{lang}\nContent:{context}') | get_llm() | StrOutputParser()).invoke({"context":context,"lang":req.language,"difficulty":req.difficulty})
    clean = result.strip().lstrip("```json").lstrip("```").rstrip("```").strip()
    return {"questions": json.loads(clean)}

@app.post("/essay")
def essay(req: EssayRequest):
    result = (PromptTemplate.from_template('Write a {essay_type} on "{topic}" (~{word_count} words).\nInclude: Introduction, Body, Conclusion.\nLanguage:{lang}') | get_llm() | StrOutputParser()).invoke({"topic":req.topic,"essay_type":req.essay_type,"word_count":req.word_count,"lang":req.language})
    return {"essay": result}

@app.post("/eli5")
def eli5(req: ELI5Request):
    result = (PromptTemplate.from_template('Explain "{concept}" simply for a {style}.\nUse simple words, fun analogies, emojis. 3-4 short paragraphs.\nLanguage:{lang}') | get_llm() | StrOutputParser()).invoke({"concept":req.concept,"style":req.style,"lang":req.language})
    return {"explanation": result}

@app.post("/youtube")
def youtube(req: YoutubeRequest):
    from youtube_transcript_api import YouTubeTranscriptApi
    import re
    m = re.search(r'v=([a-zA-Z0-9_-]{11})|youtu\.be/([a-zA-Z0-9_-]{11})', req.url)
    if not m: raise HTTPException(400, "Invalid URL")
    vid_id = m.group(1) or m.group(2)
    try:
        t = YouTubeTranscriptApi().fetch(vid_id)
        text = " ".join([x.text for x in t])[:8000]
    except Exception as e:
        raise HTTPException(400, str(e))
    result = (PromptTemplate.from_template('Create study notes from transcript.\n# Summary\n## Key Topics\n## Important Points\n## Takeaways\n\nTranscript:{text}') | get_llm() | StrOutputParser()).invoke({"text":text})
    return {"notes": result, "video_id": vid_id}

@app.post("/debate")
def debate(req: DebateRequest):
    ai_side = "Against" if req.side == "For" else "For"
    history = "\n".join([f"{m['role']}: {m['text']}" for m in req.history[-4:]])
    result = (PromptTemplate.from_template('Debate {side} on "{topic}".\nHistory:\n{history}\nGive strong counter-argument in 2-3 sentences.\nLanguage:{lang}') | get_llm() | StrOutputParser()).invoke({"side":ai_side,"topic":req.topic,"history":history,"lang":req.language})
    return {"response": result, "ai_side": ai_side}

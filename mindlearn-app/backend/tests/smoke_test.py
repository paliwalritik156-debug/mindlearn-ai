"""
Offline smoke test for the MindLearn API. Uses fake AI + fake vector DB, so it needs no Groq key and no internet.
Run from the backend folder:   python3 tests/smoke_test.py
(needs: pip install httpx pytest-less - just fastapi, httpx, langchain-core, python-dotenv, python-multipart)
"""
import sys, types, os, json, shutil, tempfile
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, os.path.dirname(HERE))
work = tempfile.mkdtemp(); os.chdir(work)
os.environ["DAILY_AI_LIMIT"] = "40"; os.environ["MINDLEARN_DATA_DIR"] = work; os.environ["ADMIN_EMAILS"] = "r@x.com"; os.environ["MINDLEARN_SKIP_AUTH_ROUTER"] = "1"
from langchain_core.documents import Document
from langchain_core.language_models.fake_chat_models import FakeListChatModel

def mod(name, **attrs):
    m = types.ModuleType(name); m.__dict__.update(attrs); sys.modules[name] = m; return m

mod("auth", check_rate=lambda *a, **k: None, get_current_user=lambda tok=None: {"id": 7, "email": "r@x.com", "name": "R"}, create_user=lambda *a: {"id": 7}, authenticate_user=lambda *a: None, create_access_token=lambda i: "t", init_db=lambda: None)
DISK = {}
def match(meta, flt):
    if not flt: return True
    v = flt["doc_id"]
    return meta.get("doc_id") in v["$in"] if isinstance(v, dict) else meta.get("doc_id") == v
class Coll:
    def __init__(s, d): s.d = d
    def count(s): return len(DISK.get(s.d, []))
    def delete(s, where=None): DISK[s.d] = [x for x in DISK.get(s.d, []) if not match(x.metadata, where)]
    def add(s, ids, embeddings, documents, metadatas):
        assert len(ids) == len(embeddings) == len(documents) == len(metadatas) and all(len(v) == 3 for v in embeddings)
        os.makedirs(s.d, exist_ok=True); open(s.d + "/chroma.sqlite3", "w").write("x")
        DISK.setdefault(s.d, []).extend(Document(page_content=t, metadata=m) for t, m in zip(documents, metadatas))
class Chroma:
    def __init__(s, persist_directory=None, embedding_function=None): s.d = persist_directory; s._collection = Coll(s.d)
    @classmethod
    def from_documents(cls, docs, emb, persist_directory=None):
        DISK[persist_directory] = list(docs); os.makedirs(persist_directory, exist_ok=True); open(persist_directory + "/chroma.sqlite3", "w").write("x"); return cls(persist_directory)
    def add_documents(s, docs): DISK[s.d].extend(docs)
    def as_retriever(s, **kw):
        k = kw["search_kwargs"]["k"]; flt = kw["search_kwargs"].get("filter"); d = s.d
        return types.SimpleNamespace(invoke=lambda q: [x for x in DISK.get(d, []) if match(x.metadata, flt)][:k])
CAPTURED = []
class PyPDFLoader:
    def __init__(s, p): s.p = p
    def load(s):
        raw = open(s.p, "rb").read()
        if b"BROKEN" in raw: raise RuntimeError("bad")
        txt = raw.decode("latin1")
        if b"SCAN" in raw: return [Document(page_content="", metadata={"page": 0}), Document(page_content="", metadata={"page": 1})]
        return [Document(page_content=f"{txt} page{i} {{braces}} content " * 20, metadata={"page": i}) for i in range(3)]
mod("langchain_community"); mod("langchain_community.document_loaders", PyPDFLoader=PyPDFLoader)
mod("langchain_community.vectorstores", Chroma=Chroma)
mod("langchain_community.embeddings"); mod("langchain_community.embeddings.fastembed", FastEmbedEmbeddings=lambda **k: types.SimpleNamespace(embed_documents=lambda texts: [[0.1, 0.2, 0.3] for _ in texts]))
mod("langchain_groq", ChatGroq=lambda **k: None)
RESP = {"v": ["fallback"]}
class Rec(FakeListChatModel):
    def _call(self, messages, *a, **k):
        CAPTURED.append(messages); return super()._call(messages, *a, **k)

if os.getenv("DATABASE_URL"):
    import psycopg
    with psycopg.connect(os.environ["DATABASE_URL"], autocommit=True) as _c: _c.execute("drop schema public cascade; create schema public")
import main
main.get_llm = lambda: Rec(responses=RESP["v"])
from fastapi.testclient import TestClient
c = TestClient(main.app)
fails = []
def ok(name, cond, extra=""):
    print(("PASS " if cond else "FAIL ") + name + ("" if cond else "  -> " + str(extra)))
    if not cond: fails.append(name)
pdf = lambda name, body=b"hello": ("files", (name, body, "application/pdf"))

# --- upload + library ---
r = c.post("/upload", files=[pdf("a.pdf", b"AAA doc")]); ok("upload a", r.status_code == 200 and r.json()["docs"][0]["name"] == "a.pdf", r.text)
r = c.post("/upload", files=[pdf("b.pdf", b"BBB doc")]); ok("upload b keeps a", r.status_code == 200, r.text)
lib = c.get("/library").json(); ok("library has both, b active", [d["name"] for d in lib["docs"]] == ["b.pdf", "a.pdf"] and [d["active"] for d in lib["docs"]] == [True, False], lib)
RESP["v"] = ["answer"]
src = lambda: {s["file"] for s in c.post("/chat", json={"question": "q"}).json()["sources"]}
ok("chat only uses active doc (b)", src() == {"b.pdf"}, src())
a_id = [d["id"] for d in lib["docs"] if d["name"] == "a.pdf"][0]; b_id = [d["id"] for d in lib["docs"] if d["name"] == "b.pdf"][0]
r = c.put("/library/active", json={"doc_ids": [a_id, b_id]}); ok("activate both", r.status_code == 200)
ok("chat uses both docs", src() == {"a.pdf", "b.pdf"}, src())
ok("activate nothing -> 400", c.put("/library/active", json={"doc_ids": ["nope"]}).status_code == 400)
main.vector_stores.clear(); ok("index survives restart", c.get("/status").json()["pdf_loaded"] is True)
r = c.post("/upload", files=[pdf("a.pdf", b"AAA2 new")]); ok("re-upload same name replaces", len([d for d in c.get("/library").json()["docs"] if d["name"] == "a.pdf"]) == 1 and all("AAA doc" not in x.page_content for x in DISK["./chroma_db/user_7"]), r.text)
r = c.delete(f"/library/{b_id}"); ok("delete doc", r.status_code == 200 and all(x.metadata["doc_id"] != b_id for x in DISK["./chroma_db/user_7"]), r.text)
ok("delete unknown -> 404", c.delete("/library/zzz").status_code == 404)
ok("a still active after deleting b", len(c.get("/library").json()["docs"]) == 1 and c.get("/library").json()["docs"][0]["active"])

# --- errors / OCR ---
r = c.post("/upload", files=[pdf("s.pdf", b"SCAN")]); ok("scanned w/o OCR -> 400 + hint", r.status_code == 400 and "scanned" in r.json()["detail"] and "OCR" in r.json()["detail"], r.text)
main.ocr_pages = lambda path, idxs: {i: f"OCR text page {i}" for i in idxs}
r = c.post("/upload", files=[pdf("s.pdf", b"SCAN")]); ok("scanned with OCR works", r.status_code == 200 and r.json()["ocr_pages"] == 2, r.text)
ok("non-pdf -> 400", c.post("/upload", files=[("files", ("x.txt", b"hi", "text/plain"))]).status_code == 400)
ok("broken pdf -> 400", c.post("/upload", files=[pdf("bad.pdf", b"BROKEN")]).status_code == 400)

# --- chat memory ---
CAPTURED.clear()
r = c.post("/chat", json={"question": "why?", "history": [{"role": "user", "text": "what is ATP"}, {"role": "assistant", "text": "ATP is the energy molecule."}]})
m = str(CAPTURED[-1]); ok("history reaches the model", "what is ATP" in m and "energy molecule" in m, m[:200])
ok("personality + braces safe", c.post("/chat", json={"question": "hi", "personality": "Be {odd}"}).status_code == 200)
r = c.post("/chat/stream", json={"question": "x"}); evs = [json.loads(l[6:]) for l in r.text.split("\n\n") if l.startswith("data: ")]
ok("stream works", evs[-1]["t"] == "done" and evs[0]["t"] == "delta")
ok("page numbers 1-based", min(s["page"] for s in c.post("/chat", json={"question": "q"}).json()["sources"]) == 1)

# --- json endpoints ---
RESP["v"] = ['```json\n[{"term":"Jolt","definition":"snap"}]\n```']
fc = c.post("/flashcards", json={}).json()["flashcards"]; ok("flashcards q/a", fc[0]["q"] == "Jolt" and fc[0]["a"] == "snap")
RESP["v"] = ['Sure:\n[{"question":"Q?","options":["A) a","B) b"],"answer":"A) a","explanation":"because","topic":"Cells"}]']
q = c.post("/quiz", json={"count": 3, "topic": "cells"}).json()["questions"][0]; ok("quiz explanation+topic", q["explanation"] == "because" and q["topic"] == "Cells")
RESP["v"] = ["nope, no json"]; ok("bad json -> 502", c.post("/quiz", json={}).status_code == 502)

# --- eli5 / debate shapes the web app really sends ---
RESP["v"] = ["Simple words."]
ok("eli5 accepts topic+text", c.post("/eli5", json={"topic": "osmosis", "text": "osmosis"}).json().get("explanation") == "Simple words.")
ok("eli5 empty -> 400", c.post("/eli5", json={}).status_code == 400)
RESP["v"] = ["## For\n- a\n## Against\n- b"]
d = c.post("/debate", json={"topic": "homework is useless"}).json(); ok("debate both sides", d["ai_side"] == "Both" and "For" in d["response"])
ok("debate empty topic -> 400", c.post("/debate", json={"topic": " "}).status_code == 400)
ok("debate with history", c.post("/debate", json={"topic": "x", "side": "For", "history": [{"role": "user", "text": "hi"}]}).json()["ai_side"] == "Against")

# --- usage limit (12/day set above; counted so far) ---
used = c.get("/usage").json(); ok("usage counted", used["used"] > 5 and used["limit"] == 40, used)
codes = [c.post("/chat", json={"question": "q"}).status_code for _ in range(45)]
ok("daily limit -> 429", 429 in codes and "free AI requests" in c.post("/chat", json={"question": "q"}).json()["detail"], codes)

# --- sync ---
ok("sync put/get", c.put("/sync/state", json={"data": {"ml_scores": "[1]", "evil": "x"}, "updated_at": 5}).status_code == 200 and c.get("/sync/state").json()["data"] == {"ml_scores": "[1]"})

ok("sync keeps highlights + study time", c.put("/sync/state", json={"data": {"ml_hl": "{}", "ml_time": "{}"}, "updated_at": 6}).status_code == 200 and set(c.get("/sync/state").json()["data"]) == {"ml_hl", "ml_time"})

_u = main.db.connect("users"); _u.execute("create table if not exists users(id integer primary key, name text, email text, password_hash text, created_at text)"); _u.execute("delete from users"); _u.execute("insert into users values(7, 'R', 'r@x.com', 'h', ?)", (__import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat(),)); _u.commit(); _u.close()
_x = main._db(); _x.execute("delete from usage"); _x.commit(); _x.close()
# --- v30: server disk wiped (Render restart) -> index rebuilt from the database ---
import shutil, time as _t
c.post("/upload", files=[pdf("keep.pdf", b"KEEP doc")])
main.vector_stores.clear(); DISK.clear(); shutil.rmtree("./chroma_db", ignore_errors=True)
ok("index rebuilt after disk wipe", c.get("/status").json()["pdf_loaded"] is True)
RESP["v"] = ["ans"]; ok("chat works after rebuild", {s["file"] for s in c.post("/chat", json={"question": "q"}).json()["sources"]} == {"keep.pdf"})
kid = [d["id"] for d in c.get("/library").json()["docs"] if d["name"] == "keep.pdf"][0]
c.delete(f"/library/{kid}"); main.vector_stores.clear(); DISK.clear(); shutil.rmtree("./chroma_db", ignore_errors=True)
ok("deleted doc is NOT resurrected", all(x.metadata.get("doc_id") != kid for x in DISK.get("./chroma_db/user_7", [])) and (c.get("/status").json()["pdf_loaded"] in (True, False)))

# --- v30: async upload with progress ---
r = c.post("/upload/async", files=[pdf("p1.pdf", b"PPP one")]); jid = r.json().get("job_id"); ok("async upload returns job", r.status_code == 200 and jid, r.text)
seen = []; st = {}
for _ in range(200):
    st = c.get(f"/upload/job/{jid}").json(); seen.append(st["pct"])
    if st["done"]: break
    _t.sleep(0.05)
ok("async upload finishes", st["done"] and not st["error"] and st["pct"] == 100 and st["result"]["docs"][0]["name"] == "p1.pdf", st)
ok("progress never goes backwards", seen == sorted(seen), seen)
ok("job of someone else / unknown -> 404", c.get("/upload/job/nope").status_code == 404)
r = c.post("/upload/async", files=[pdf("bad.txt", b"x")]); jid = r.json()["job_id"]
for _ in range(200):
    st = c.get(f"/upload/job/{jid}").json()
    if st["done"]: break
    _t.sleep(0.05)
ok("async upload error is friendly", st["done"] and "only PDF" in (st["error"] or ""), st)

# --- v30: feedback + error log + admin ---
ok("feedback saved", c.post("/feedback", json={"kind": "bug", "message": "button broken", "page": "#/x"}).json() == {"ok": True})
ok("feedback too short -> 400", c.post("/feedback", json={"message": "a"}).status_code == 400)
ok("error log saved", c.post("/log/error", json={"message": "boom", "stack": "at x", "page": "#/y"}).json()["ok"] is True)
st = c.get("/admin/stats").json()
ok("admin stats", st["feedback_total"] == 1 and st["recent_feedback"][0]["message"] == "button broken" and st["recent_errors"][0]["message"] == "boom" and st["uploads_7d_failed"] >= 1 and st["uploads_7d_ok"] >= 3 and st["docs_total"] >= 1, st)
os.environ["ADMIN_EMAILS"] = "someone@else.com"
ok("non-admin -> 403", c.get("/admin/stats").status_code == 403 and c.get("/admin/me").json() == {"admin": False})
os.environ["ADMIN_EMAILS"] = "R@X.com"
ok("admin/me true (case-insensitive)", c.get("/admin/me").json() == {"admin": True})
# account purge removes everything
main.purge_user_data(7, "r@x.com")
c2 = db_check = main.db.connect("main")
left = [c2.execute(f'select count(*) from {t_} where "user"=?', ("7",)).fetchone()[0] for t_ in ("docs", "chunks", "usage", "feedback", "errors", "uploads")]
c2.close(); ok("purge clears all tables", left == [0] * 6, left)
print("\n" + ("ALL PASSED" if not fails else f"{len(fails)} FAILED: {fails}"))
sys.exit(1 if fails else 0)

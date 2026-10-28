"""
Tests for the real auth system (register, login, rate limit, forgot/reset, change password, delete account).
Run from the backend folder:  python3 tests/auth_test.py     (needs fastapi, httpx, bcrypt, python-jose)
"""
import os, sys, tempfile, shutil, re, logging
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, os.path.dirname(HERE))
work = tempfile.mkdtemp(); os.chdir(work)
os.environ["JWT_SECRET"] = "x" * 40; os.environ["MINDLEARN_DATA_DIR"] = work
if os.getenv("DATABASE_URL"):
    import psycopg
    with psycopg.connect(os.environ["DATABASE_URL"], autocommit=True) as _c: _c.execute("drop schema public cascade; create schema public")
import auth
auth.init_db()
from fastapi import FastAPI
from fastapi.testclient import TestClient
import auth_router, mailer

sent = []
auth_router.send_mail = lambda to, subj, text: sent.append((to, text)) or True
purged = []
app = FastAPI(); app.include_router(auth_router.build_auth_router(lambda uid, email: purged.append((uid, email))))
c = TestClient(app)
ok = fail = 0
def check(name, cond):
    global ok, fail
    if cond: ok += 1
    else: fail += 1; print("FAIL:", name)

def reg(email="a@x.com", pw="Password1", name="Asha"):
    return c.post("/auth/register", json={"name": name, "email": email, "password": pw})
H = lambda t: {"Authorization": "Bearer " + t}

r = reg(); check("register ok", r.status_code == 200 and r.json()["user"]["email"] == "a@x.com")
tok = r.json()["access_token"]
check("me works", c.get("/auth/me", headers=H(tok)).json()["user"]["name"] == "Asha")
check("no hash leaked", "password_hash" not in c.get("/auth/me", headers=H(tok)).text)
check("dup email rejected", reg().status_code == 400)
check("short pw rejected", reg("b@x.com", "short").status_code == 400)
check("bad email rejected", reg("nope", "Password1").status_code == 400)
check("login ok", c.post("/auth/login", json={"email": "A@x.com ", "password": "Password1"}).status_code == 200)
check("wrong pw 401", c.post("/auth/login", json={"email": "a@x.com", "password": "bad"}).status_code == 401)
check("bad token 401", c.get("/auth/me", headers=H("garbage")).status_code == 401)

# login rate limit: 8 per email / 15 min  (2 used so far incl. success -> hammer)
codes = [c.post("/auth/login", json={"email": "a@x.com", "password": "bad"}).status_code for _ in range(10)]
check("login rate-limited (429)", 429 in codes)
auth.reset_rate_limits()

# forgot / reset
r1 = c.post("/auth/forgot", json={"email": "a@x.com"}); r2 = c.post("/auth/forgot", json={"email": "ghost@x.com"})
check("forgot same answer for unknown email", r1.status_code == 200 and r2.status_code == 200 and r1.json()["message"] == r2.json()["message"])
check("mail sent only for real account", len(sent) == 1 and sent[0][0] == "a@x.com")
m = re.search(r"reset\?token=([\w-]+)", sent[0][1]); rt = m.group(1)
check("token not stored in plain text", all(rt not in str(tuple(r)) for r in auth.db.connect("users").execute("select * from password_resets").fetchall()))
check("weak new pw rejected", c.post("/auth/reset", json={"token": rt, "password": "abc"}).status_code == 400)
r = c.post("/auth/reset", json={"token": rt, "password": "NewPassw0rd"}); check("reset ok", r.status_code == 200)
check("old session killed by reset", c.get("/auth/me", headers=H(tok)).status_code == 401)
check("token is single use", c.post("/auth/reset", json={"token": rt, "password": "Another1234"}).status_code == 400)
check("old pw no longer works", c.post("/auth/login", json={"email": "a@x.com", "password": "Password1"}).status_code == 401)
tok2 = c.post("/auth/login", json={"email": "a@x.com", "password": "NewPassw0rd"}).json()["access_token"]
check("fake token rejected", c.post("/auth/reset", json={"token": "nope", "password": "Whatever123"}).status_code == 400)

# expired token
sent.clear(); c.post("/auth/forgot", json={"email": "a@x.com"}); t3 = re.search(r"token=([\w-]+)", sent[0][1]).group(1)
_d = auth.db.connect("users"); _d.execute("update password_resets set expires=1"); _d.commit(); _d.close()
check("expired token rejected", c.post("/auth/reset", json={"token": t3, "password": "Whatever123"}).status_code == 400)

# change password
check("change: wrong old pw", c.post("/auth/change-password", headers=H(tok2), json={"old_password": "bad", "new_password": "Brandnew123"}).status_code == 400)
r = c.post("/auth/change-password", headers=H(tok2), json={"old_password": "NewPassw0rd", "new_password": "Brandnew123"})
check("change ok + new token", r.status_code == 200 and c.get("/auth/me", headers=H(r.json()["access_token"])).status_code == 200)
check("old token dead after change", c.get("/auth/me", headers=H(tok2)).status_code == 401)
tok3 = r.json()["access_token"]

# delete account
check("delete: wrong pw", c.post("/auth/delete-account", headers=H(tok3), json={"password": "bad"}).status_code == 400)
check("delete ok", c.post("/auth/delete-account", headers=H(tok3), json={"password": "Brandnew123"}).status_code == 200)
check("purge hook called", len(purged) == 1 and purged[0][1] == "a@x.com")
check("deleted user can't login", c.post("/auth/login", json={"email": "a@x.com", "password": "Brandnew123"}).status_code == 401)
check("deleted user's token dead", c.get("/auth/me", headers=H(tok3)).status_code == 401)
print(f"auth tests: {ok} passed, {fail} failed"); shutil.rmtree(work, ignore_errors=True); sys.exit(1 if fail else 0)

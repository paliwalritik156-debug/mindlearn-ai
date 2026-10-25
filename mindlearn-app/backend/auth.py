"""
Authentication for MindLearn AI (v28, hardened).

- Passwords: bcrypt. Sessions: signed JWT (7 days).
- NEW: the token carries a "password version", so changing/resetting a password logs out every old session.
- NEW: if JWT_SECRET is not set, a secret is generated ONCE and saved to .jwt_secret (so restarts don't log everyone out).
  For production still set JWT_SECRET yourself (Render's disk is wiped on redeploy).
- NEW: in-memory rate limiting, password-reset tokens (single use, 30 min), change password, delete account.
"""
import hashlib
import logging
import os
import re
import secrets
import sqlite3
import threading
import time
from contextlib import closing
from datetime import datetime, timedelta, timezone

import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt

log = logging.getLogger("mindlearn.auth")
HERE = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(HERE, "mindlearn.db")


def _load_secret() -> str:
    env = os.getenv("JWT_SECRET")
    if env and len(env) >= 16:
        return env
    path = os.path.join(HERE, ".jwt_secret")
    try:
        with open(path) as f:
            s = f.read().strip()
            if len(s) >= 32:
                return s
    except OSError:
        pass
    s = secrets.token_hex(32)
    try:
        with open(path, "w") as f:
            f.write(s)
        os.chmod(path, 0o600)
    except OSError:
        log.warning("Could not save .jwt_secret; sessions will reset when the server restarts.")
    log.warning("JWT_SECRET is not set (or too short). Using a generated secret. Set JWT_SECRET in production.")
    return s


SECRET_KEY = _load_secret()
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7
RESET_TOKEN_MINUTES = 30
MIN_PASSWORD = 8
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]{2,}$")

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)


def _now() -> datetime:
    return datetime.now(timezone.utc)


# ---------------------------------------------------------------- rate limiting
_hits: dict = {}
_lock = threading.Lock()


def check_rate(key: str, limit: int, window_s: int, what: str = "attempts"):
    """Raise 429 if `key` was used more than `limit` times in the last `window_s` seconds."""
    now = time.time()
    with _lock:
        arr = [t for t in _hits.get(key, []) if now - t < window_s]
        if len(arr) >= limit:
            wait = int(window_s - (now - arr[0])) + 1
            _hits[key] = arr
            raise HTTPException(status_code=429, detail=f"Too many {what}. Please try again in {max(1, wait // 60)} min.")
        arr.append(now)
        _hits[key] = arr
        if len(_hits) > 5000:  # keep memory bounded
            for k in [k for k, v in _hits.items() if not v or now - v[-1] > 3600]:
                _hits.pop(k, None)


def reset_rate_limits():
    with _lock:
        _hits.clear()


# ---------------------------------------------------------------- passwords
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8")[:72], bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8")[:72], hashed.encode("utf-8"))
    except ValueError:
        return False


_DUMMY = hash_password("dummy-password-for-timing")


def validate_new_password(password: str):
    if not isinstance(password, str) or len(password) < MIN_PASSWORD:
        raise HTTPException(status_code=400, detail=f"Password must be at least {MIN_PASSWORD} characters")
    if len(password) > 128:
        raise HTTPException(status_code=400, detail="Password is too long (max 128 characters)")


# ---------------------------------------------------------------- database
def _conn():
    c = sqlite3.connect(DB_PATH, timeout=10)
    c.row_factory = sqlite3.Row
    return c


def init_db():
    with closing(_conn()) as c:
        c.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                created_at TEXT NOT NULL
            )""")
        c.execute("""
            CREATE TABLE IF NOT EXISTS password_resets (
                token_hash TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL,
                expires REAL NOT NULL,
                used INTEGER NOT NULL DEFAULT 0
            )""")
        c.commit()


def get_user_by_email(email: str):
    with closing(_conn()) as c:
        row = c.execute("SELECT * FROM users WHERE email = ?", ((email or "").lower().strip(),)).fetchone()
    return dict(row) if row else None


def get_user_by_id(user_id: int):
    with closing(_conn()) as c:
        row = c.execute("SELECT id, name, email, password_hash FROM users WHERE id = ?", (user_id,)).fetchone()
    return dict(row) if row else None


def _pv(password_hash: str) -> str:
    return hashlib.sha256(password_hash.encode()).hexdigest()[:10]


def create_user(name: str, email: str, password: str):
    email = (email or "").lower().strip()
    name = (name or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Name is required")
    if len(name) > 80:
        raise HTTPException(status_code=400, detail="Name is too long")
    if len(email) > 254 or not EMAIL_RE.match(email):
        raise HTTPException(status_code=400, detail="Enter a valid email address")
    validate_new_password(password)
    hashed = hash_password(password)
    try:
        with closing(_conn()) as c:
            cur = c.execute(
                "INSERT INTO users (name, email, password_hash, created_at) VALUES (?, ?, ?, ?)",
                (name, email, hashed, _now().isoformat()),
            )
            c.commit()
            user_id = cur.lastrowid
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=400, detail="An account with this email already exists")
    return {"id": user_id, "name": name, "email": email}


def authenticate_user(email: str, password: str):
    user = get_user_by_email(email)
    if not user:
        verify_password(password or "", _DUMMY)  # same time whether or not the email exists
        return None
    if not verify_password(password or "", user["password_hash"]):
        return None
    return user


def create_access_token(user_id: int):
    u = get_user_by_id(user_id)
    expire = _now() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": str(user_id), "exp": expire, "pv": _pv(u["password_hash"]) if u else ""}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(token: str = Depends(oauth2_scheme)):
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Not authenticated — please sign in",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not token:
        raise unauthorized
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = int(payload.get("sub"))
    except (JWTError, TypeError, ValueError):
        raise unauthorized
    user = get_user_by_id(user_id)
    if not user or payload.get("pv") != _pv(user["password_hash"]):
        raise unauthorized
    return {"id": user["id"], "name": user["name"], "email": user["email"]}


# ---------------------------------------------------------------- reset / change / delete
def make_reset_token(email: str):
    """Returns (token, user) or None if the email has no account. The token is stored hashed."""
    user = get_user_by_email(email)
    if not user:
        return None
    token = secrets.token_urlsafe(32)
    with closing(_conn()) as c:
        c.execute("DELETE FROM password_resets WHERE user_id = ? OR expires < ?", (user["id"], time.time()))
        c.execute(
            "INSERT INTO password_resets (token_hash, user_id, expires) VALUES (?, ?, ?)",
            (hashlib.sha256(token.encode()).hexdigest(), user["id"], time.time() + RESET_TOKEN_MINUTES * 60),
        )
        c.commit()
    return token, user


def reset_password(token: str, new_password: str):
    validate_new_password(new_password)
    h = hashlib.sha256((token or "").encode()).hexdigest()
    with closing(_conn()) as c:
        row = c.execute("SELECT * FROM password_resets WHERE token_hash = ?", (h,)).fetchone()
        if not row or row["used"] or row["expires"] < time.time():
            raise HTTPException(status_code=400, detail="This reset link is invalid or has expired. Please request a new one.")
        c.execute("UPDATE users SET password_hash = ? WHERE id = ?", (hash_password(new_password), row["user_id"]))
        c.execute("DELETE FROM password_resets WHERE user_id = ?", (row["user_id"],))
        c.commit()
    return get_user_by_id(row["user_id"])


def change_password(user_id: int, old_password: str, new_password: str):
    validate_new_password(new_password)
    u = get_user_by_id(user_id)
    if not u or not verify_password(old_password or "", u["password_hash"]):
        raise HTTPException(status_code=400, detail="Your current password is wrong")
    with closing(_conn()) as c:
        c.execute("UPDATE users SET password_hash = ? WHERE id = ?", (hash_password(new_password), user_id))
        c.commit()


def delete_user(user_id: int, password: str):
    u = get_user_by_id(user_id)
    if not u or not verify_password(password or "", u["password_hash"]):
        raise HTTPException(status_code=400, detail="Password is wrong")
    with closing(_conn()) as c:
        c.execute("DELETE FROM password_resets WHERE user_id = ?", (user_id,))
        c.execute("DELETE FROM users WHERE id = ?", (user_id,))
        c.commit()

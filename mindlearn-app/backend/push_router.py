"""
Web push for study reminders (works even when the app/tab is closed).

  GET  /push/key                          -> {key}   (public VAPID key; generated + stored in the DB on first use, no secrets to paste)
  POST /push/subscribe {subscription, time, tz} -> {ok}
  POST /push/unsubscribe {endpoint}       -> {ok}
  GET  /push/status                       -> {enabled}

A tiny scheduler (`tick`) is called from /health (Better Stack pings it every minute or so), so no extra worker is needed.
If the `pywebpush` package is not installed the endpoints answer 503 and everything else keeps working.
"""
import json, time, base64, datetime, threading
import db
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from auth import check_rate

try:
    from pywebpush import webpush, WebPushException
    from cryptography.hazmat.primitives.asymmetric import ec
    from cryptography.hazmat.primitives import serialization
    OK = True
except Exception:  # package missing
    OK = False

_lock = threading.Lock()
_last = [0.0]
TICK_EVERY = 45
WINDOW_MIN = 90


def _b64(b):
    return base64.urlsafe_b64encode(b).rstrip(b"=").decode()


def _ensure():
    c = db.connect("main")
    try:
        for s in [
            "create table if not exists push_subs(endpoint text primary key, \"user\" text, sub text, at text, tz int, last_day text, created real)",
            "create table if not exists push_keys(id int primary key, priv text, pub text)",
        ]:
            c.execute(db.ddl(s))
        c.commit()
    finally:
        c.close()


def _keys():
    """(private_pem_text, public_b64) - created once and kept in the database."""
    c = db.connect("main")
    try:
        row = c.execute("select priv, pub from push_keys where id=1").fetchone()
        if row: return row[0], row[1]
        k = ec.generate_private_key(ec.SECP256R1())
        pem = k.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption()).decode()
        pub = _b64(k.public_key().public_bytes(serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint))
        try:
            c.execute("insert into push_keys(id,priv,pub) values(1,?,?)", (pem, pub)); c.commit()
        except Exception:
            c.rollback(); row = c.execute("select priv, pub from push_keys where id=1").fetchone(); return row[0], row[1]
        return pem, pub
    finally:
        c.close()


def local_now(tz_min, now=None):
    """tz_min = JS getTimezoneOffset() (minutes, UTC minus local)."""
    t = datetime.datetime.utcfromtimestamp(now if now is not None else time.time()) - datetime.timedelta(minutes=int(tz_min))
    return t


def is_due(at, tz_min, last_day, now=None):
    n = local_now(tz_min, now)
    day = n.strftime("%Y-%m-%d")
    try:
        h, m = [int(x) for x in at.split(":")]
    except Exception:
        return False, day
    cur, want = n.hour * 60 + n.minute, h * 60 + m
    return (last_day != day and want <= cur <= want + WINDOW_MIN), day


class SubIn(BaseModel):
    subscription: dict
    time: str = "19:00"
    tz: int = 0


class UnsubIn(BaseModel):
    endpoint: str


def tick(force=False):
    """Send every reminder that is due. Safe to call often; self-throttled."""
    if not OK: return 0
    with _lock:
        if not force and time.time() - _last[0] < TICK_EVERY: return 0
        _last[0] = time.time()
    sent = 0
    try:
        priv, _pub = _keys()
        c = db.connect("main")
        try:
            rows = c.execute("select endpoint, sub, at, tz, last_day from push_subs").fetchall()
            for ep, sub, at, tz, last_day in rows:
                due, day = is_due(at, tz, last_day)
                if not due: continue
                c.execute("update push_subs set last_day=? where endpoint=?", (day, ep)); c.commit()
                try:
                    webpush(json.loads(sub), json.dumps({"title": "Time to study 📚", "body": "A short session keeps your streak alive.", "url": "/"}),
                            vapid_private_key=priv, vapid_claims={"sub": "mailto:support@mindlearn.ai"}, ttl=6 * 3600)
                    sent += 1
                except WebPushException as e:
                    code = getattr(getattr(e, "response", None), "status_code", 0)
                    if code in (404, 410):
                        c.execute("delete from push_subs where endpoint=?", (ep,)); c.commit()
                except Exception:
                    pass
        finally:
            c.close()
    except Exception:
        pass
    return sent


def build_push_router(get_current_user):
    r = APIRouter()
    if OK: _ensure()

    def need():
        if not OK: raise HTTPException(503, "Push notifications are not enabled on the server yet.")

    @r.get("/push/status")
    def status():
        return {"enabled": OK}

    @r.get("/push/key")
    def key():
        need(); return {"key": _keys()[1]}

    @r.post("/push/subscribe")
    def subscribe(b: SubIn, user=Depends(get_current_user)):
        need()
        uid = str(user.get("id") or user.get("email")); check_rate(f"push-sub:{uid}", 20, 3600, "subscriptions")
        ep = str(b.subscription.get("endpoint", ""))
        if not ep.startswith("https://") or len(ep) > 600 or not isinstance(b.subscription.get("keys"), dict):
            raise HTTPException(400, "Bad subscription.")
        at = b.time if len(b.time) == 5 and b.time[2] == ":" else "19:00"
        c = db.connect("main")
        try:
            c.execute("delete from push_subs where endpoint=?", (ep,))
            c.execute('insert into push_subs(endpoint,"user",sub,at,tz,last_day,created) values(?,?,?,?,?,?,?)',
                      (ep, uid, json.dumps(b.subscription), at, max(-840, min(840, int(b.tz))), "", time.time()))
            c.commit()
        finally:
            c.close()
        return {"ok": True}

    @r.post("/push/unsubscribe")
    def unsubscribe(b: UnsubIn, user=Depends(get_current_user)):
        uid = str(user.get("id") or user.get("email"))
        c = db.connect("main")
        try:
            c.execute('delete from push_subs where endpoint=? and "user"=?', (b.endpoint, uid)); c.commit()
        finally:
            c.close()
        return {"ok": True}

    return r

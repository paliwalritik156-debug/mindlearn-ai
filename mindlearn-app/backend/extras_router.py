"""
Feedback, frontend error log and the admin stats page.

  POST /feedback        anyone (signed in or not)  -> saved in the database (+ emailed to ADMIN_EMAILS if SMTP is set up)
  POST /log/error       the web app reports crashes here
  GET  /admin/me        {"admin": true/false}
  GET  /admin/stats     only for emails listed in env ADMIN_EMAILS (comma separated)
"""
import os, time, datetime, threading, logging
from typing import Optional
from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel
import db
from auth import check_rate


def client_ip(req: Request) -> str:
    fwd = req.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return req.client.host if req.client else "unknown"

log = logging.getLogger("mindlearn")


def admin_emails():
    return {e.strip().lower() for e in os.getenv("ADMIN_EMAILS", "").split(",") if e.strip()}


class FeedbackIn(BaseModel):
    kind: str = "idea"            # bug | idea | other
    message: str
    page: str = ""


class ErrorIn(BaseModel):
    message: str
    stack: str = ""
    page: str = ""


def build_extras_router(get_current_user):
    r = APIRouter()

    def opt_user(authorization: Optional[str] = Header(None)):
        if not authorization or not authorization.lower().startswith("bearer "):
            return None
        try:
            return get_current_user(authorization[7:].strip())
        except Exception:
            return None

    def admin_user(user=Depends(get_current_user)):
        if (user.get("email") or "").lower() not in admin_emails():
            raise HTTPException(status_code=403, detail="Admins only")
        return user

    @r.post("/feedback")
    def feedback(body: FeedbackIn, request: Request, user=Depends(opt_user)):
        msg = (body.message or "").strip()
        if len(msg) < 3:
            raise HTTPException(status_code=400, detail="Please write a few words.")
        check_rate("fb:" + client_ip(request), 8, 3600, "feedback messages")
        kind = body.kind if body.kind in ("bug", "idea", "other") else "other"
        uid = str(user["id"]) if user else ""
        email = (user or {}).get("email", "")
        c = db.connect("main")
        try:
            c.execute('insert into feedback("user", email, kind, message, page, ua, created) values(?,?,?,?,?,?,?)',
                      (uid, email, kind, msg[:3000], (body.page or "")[:200], (request.headers.get("user-agent") or "")[:200], time.time()))
            c.commit()
        finally:
            c.close()
        admins = admin_emails()
        if admins:
            def notify():
                try:
                    import mailer
                    if mailer.mail_configured():
                        for a in admins:
                            mailer.send_mail(a, f"[MindLearn] {kind}: {msg[:50]}", f"From: {email or 'anonymous'}\nPage: {body.page}\n\n{msg}")
                except Exception:
                    log.warning("feedback mail failed", exc_info=True)
            threading.Thread(target=notify, daemon=True).start()
        return {"ok": True}

    @r.post("/log/error")
    def log_error(body: ErrorIn, request: Request, user=Depends(opt_user)):
        try:
            check_rate("err:" + client_ip(request), 30, 3600, "error reports")
        except HTTPException:
            return {"ok": False}
        c = db.connect("main")
        try:
            c.execute('insert into errors("user", message, stack, page, ua, created) values(?,?,?,?,?,?)',
                      (str(user["id"]) if user else "", (body.message or "")[:500], (body.stack or "")[:3000], (body.page or "")[:200],
                       (request.headers.get("user-agent") or "")[:200], time.time()))
            c.commit()
        finally:
            c.close()
        return {"ok": True}

    @r.get("/admin/me")
    def admin_me(user=Depends(get_current_user)):
        return {"admin": (user.get("email") or "").lower() in admin_emails()}

    @r.get("/admin/stats")
    def admin_stats(_=Depends(admin_user)):
        now = time.time(); day = 86400; week = now - 7 * day
        today = datetime.date.today().isoformat()
        wk_iso = (datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=7)).isoformat()
        d1_iso = (datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=1)).isoformat()
        out = {}
        c = db.connect("main"); u = db.connect("users")
        try:
            one = lambda conn, q, p=(): conn.execute(q, p).fetchone()[0] or 0
            out["users_total"] = one(u, "select count(*) from users")
            out["users_7d"] = one(u, "select count(*) from users where created_at >= ?", (wk_iso,))
            out["users_24h"] = one(u, "select count(*) from users where created_at >= ?", (d1_iso,))
            out["docs_total"] = one(c, "select count(*) from docs")
            out["chunks_total"] = one(c, "select count(*) from chunks")
            out["uploads_7d_ok"] = one(c, "select count(*) from uploads where ok=1 and created>=?", (week,))
            out["uploads_7d_failed"] = one(c, "select count(*) from uploads where ok=0 and created>=?", (week,))
            out["upload_avg_seconds_7d"] = round(float(one(c, "select avg(seconds) from uploads where ok=1 and created>=?", (week,))), 1)
            out["ai_requests_today"] = one(c, "select sum(n) from usage where day=?", (today,))
            out["active_users_today"] = one(c, "select count(*) from usage where day=?", (today,))
            out["errors_7d"] = one(c, "select count(*) from errors where created>=?", (week,))
            out["feedback_total"] = one(c, "select count(*) from feedback")
            out["recent_feedback"] = [
                {"kind": x[0], "email": x[1], "message": x[2], "page": x[3], "created": x[4]}
                for x in c.execute("select kind, email, message, page, created from feedback order by created desc limit 50").fetchall()]
            out["recent_errors"] = [
                {"message": x[0], "page": x[1], "created": x[2], "stack": (x[3] or "")[:300]}
                for x in c.execute("select message, page, created, stack from errors order by created desc limit 30").fetchall()]
            out["recent_failed_uploads"] = [
                {"name": x[0], "error": x[1], "created": x[2]}
                for x in c.execute("select name, error, created from uploads where ok=0 order by created desc limit 15").fetchall()]
            out["recent_users"] = [
                {"name": x[0], "email": x[1], "created": x[2]}
                for x in u.execute("select name, email, created_at from users order by id desc limit 15").fetchall()]
        finally:
            c.close(); u.close()
        out["database"] = "postgres" if db.IS_PG else "sqlite (data is lost when the server disk resets)"
        return out

    return r

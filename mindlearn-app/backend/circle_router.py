"""
Study circles (friends leaderboard) + anonymous usage counters.

  POST /circle/create        {name, display}            -> {code}
  POST /circle/join          {code, display}            -> {ok}
  GET  /circle/mine                                      -> [{code,name,members}]
  GET  /circle/{code}                                    -> {name, week, members:[{display,points,streak,me}]}
  POST /circle/{code}/score  {week, points, streak}      -> {ok}
  POST /circle/{code}/leave
  POST /ev                   {name}  (anonymous, no user id stored; only a per-day counter)

Points are reported by each member's browser (friendly competition, not tamper-proof).
Only the display name chosen by the member is shown; emails are never exposed.
"""
import re, time, secrets, datetime
import db
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from auth import check_rate

MAX_MEMBERS = 30
MAX_CIRCLES_PER_USER = 5
CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
EV_OK = re.compile(r"^[a-z0-9_:\-]{2,32}$")


def _week_now():
    d = datetime.date.today(); return (d - datetime.timedelta(days=d.weekday())).isoformat()


def _ensure():
    c = db.connect("main")
    try:
        for s in [
            "create table if not exists circles(code text primary key, name text, owner text, created real)",
            "create table if not exists circle_members(code text, \"user\" text, display text, week text, points int, streak int, updated real, joined real, primary key(code, \"user\"))",
            "create table if not exists events(day text, name text, n int, primary key(day, name))",
        ]:
            c.execute(db.ddl(s))
        c.commit()
    finally:
        c.close()


def _uid(u):
    return str(u.get("id") or u.get("email"))


def _clean_name(s, default="Student"):
    s = re.sub(r"[<>&\"'`]", "", str(s or "")).strip()[:24]
    return s or default


class CreateIn(BaseModel):
    name: str
    display: str = ""


class JoinIn(BaseModel):
    code: str
    display: str = ""


class ScoreIn(BaseModel):
    week: str
    points: int
    streak: int = 0


class EvIn(BaseModel):
    name: str


def build_circle_router(get_current_user):
    r = APIRouter()
    _ensure()

    @r.post("/circle/create")
    def create(b: CreateIn, user=Depends(get_current_user)):
        uid = _uid(user); check_rate(f"circle-create:{uid}", 10, 3600, "circles created")
        name = _clean_name(b.name, "My circle")
        c = db.connect("main")
        try:
            n = c.execute('select count(*) from circle_members where "user"=?', (uid,)).fetchone()[0]
            if n >= MAX_CIRCLES_PER_USER: raise HTTPException(400, f"You can be in at most {MAX_CIRCLES_PER_USER} circles.")
            for _ in range(10):
                code = "".join(secrets.choice(CODE_CHARS) for _ in range(6))
                if not c.execute("select 1 from circles where code=?", (code,)).fetchone(): break
            now = time.time()
            c.execute("insert into circles(code,name,owner,created) values(?,?,?,?)", (code, name, uid, now))
            c.execute('insert into circle_members(code,"user",display,week,points,streak,updated,joined) values(?,?,?,?,?,?,?,?)',
                      (code, uid, _clean_name(b.display or user.get("name")), _week_now(), 0, 0, now, now))
            c.commit()
        finally:
            c.close()
        return {"code": code, "name": name}

    @r.post("/circle/join")
    def join(b: JoinIn, user=Depends(get_current_user)):
        uid = _uid(user); check_rate(f"circle-join:{uid}", 30, 3600, "join attempts")
        code = re.sub(r"[^A-Za-z0-9]", "", b.code).upper()[:6]
        c = db.connect("main")
        try:
            row = c.execute("select name from circles where code=?", (code,)).fetchone()
            if not row: raise HTTPException(404, "No circle with that code. Check it and try again.")
            if c.execute('select 1 from circle_members where code=? and "user"=?', (code, uid)).fetchone():
                return {"ok": True, "name": row[0], "already": True}
            if c.execute('select count(*) from circle_members where code=?', (code,)).fetchone()[0] >= MAX_MEMBERS:
                raise HTTPException(400, "This circle is full.")
            if c.execute('select count(*) from circle_members where "user"=?', (uid,)).fetchone()[0] >= MAX_CIRCLES_PER_USER:
                raise HTTPException(400, f"You can be in at most {MAX_CIRCLES_PER_USER} circles.")
            now = time.time()
            c.execute('insert into circle_members(code,"user",display,week,points,streak,updated,joined) values(?,?,?,?,?,?,?,?)',
                      (code, uid, _clean_name(b.display or user.get("name")), _week_now(), 0, 0, now, now))
            c.commit()
        finally:
            c.close()
        return {"ok": True, "name": row[0]}

    @r.get("/circle/mine")
    def mine(user=Depends(get_current_user)):
        uid = _uid(user); c = db.connect("main")
        try:
            rows = c.execute('select c.code, c.name, (select count(*) from circle_members m2 where m2.code=c.code) from circles c join circle_members m on m.code=c.code where m."user"=? order by m.joined', (uid,)).fetchall()
        finally:
            c.close()
        return [{"code": x[0], "name": x[1], "members": x[2]} for x in rows]

    @r.get("/circle/{code}")
    def board(code: str, user=Depends(get_current_user)):
        uid = _uid(user); code = code.upper()[:6]; wk = _week_now(); c = db.connect("main")
        try:
            circ = c.execute("select name from circles where code=?", (code,)).fetchone()
            if not circ or not c.execute('select 1 from circle_members where code=? and "user"=?', (code, uid)).fetchone():
                raise HTTPException(404, "Circle not found.")
            rows = c.execute('select "user", display, week, points, streak from circle_members where code=?', (code,)).fetchall()
        finally:
            c.close()
        mem = [{"display": x[1], "points": (x[3] if x[2] == wk else 0), "streak": (x[4] if x[2] == wk else 0), "me": x[0] == uid} for x in rows]
        mem.sort(key=lambda m: (-m["points"], -m["streak"], m["display"].lower()))
        return {"name": circ[0], "code": code, "week": wk, "members": mem}

    @r.post("/circle/{code}/score")
    def score(code: str, b: ScoreIn, user=Depends(get_current_user)):
        uid = _uid(user); code = code.upper()[:6]
        check_rate(f"circle-score:{uid}", 120, 3600, "updates")
        if b.week != _week_now(): raise HTTPException(400, "Stale week.")
        pts = max(0, min(int(b.points), 100000)); st = max(0, min(int(b.streak), 3650))
        c = db.connect("main")
        try:
            cur = c.execute('update circle_members set week=?, points=?, streak=?, updated=? where code=? and "user"=?', (b.week, pts, st, time.time(), code, uid))
            c.commit()
        finally:
            c.close()
        return {"ok": True}

    @r.post("/circle/{code}/leave")
    def leave(code: str, user=Depends(get_current_user)):
        uid = _uid(user); code = code.upper()[:6]; c = db.connect("main")
        try:
            c.execute('delete from circle_members where code=? and "user"=?', (code, uid))
            if not c.execute("select 1 from circle_members where code=?", (code,)).fetchone():
                c.execute("delete from circles where code=?", (code,))
            c.commit()
        finally:
            c.close()
        return {"ok": True}

    @r.post("/ev")
    def event(b: EvIn, request: Request):
        """Anonymous counter. Stores only (day, event name, count). No user id, no IP."""
        ip = request.headers.get("x-forwarded-for", request.client.host if request.client else "x").split(",")[0].strip()
        try: check_rate(f"ev:{ip}", 300, 3600, "events")
        except HTTPException: return {"ok": False}
        name = (b.name or "").strip().lower()
        if not EV_OK.match(name): return {"ok": False}
        day = datetime.date.today().isoformat(); c = db.connect("main")
        try:
            if c.execute("select 1 from events where day=? and name=?", (day, name)).fetchone():
                c.execute("update events set n=n+1 where day=? and name=?", (day, name))
            else:
                if c.execute("select count(*) from events where day=?", (day,)).fetchone()[0] >= 200: return {"ok": False}
                c.execute("insert into events(day,name,n) values(?,?,1)", (day, name))
            c.commit()
        finally:
            c.close()
        return {"ok": True}

    return r

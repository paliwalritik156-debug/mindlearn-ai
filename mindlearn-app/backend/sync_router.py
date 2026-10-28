"""
Optional cloud-sync for MindLearn (progress, flashcards, settings).
NOT tested against your main.py (I never saw it). Needs: pip install fastapi (already there).

Use in main.py, after `app = FastAPI(...)`:

    from sync_router import build_router
    app.include_router(build_router(get_current_user))

`get_current_user` must be your existing FastAPI dependency that returns the logged-in
user (a dict with "email"/"id", or an object with .email/.id). Data is stored in its own
sqlite file (sync.db), separate from your users DB.
"""
import json, time
import db
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

ALLOWED = {"ml_scores","ml_activity","ml_weak","ml_pins","ml_deck","ml_kmap","ml_srs","ml_reading","ml_achievements",
           "ml_bms","ml_chat","ml_outlang","ml_personality","ml_theme","ml_sysprompt","ml_pomodoro","ml_doc","ml_hl","ml_time","ml_reminder","ml_spot_done","ml_perf"}
MAX_BYTES = 2_000_000

def _db():
    c = db.connect("sync")
    c.execute(db.ddl('create table if not exists state("user" text primary key, data text, updated_at real)'))
    return c

def _uid(u):
    for attr in ("email", "id"):
        v = u.get(attr) if isinstance(u, dict) else getattr(u, attr, None)
        if v: return str(v)
    raise HTTPException(401, "Unknown user")

class Body(BaseModel):
    data: dict
    updated_at: float = 0

def build_router(get_current_user):
    r = APIRouter()

    @r.get("/sync/state")
    def get_state(user=Depends(get_current_user)):
        c = _db(); row = c.execute('select data, updated_at from state where "user"=?', (_uid(user),)).fetchone(); c.close()
        if not row: return {"data": None, "updated_at": 0}
        return {"data": json.loads(row[0]), "updated_at": row[1]}

    @r.put("/sync/state")
    def put_state(body: Body, user=Depends(get_current_user)):
        clean = {k: v for k, v in body.data.items() if k in ALLOWED and isinstance(v, str)}
        raw = json.dumps(clean)
        if len(raw) > MAX_BYTES: raise HTTPException(413, "Data too large")
        c = _db()
        c.execute('insert into state("user",data,updated_at) values(?,?,?) on conflict("user") do update set data=excluded.data, updated_at=excluded.updated_at',
                  (_uid(user), raw, body.updated_at or time.time()))
        c.commit(); c.close()
        return {"ok": True}

    return r

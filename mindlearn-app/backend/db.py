"""
Tiny database layer shared by auth.py, main.py, sync_router.py.

  * No DATABASE_URL  -> SQLite files next to the code (same as before; good for your laptop)
  * DATABASE_URL=postgresql://...  -> Postgres (Neon / Supabase). Data survives Render restarts.

Usage:  with closing(db.connect("main")) as c:  c.execute("select ... where a=?", (x,)) ; c.commit()
`?` placeholders work for both. Rows can be read by index or by column name.
"""
import os, sqlite3, threading

HERE = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.getenv("MINDLEARN_DATA_DIR") or HERE
DATABASE_URL = (os.getenv("DATABASE_URL") or "").strip()
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = "postgresql://" + DATABASE_URL[len("postgres://"):]
IS_PG = DATABASE_URL.startswith("postgresql")

# SQLite file per logical database (kept as before). Postgres ignores the name: one database.
SQLITE_FILES = {"users": "mindlearn.db", "main": "library.db", "sync": "sync.db"}


class Row(tuple):
    """tuple + access by column name."""
    def __new__(cls, values, names):
        o = super().__new__(cls, values); o._names = list(names); return o
    def __getitem__(self, k):
        if isinstance(k, str):
            return tuple.__getitem__(self, self._names.index(k))
        return tuple.__getitem__(self, k)
    def keys(self): return list(self._names)
    def get(self, k, d=None):
        return tuple.__getitem__(self, self._names.index(k)) if k in self._names else d


class _Cur:
    def __init__(self, cur): self._c = cur
    def _wrap(self, r):
        if r is None: return None
        return Row(r, [d[0] for d in self._c.description])
    def fetchone(self): return self._wrap(self._c.fetchone())
    def fetchall(self): return [self._wrap(r) for r in self._c.fetchall()]
    @property
    def rowcount(self): return self._c.rowcount
    @property
    def lastrowid(self): return getattr(self._c, "lastrowid", None)


_pool = None
_pool_lock = threading.Lock()


def _get_pool():
    global _pool
    if _pool is None:
        with _pool_lock:
            if _pool is None:
                from psycopg_pool import ConnectionPool
                _pool = ConnectionPool(DATABASE_URL, min_size=1, max_size=6, timeout=30,
                                       check=ConnectionPool.check_connection, open=True,
                                       kwargs={"connect_timeout": 15})
                import atexit; atexit.register(lambda: _pool.close())
    return _pool


class Conn:
    def __init__(self, name):
        self.pg = IS_PG
        if self.pg:
            self._pool = _get_pool(); self._c = self._pool.getconn()
        else:
            self._c = sqlite3.connect(os.path.join(DATA_DIR, SQLITE_FILES.get(name, name + ".db")), timeout=10)

    def execute(self, sql, params=()):
        if self.pg:
            sql = sql.replace("?", "%s")
            cur = self._c.cursor(); cur.execute(sql, tuple(params))
        else:
            cur = self._c.execute(sql, tuple(params))
        return _Cur(cur)

    def insert_id(self, sql, params=()):
        """INSERT and return the new integer id column."""
        if self.pg:
            cur = self.execute(sql.rstrip().rstrip(";") + " RETURNING id", params)
            return cur.fetchone()[0]
        return self.execute(sql, params).lastrowid

    def commit(self): self._c.commit()
    def rollback(self):
        try: self._c.rollback()
        except Exception: pass

    def close(self):
        if self.pg:
            try: self._c.rollback()   # never hand back a dirty transaction
            except Exception: pass
            self._pool.putconn(self._c)
        else:
            self._c.close()


def connect(name="main"):
    return Conn(name)


if IS_PG:
    import psycopg
    IntegrityError = (psycopg.errors.IntegrityError, sqlite3.IntegrityError)
else:
    IntegrityError = (sqlite3.IntegrityError,)


def ddl(sql):
    """Translate the few SQLite-isms used in CREATE TABLE statements for Postgres."""
    if IS_PG:
        sql = sql.replace("INTEGER PRIMARY KEY AUTOINCREMENT", "SERIAL PRIMARY KEY")
        sql = sql.replace(" blob", " BYTEA").replace(" BLOB", " BYTEA")
        sql = sql.replace(" real", " DOUBLE PRECISION").replace(" REAL", " DOUBLE PRECISION")
    return sql


def init_schema():
    """Create every table used by the app (idempotent)."""
    c = connect("main")
    try:
        for stmt in [
            "create table if not exists docs(id text primary key, \"user\" text, name text, chunks int, pages int, ocr int, created real)",
            "create table if not exists active(\"user\" text primary key, ids text)",
            "create table if not exists usage(\"user\" text, day text, n int, primary key(\"user\", day))",
            # text + embedding of every chunk: lets us rebuild the vector index after a restart
            "create table if not exists chunks(doc_id text, \"user\" text, idx int, content text, meta text, emb blob, primary key(doc_id, idx))",
            "create index if not exists chunks_user on chunks(\"user\")",
            "create table if not exists feedback(id INTEGER PRIMARY KEY AUTOINCREMENT, \"user\" text, email text, kind text, message text, page text, ua text, created real)",
            "create table if not exists errors(id INTEGER PRIMARY KEY AUTOINCREMENT, \"user\" text, message text, stack text, page text, ua text, created real)",
            "create table if not exists shares(id text primary key, \"user\" text, kind text, title text, author text, data text, created real, views int)",
            "create index if not exists shares_user on shares(\"user\")",
            "create table if not exists uploads(id INTEGER PRIMARY KEY AUTOINCREMENT, \"user\" text, name text, pages int, chunks int, ok int, seconds real, error text, created real)",
        ]:
            c.execute(ddl(stmt))
        c.commit()
    finally:
        c.close()
    c = connect("sync")
    try:
        c.execute(ddl("create table if not exists state(\"user\" text primary key, data text, updated_at real)"))
        c.commit()
    finally:
        c.close()

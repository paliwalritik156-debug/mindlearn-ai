# MindLearn backend v26

Files: main.py (replace yours), sync_router.py (keep next to main.py), tests/smoke_test.py

## Run (same as before)
    uvicorn main:app --reload

## Offline self-test (no Groq key, no internet)
    python3 tests/smoke_test.py        # prints PASS/FAIL for ~30 checks

## Optional: read scanned PDFs (OCR)
    pip install pypdfium2 pytesseract
    brew install tesseract              # Mac
    brew install tesseract-lang         # only if you want Hindi:  export OCR_LANGS="eng+hin"
Without these, scanned PDFs get a clear error message; normal PDFs are unaffected.

## Settings (environment variables, put in .env)
    GROQ_API_KEY=...                    # as before
    DAILY_AI_LIMIT=200                  # AI requests per user per day (0 = unlimited)
    ALLOWED_ORIGINS=https://yoursite.com,http://localhost:5173
    OCR_LANGS=eng

## New endpoints
    GET /library   PUT /library/active   DELETE /library/{doc_id}   GET /usage   POST /chat/stream   GET /health
New files created next to main.py: library.db, sync.db (small sqlite files). Safe to delete to reset.

## v28 login system (auth.py, auth_router.py, mailer.py)
New files: copy ALL of auth.py, auth_router.py, mailer.py, main.py next to each other (replace your old auth.py and main.py).
    pip install bcrypt python-jose        # you already have these; nothing new to install
Tests:  python3 tests/auth_test.py   (28 checks)   and   python3 tests/smoke_test.py

What changed:
- Login / sign-up are rate-limited (too many wrong tries -> "try again in N min").
- Changing or resetting a password logs out every old session.
- If JWT_SECRET is not set a secret is saved once in .jwt_secret, so restarts don't log everyone out. In production still set JWT_SECRET.
- Passwords need 8+ characters (existing users can still sign in).
- New endpoints: POST /auth/forgot, /auth/reset, /auth/change-password, /auth/delete-account.
- Deleting an account also deletes the user's PDFs, search index, usage and synced progress.

## Password-reset emails (Gmail)
1. Google account -> Security -> turn on 2-Step Verification.
2. Google account -> Security -> "App passwords" -> create one named MindLearn -> copy the 16 letters.
3. Put in .env (or Render -> Environment):
    SMTP_HOST=smtp.gmail.com
    SMTP_PORT=587
    SMTP_USER=youraddress@gmail.com
    SMTP_PASS=the16letterapppassword
    FRONTEND_URL=https://your-site.vercel.app        # (http://localhost:5173 while testing)
Without SMTP the reset link is only printed in the server terminal (good for testing; users get nothing).

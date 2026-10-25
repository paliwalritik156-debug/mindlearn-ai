"""All /auth/* endpoints. Included from main.py."""
import logging
import os
from typing import Callable, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from pydantic import BaseModel

import auth
from mailer import send_mail, mail_configured

log = logging.getLogger("mindlearn.auth")


def client_ip(req: Request) -> str:
    fwd = req.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return req.client.host if req.client else "unknown"


class RegisterBody(BaseModel):
    name: str
    email: str
    password: str


class LoginBody(BaseModel):
    email: str
    password: str


class ForgotBody(BaseModel):
    email: str


class ResetBody(BaseModel):
    token: str
    password: str


class ChangeBody(BaseModel):
    old_password: str
    new_password: str


class DeleteBody(BaseModel):
    password: str


def build_auth_router(purge_user_data: Optional[Callable] = None) -> APIRouter:
    r = APIRouter(prefix="/auth")

    def pack(user):
        return {"access_token": auth.create_access_token(user["id"]), "token_type": "bearer",
                "user": {"id": user["id"], "name": user["name"], "email": user["email"]}}

    @r.post("/register")
    def register(body: RegisterBody, req: Request):
        auth.check_rate("reg:" + client_ip(req), 10, 3600, "sign-up attempts")
        return pack(auth.create_user(body.name, body.email, body.password))

    @r.post("/login")
    def login(body: LoginBody, req: Request):
        email = (body.email or "").lower().strip()
        auth.check_rate("login-ip:" + client_ip(req), 40, 900, "sign-in attempts")
        auth.check_rate("login-em:" + email, 8, 900, "sign-in attempts")
        user = auth.authenticate_user(email, body.password)
        if not user:
            raise HTTPException(status_code=401, detail="Incorrect email or password")
        return pack(user)

    @r.get("/me")
    def me(user: dict = Depends(auth.get_current_user)):
        return {"user": user}

    @r.post("/forgot")
    def forgot(body: ForgotBody, req: Request, bg: BackgroundTasks):
        email = (body.email or "").lower().strip()
        auth.check_rate("forgot-ip:" + client_ip(req), 10, 3600, "reset requests")
        auth.check_rate("forgot-em:" + email, 3, 3600, "reset requests")
        made = auth.make_reset_token(email)
        if made:
            token, user = made
            base = (os.getenv("FRONTEND_URL") or "http://localhost:5173").rstrip("/")
            link = f"{base}/#/reset?token={token}"
            bg.add_task(send_mail, user["email"], "Reset your MindLearn AI password",
                        f"Hi {user['name']},\n\nSomeone (hopefully you) asked to reset your MindLearn AI password.\n"
                        f"Open this link within {auth.RESET_TOKEN_MINUTES} minutes:\n\n{link}\n\n"
                        "If this wasn't you, ignore this email. Your password stays the same.\n")
        # same answer whether or not the email exists (no account enumeration)
        return {"ok": True, "message": "If an account exists for that email, a reset link is on its way.", "email_enabled": mail_configured()}

    @r.post("/reset")
    def reset(body: ResetBody, req: Request):
        auth.check_rate("reset-ip:" + client_ip(req), 20, 3600, "attempts")
        return pack(auth.reset_password(body.token, body.password))

    @r.post("/change-password")
    def change(body: ChangeBody, user: dict = Depends(auth.get_current_user)):
        auth.check_rate("chg:" + str(user["id"]), 6, 3600, "attempts")
        auth.change_password(user["id"], body.old_password, body.new_password)
        return pack(user)  # fresh token; all old sessions stop working

    @r.post("/delete-account")
    def delete_account(body: DeleteBody, user: dict = Depends(auth.get_current_user)):
        auth.check_rate("del:" + str(user["id"]), 5, 3600, "attempts")
        auth.delete_user(user["id"], body.password)
        if purge_user_data:
            try:
                purge_user_data(user["id"], user["email"])
            except Exception as e:
                log.error("purge after delete failed: %s", e)
        return {"ok": True}

    return r

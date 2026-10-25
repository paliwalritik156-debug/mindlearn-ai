"""
Tiny email sender (standard library only).

Set these environment variables (Render -> Environment) to send real emails, e.g. with Gmail:
    SMTP_HOST=smtp.gmail.com
    SMTP_PORT=587
    SMTP_USER=youraddress@gmail.com
    SMTP_PASS=<16-letter Gmail App Password>
    MAIL_FROM=MindLearn AI <youraddress@gmail.com>     (optional)
If SMTP is not set, the email text (with the reset link) is printed in the server log instead - handy for local testing.
"""
import logging
import os
import smtplib
from email.message import EmailMessage

log = logging.getLogger("mindlearn.mail")


def mail_configured() -> bool:
    return bool(os.getenv("SMTP_HOST") and os.getenv("SMTP_USER") and os.getenv("SMTP_PASS"))


def send_mail(to: str, subject: str, text: str) -> bool:
    if not mail_configured():
        log.warning("SMTP not configured. Email to %s:\n%s\n%s", to, subject, text)
        return False
    msg = EmailMessage()
    msg["From"] = os.getenv("MAIL_FROM") or os.getenv("SMTP_USER")
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(text)
    try:
        with smtplib.SMTP(os.getenv("SMTP_HOST"), int(os.getenv("SMTP_PORT", "587")), timeout=15) as s:
            s.starttls()
            s.login(os.getenv("SMTP_USER"), os.getenv("SMTP_PASS"))
            s.send_message(msg)
        return True
    except Exception as e:  # never crash the request because of mail trouble
        log.error("Could not send email: %s", e)
        return False

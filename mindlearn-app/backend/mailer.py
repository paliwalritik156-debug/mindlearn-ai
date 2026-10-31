"""
Tiny email sender (standard library only).

Set these environment variables (Render -> Environment) to send real emails, e.g. with Gmail:
    SMTP_HOST=smtp.gmail.com
    SMTP_PORT=587
    SMTP_USER=youraddress@gmail.com
    SMTP_PASS=<16-letter Gmail App Password>
    MAIL_FROM=MindLearn AI <youraddress@gmail.com>     (optional)
Render's FREE plan blocks outgoing SMTP ports (25/465/587), so Gmail SMTP will NOT work there. Use an email API over HTTPS instead (free at brevo.com):
    BREVO_API_KEY=<API key from Brevo -> SMTP & API -> API keys>
    MAIL_FROM_EMAIL=<the sender address you verified in Brevo>
    MAIL_FROM_NAME=MindLearn AI                         (optional)
If neither is set, the email text (with the reset link) is printed in the server log instead - handy for local testing.
"""
import logging
import os
import smtplib
import json
import urllib.request
import urllib.error
from email.message import EmailMessage

log = logging.getLogger("mindlearn.mail")


def _brevo_on() -> bool:
    return bool(os.getenv("BREVO_API_KEY") and os.getenv("MAIL_FROM_EMAIL"))


def mail_configured() -> bool:
    return _brevo_on() or bool(os.getenv("SMTP_HOST") and os.getenv("SMTP_USER") and os.getenv("SMTP_PASS"))


def _send_brevo(to: str, subject: str, text: str) -> bool:
    body = json.dumps({
        "sender": {"name": os.getenv("MAIL_FROM_NAME", "MindLearn AI"), "email": os.getenv("MAIL_FROM_EMAIL")},
        "to": [{"email": to}], "subject": subject, "textContent": text,
    }).encode()
    req = urllib.request.Request(os.getenv("BREVO_API_URL", "https://api.brevo.com/v3/smtp/email"), data=body, method="POST",
                                 headers={"api-key": os.getenv("BREVO_API_KEY"), "content-type": "application/json", "accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return 200 <= r.status < 300
    except urllib.error.HTTPError as e:
        log.error("Brevo refused the email (%s): %s", e.code, e.read()[:300])
    except Exception as e:
        log.error("Could not send email via Brevo: %s", e)
    return False


def send_mail(to: str, subject: str, text: str) -> bool:
    if not mail_configured():
        log.warning("SMTP not configured. Email to %s:\n%s\n%s", to, subject, text)
        return False
    if _brevo_on():
        return _send_brevo(to, subject, text)
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

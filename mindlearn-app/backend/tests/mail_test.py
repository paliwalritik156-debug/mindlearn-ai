"""Mail sender: the HTTPS (Brevo) path, tested against a tiny local fake server. Run: python3 tests/mail_test.py"""
import os, sys, json, threading
from http.server import BaseHTTPRequestHandler, HTTPServer
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
got = []
class H(BaseHTTPRequestHandler):
    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers["content-length"])))
        got.append((self.headers.get("api-key"), body))
        self.send_response(401 if self.headers.get("api-key") == "bad" else 201); self.end_headers(); self.wfile.write(b'{"messageId":"x"}')
    def log_message(self, *a): pass
srv = HTTPServer(("127.0.0.1", 0), H); threading.Thread(target=srv.serve_forever, daemon=True).start()
os.environ["BREVO_API_URL"] = f"http://127.0.0.1:{srv.server_port}/v3/smtp/email"
import mailer
fails = []
def ok(n, c):
    print(("PASS " if c else "FAIL ") + n)
    if not c: fails.append(n)
ok("not configured -> False", not mailer.mail_configured() and mailer.send_mail("a@b.com", "s", "t") is False)
os.environ.update(BREVO_API_KEY="k123", MAIL_FROM_EMAIL="me@gmail.com")
ok("configured with key + sender", mailer.mail_configured())
ok("send ok", mailer.send_mail("kid@x.com", "Reset", "link here") is True)
k, b = got[-1]
ok("payload shape", k == "k123" and b["sender"] == {"name": "MindLearn AI", "email": "me@gmail.com"} and b["to"] == [{"email": "kid@x.com"}] and b["subject"] == "Reset" and b["textContent"] == "link here")
os.environ["BREVO_API_KEY"] = "bad"
ok("API refusal -> False, no crash", mailer.send_mail("kid@x.com", "s", "t") is False)
os.environ["BREVO_API_URL"] = "http://127.0.0.1:1/x"
ok("unreachable -> False, no crash", mailer.send_mail("kid@x.com", "s", "t") is False)
print("\nALL PASSED" if not fails else f"{len(fails)} FAILED"); sys.exit(1 if fails else 0)

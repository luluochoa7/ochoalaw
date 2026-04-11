import os

import resend

RESEND_API_KEY = os.getenv("RESEND_API_KEY")
RESEND_FROM_EMAIL = os.getenv("RESEND_FROM_EMAIL")
RESEND_FROM_NAME = os.getenv("RESEND_FROM_NAME", "Portal")
RESEND_REPLY_TO = os.getenv("RESEND_REPLY_TO")

if RESEND_API_KEY:
    resend.api_key = RESEND_API_KEY


def send_transactional_email(
    to_email: str,
    subject: str,
    html_body: str,
    text_body: str | None = None,
    reply_to: str | None = None,
    from_name: str | None = None,
):
    if not RESEND_API_KEY:
        raise ValueError("RESEND_API_KEY is not configured")
    if not RESEND_FROM_EMAIL:
        raise ValueError("RESEND_FROM_EMAIL is not configured")

    sender_name = from_name or RESEND_FROM_NAME
    final_reply_to = reply_to or RESEND_REPLY_TO

    payload = {
        "from": f"{sender_name} <{RESEND_FROM_EMAIL}>",
        "to": [to_email],
        "subject": subject,
        "html": html_body,
        "text": text_body or subject,
    }

    if final_reply_to:
        payload["reply_to"] = final_reply_to

    return resend.Emails.send(payload)

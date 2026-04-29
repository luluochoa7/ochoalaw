from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
import html
from secrets import token_urlsafe
from typing import Optional
import hmac
import json
import os
import re
import time
from uuid import uuid4

from fastapi import FastAPI, Form, Depends, HTTPException, status, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse, StreamingResponse
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import text, or_

from database import SessionLocal, engine
from models import (
    Base,
    AuditEvent,
    ClientInvitation,
    ContactSubmission,
    Document,
    DocumentAccessToken,
    Matter,
    MatterEvent,
    MatterMessage,
    MatterNote,
    Notification,
    PasswordResetToken,
    User,
    UserSession,
)
from email_service import send_transactional_email

from auth_utils import (
    ACCESS_TOKEN_MINUTES,
    REFRESH_TOKEN_DAYS,
    create_access_token,
    create_csrf_token,
    create_refresh_token,
    decode_access_token,
    get_refresh_expiry,
    hash_password,
    hash_token,
    verify_password,
)

from pydantic import BaseModel

import boto3


ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        "ALLOWED_ORIGINS",
        "https://ochoalawyers.com,https://www.ochoalawyers.com,http://localhost:3000",
    ).split(",")
    if origin.strip()
]

ACCESS_COOKIE_NAME = "ocl_access"
REFRESH_COOKIE_NAME = "ocl_refresh"
CSRF_COOKIE_NAME = "ocl_csrf"
CSRF_HEADER_NAME = "x-csrf-token"
COOKIE_SECURE = os.getenv("COOKIE_SECURE", "true").lower() == "true"
COOKIE_DOMAIN = os.getenv("COOKIE_DOMAIN", ".ochoalawyers.com").strip() or None
COOKIE_SAMESITE = os.getenv("COOKIE_SAMESITE", "lax").lower()
DEFAULT_FRONTEND_BASE_URL = "https://ochoalawyers.com"
DEFAULT_SECURE_ACTIVITY_EMAIL_COOLDOWN_SECONDS = 15 * 60
_secure_activity_email_sent_at: dict[tuple[int, int, str], float] = {}

MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024  # 25MB FILE SIZE LIMIT

ALLOWED_EXTENSIONS = {".pdf", ".doc", ".docx", ".jpg", ".jpeg", ".png", ".webp"}
ALLOWED_CONTENT_TYPES = {
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "image/jpeg",
    "image/png",
    "image/webp",
}

RATE_LIMIT_WINDOW_SECONDS = 60
RATE_LIMITS = {
    "auth_login": (10, RATE_LIMIT_WINDOW_SECONDS),
    "password_reset": (5, RATE_LIMIT_WINDOW_SECONDS),
    "upload_presign": (30, RATE_LIMIT_WINDOW_SECONDS),
    "invite": (20, RATE_LIMIT_WINDOW_SECONDS),
}
rate_limit_store: dict[str, list[float]] = {}

AWS_REGION = os.getenv("AWS_REGION", "us-east-2")
S3_BUCKET_NAME = os.getenv("S3_BUCKET_NAME")
S3_UPLOAD_PREFIX = os.getenv("S3_UPLOAD_PREFIX", "uploads")
PRESIGNED_EXPIRATION = int(os.getenv("PRESIGNED_EXPIRATION_SECONDS", "900"))

# Create the S3 client once at startup
s3_client = boto3.client(
    "s3",
    region_name=AWS_REGION,
    aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
    aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
)

# Optional sanity check at startup
if not S3_BUCKET_NAME:
    print("WARNING: S3_BUCKET_NAME is not set. Document uploads will fail.")

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def datetime_is_past(value: datetime | None) -> bool:
    if value is None:
        return False
    now = utc_now()
    if value.tzinfo is None:
        return value < now.replace(tzinfo=None)
    return value < now


def set_auth_cookies(response, access_token: str, refresh_token: str, csrf_token: str):
    cookie_common = {
        "secure": COOKIE_SECURE,
        "samesite": COOKIE_SAMESITE,
        "domain": COOKIE_DOMAIN,
        "path": "/",
    }
    response.set_cookie(
        key=ACCESS_COOKIE_NAME,
        value=access_token,
        httponly=True,
        max_age=60 * ACCESS_TOKEN_MINUTES,
        **cookie_common,
    )
    response.set_cookie(
        key=REFRESH_COOKIE_NAME,
        value=refresh_token,
        httponly=True,
        max_age=60 * 60 * 24 * REFRESH_TOKEN_DAYS,
        **cookie_common,
    )
    response.set_cookie(
        key=CSRF_COOKIE_NAME,
        value=csrf_token,
        httponly=False,
        max_age=60 * 60 * 24 * REFRESH_TOKEN_DAYS,
        **cookie_common,
    )


def clear_auth_cookies(response):
    for name in [ACCESS_COOKIE_NAME, REFRESH_COOKIE_NAME, CSRF_COOKIE_NAME]:
        response.delete_cookie(
            key=name,
            domain=COOKIE_DOMAIN,
            path="/",
        )


def create_session_for_user(user: User, request: Request, db: Session):
    refresh_token = create_refresh_token()
    csrf_token = create_csrf_token()
    session = UserSession(
        user_id=user.id,
        refresh_token_hash=hash_token(refresh_token),
        csrf_token_hash=hash_token(csrf_token),
        user_agent=request.headers.get("user-agent"),
        ip_address=request.client.host if request.client else None,
        expires_at=get_refresh_expiry(),
    )
    db.add(session)
    return refresh_token, csrf_token, session


def build_access_token_for_user(user: User) -> str:
    return create_access_token(
        {
            "sub": str(user.id),
            "email": user.email,
            "role": user.role,
        }
    )


def user_payload(user: User) -> dict:
    return {
        "id": user.id,
        "email": user.email,
        "role": user.role,
        "name": user.name,
    }


def log_audit_event(
    db: Session,
    event_type: str,
    user_id: int | None = None,
    resource_type: str | None = None,
    resource_id: str | None = None,
    request: Request | None = None,
    metadata: dict | None = None,
):
    event = AuditEvent(
        user_id=user_id,
        event_type=event_type,
        resource_type=resource_type,
        resource_id=str(resource_id) if resource_id is not None else None,
        ip_address=request.client.host if request and request.client else None,
        user_agent=request.headers.get("user-agent") if request else None,
        metadata_json=json.dumps(metadata or {}),
    )
    db.add(event)
    return event


def get_rate_limit_key(request: Request, bucket: str) -> str:
    forwarded = request.headers.get("x-forwarded-for", "")
    ip = forwarded.split(",")[0].strip() if forwarded else None
    if not ip and request.client:
        ip = request.client.host
    return f"{bucket}:{ip or 'unknown'}"


def enforce_rate_limit(request: Request, bucket: str):
    limit, window = RATE_LIMITS[bucket]
    key = get_rate_limit_key(request, bucket)
    now = time.time()
    recent = [ts for ts in rate_limit_store.get(key, []) if now - ts < window]
    if len(recent) >= limit:
        raise HTTPException(status_code=429, detail="Too many requests. Please try again soon.")
    recent.append(now)
    rate_limit_store[key] = recent


def get_csrf_from_request(request: Request):
    return request.headers.get(CSRF_HEADER_NAME)


def verify_csrf_token(request: Request, session: UserSession):
    csrf_header = get_csrf_from_request(request)
    if not csrf_header:
        raise HTTPException(status_code=403, detail="Missing CSRF token")
    if not session.csrf_token_hash:
        raise HTTPException(status_code=403, detail="Missing CSRF session")
    if not hmac.compare_digest(hash_token(csrf_header), session.csrf_token_hash):
        raise HTTPException(status_code=403, detail="Invalid CSRF token")


def get_session_from_refresh_cookie(request: Request, db: Session) -> UserSession:
    refresh_token = request.cookies.get(REFRESH_COOKIE_NAME)
    if not refresh_token:
        raise HTTPException(status_code=401, detail="Missing refresh token")

    session = (
        db.query(UserSession)
        .filter(UserSession.refresh_token_hash == hash_token(refresh_token))
        .first()
    )
    if not session:
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    if session.revoked_at is not None:
        raise HTTPException(status_code=401, detail="Session revoked")
    if datetime_is_past(session.expires_at):
        raise HTTPException(status_code=401, detail="Session expired")
    return session


def sanitize_filename(filename: str) -> str:
    basename = os.path.basename(filename or "").strip()
    basename = re.sub(r"[^A-Za-z0-9._ -]+", "_", basename)
    basename = re.sub(r"\s+", "_", basename).strip("._- ")
    return basename[:180] or "document"


def validate_document_file(file_name: str, content_type: str | None, file_size: int | None = None):
    safe_name = sanitize_filename(file_name)
    ext = os.path.splitext(safe_name)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="File type not allowed")
    if content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(status_code=400, detail="Unsupported file type")
    if file_size is not None and file_size > MAX_FILE_SIZE_BYTES:
        raise HTTPException(status_code=400, detail="File must be under 25MB")
    return safe_name

@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield
    
app = FastAPI(title="Ochoa Lawyers", version="1.0.0", lifespan=lifespan,)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    )


CSRF_EXEMPT_PATHS = {
    "/auth/login",
    "/login",
    "/signup",
    "/contact",
    "/invitations/accept",
    "/password-reset/request",
    "/password-reset/confirm",
}


@app.middleware("http")
async def csrf_middleware(request: Request, call_next):
    if request.method.upper() in {"POST", "PUT", "PATCH", "DELETE"}:
        path = request.url.path.rstrip("/") or "/"
        if path not in CSRF_EXEMPT_PATHS:
            db = SessionLocal()
            try:
                session = get_session_from_refresh_cookie(request, db)
                verify_csrf_token(request, session)
            except HTTPException as exc:
                log_audit_event(
                    db,
                    "csrf_failure",
                    request=request,
                    metadata={"path": request.url.path, "status_code": exc.status_code},
                )
                db.commit()
                return JSONResponse(
                    status_code=exc.status_code,
                    content={"detail": exc.detail},
                )
            finally:
                db.close()

    return await call_next(request)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    if request.url.path.startswith("/documents/") and request.url.path.endswith("/content"):
        response.headers["Content-Security-Policy"] = (
            "frame-ancestors 'self' https://ochoalawyers.com https://www.ochoalawyers.com"
        )
    else:
        response.headers["X-Frame-Options"] = "DENY"
    if COOKIE_SECURE:
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response

@app.get("/")
def root():
    return {"message": "API is running"}

@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/test-db")
def test_db(db: Session = Depends(get_db)):
    try:
        ok = db.execute(text("SELECT 1")).scalar()
        return {"message": "DB connection successful", "result": ok}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"DB error: {str(e)}",
        )

@app.post("/contact")
def contact(
    request: Request,
    name: str = Form(...),
    email: str = Form(...),
    phone: Optional[str] = Form(None),  # Optional field
    message: str = Form(...),
    db: Session = Depends(get_db)
):

    if not name.strip() or not email.strip() or not message.strip():
        raise HTTPException(status_code=400, detail="Name, email, and message are required.")

    try:
        submission = ContactSubmission(
            name=name.strip(),
            email=email.strip(),
            phone=(phone.strip() if phone else None),
            message=message.strip(),
        )
        db.add(submission)
        db.commit()
        db.refresh(submission)

        contact_notification_email = os.getenv("CONTACT_NOTIFICATION_EMAIL")

        if contact_notification_email:
            try:
                send_transactional_email(
                    to_email=contact_notification_email,
                    subject=f"New contact form submission from {submission.name}",
                    html_body=f"""
                        <h2>New Contact Form Submission</h2>
                        <p><strong>Name:</strong> {submission.name}</p>
                        <p><strong>Email:</strong> {submission.email}</p>
                        <p><strong>Phone:</strong> {submission.phone or "Not provided"}</p>
                        <p><strong>Message:</strong></p>
                        <p>{submission.message}</p>
                    """,
                    text_body=(
                        f"New Contact Form Submission\n\n"
                        f"Name: {submission.name}\n"
                        f"Email: {submission.email}\n"
                        f"Phone: {submission.phone or 'Not provided'}\n\n"
                        f"Message:\n{submission.message}"
                    ),
                )
            except Exception as email_error:
                print(f"Contact form email failed: {email_error}")

        # AJAX/fetch submissions should receive JSON so the frontend can keep
        # the browser on the public site domain and redirect client-side.
        if request.headers.get("x-requested-with") == "fetch":
            return {"success": True}

        return RedirectResponse(
            url="https://ochoalaw.vercel.app/thank-you",
            status_code=303
        )

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save contact submission: {str(e)}"
        )

# signup
@app.post("/signup", status_code=status.HTTP_201_CREATED)
def signup(
    name: str = Form(...),
    email: str = Form(...),
    password: str = Form(...),
    db: Session = Depends(get_db)
):
    if db.query(User).filter(User.email == email.strip().lower()).first():
        raise HTTPException(status_code=400, detail="Email already exists")

    user = User(
        name=name.strip(),
        email=email.strip().lower(),
        password_hash=hash_password(password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return {"message": "User created successfully", "user_id": user.id}

class LoginRequest(BaseModel):
    email: str
    password: str


def issue_login_response(email: str, password: str, request: Request, db: Session):
    enforce_rate_limit(request, "auth_login")

    user = db.query(User).filter(User.email == email.strip().lower()).first()

    if not user or not verify_password(password, user.password_hash):
        log_audit_event(
            db,
            "login_failure",
            request=request,
            metadata={"email": email.strip().lower()},
        )
        db.commit()
        raise HTTPException(status_code=401, detail="Invalid email or password")

    access_token = build_access_token_for_user(user)
    refresh_token, csrf_token, _session = create_session_for_user(user, request, db)
    log_audit_event(db, "login_success", user_id=user.id, request=request)

    db.commit()

    response = JSONResponse(
        {
            "message": "Login successful",
            "user": user_payload(user),
        }
    )
    set_auth_cookies(response, access_token, refresh_token, csrf_token)
    return response


@app.post("/auth/login")
def auth_login(
    body: LoginRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    return issue_login_response(body.email, body.password, request, db)


@app.post("/login")
def login_alias(
    request: Request,
    email: str = Form(...),
    password: str = Form(...),
    db: Session = Depends(get_db),
):
    return issue_login_response(email, password, request, db)


def get_current_user(
    request: Request,
    db: Session = Depends(get_db)
):
    token = request.cookies.get(ACCESS_COOKIE_NAME)
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    payload = decode_access_token(token)
    if payload.get("typ") != "access":
        raise HTTPException(status_code=401, detail="Invalid token type")

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token payload")
    
    user = db.query(User).filter(User.id == int(user_id)).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user

def raise_access_denied(
    db: Session,
    user: User,
    request: Request | None,
    resource_type: str,
    resource_id: str | int | None,
):
    log_audit_event(
        db,
        "access_denied",
        user_id=user.id if user else None,
        resource_type=resource_type,
        resource_id=str(resource_id) if resource_id is not None else None,
        request=request,
    )
    db.commit()
    raise HTTPException(status_code=404, detail=f"{resource_type.title()} not found")


def get_accessible_matter(
    db: Session,
    user: User,
    matter_id: int,
    request: Request | None = None,
):
    matter = db.query(Matter).filter(Matter.id == matter_id).first()
    if not matter:
        raise HTTPException(status_code=404, detail="Matter not found")
    if user.role == "lawyer" and matter.lawyer_id == user.id:
        return matter
    if user.role == "client" and matter.client_id == user.id:
        return matter
    raise_access_denied(db, user, request, "matter", matter_id)


def get_accessible_document(
    db: Session,
    user: User,
    document_id: int,
    request: Request | None = None,
):
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    matter = get_accessible_matter(db, user, doc.matter_id, request=request)
    return doc, matter


# S3 authorization helper
def assert_can_access_matter(user: User, matter: Matter):
    if user.id != matter.client_id and user.id != matter.lawyer_id:
        raise HTTPException(status_code=404, detail="Matter not found")


def assert_can_access_internal_notes(user: User, matter: Matter):
    assert_can_access_matter(user, matter)
    if user.role != "lawyer":
        raise HTTPException(status_code=403, detail="Internal notes are only visible to lawyers")


def serialize_note(note: MatterNote):
    return {
        "id": note.id,
        "matter_id": note.matter_id,
        "user_id": note.user_id,
        "user_name": note.user.name if note.user else None,
        "note_type": note.note_type,
        "content": note.content,
        "created_at": note.created_at.isoformat() if note.created_at else None,
    }


def create_matter_event(
    db: Session,
    matter_id: int,
    event_type: str,
    message: str,
    user_id: Optional[int] = None,
):
    event = MatterEvent(
        matter_id=matter_id,
        user_id=user_id,
        event_type=event_type,
        message=message,
    )
    db.add(event)
    return event


def serialize_event(event: MatterEvent):
    return {
        "id": event.id,
        "matter_id": event.matter_id,
        "user_id": event.user_id,
        "user_name": event.user.name if event.user else None,
        "event_type": event.event_type,
        "message": event.message,
        "created_at": event.created_at.isoformat() if event.created_at else None,
    }


def serialize_matter_message(message: MatterMessage):
    return {
        "id": message.id,
        "matter_id": message.matter_id,
        "sender_id": message.sender_id,
        "sender_name": message.sender.name if message.sender else None,
        "sender_role": message.sender.role if message.sender else None,
        "body": message.body,
        "created_at": message.created_at.isoformat() if message.created_at else None,
    }


def serialize_notification(notification: Notification):
    return {
        "id": notification.id,
        "user_id": notification.user_id,
        "type": notification.type,
        "title": notification.title,
        "body": notification.body,
        "matter_id": notification.matter_id,
        "document_id": notification.document_id,
        "message_id": notification.message_id,
        "is_read": notification.is_read,
        "created_at": notification.created_at.isoformat() if notification.created_at else None,
        "read_at": notification.read_at.isoformat() if notification.read_at else None,
    }


def create_notification(
    db: Session,
    user_id: int,
    type: str,
    title: str,
    body: str | None = None,
    matter_id: int | None = None,
    document_id: int | None = None,
    message_id: int | None = None,
):
    notification = Notification(
        user_id=user_id,
        type=type,
        title=title,
        body=body,
        matter_id=matter_id,
        document_id=document_id,
        message_id=message_id,
    )
    db.add(notification)
    return notification


def get_notification_recipient_id(user: User, matter: Matter) -> int | None:
    if user.role == "lawyer":
        return matter.client_id
    if user.role == "client":
        return matter.lawyer_id
    return None


def get_frontend_base_url() -> str:
    return os.getenv("FRONTEND_BASE_URL", DEFAULT_FRONTEND_BASE_URL).rstrip("/")


def get_secure_activity_email_cooldown_seconds() -> int:
    raw_value = os.getenv(
        "SECURE_ACTIVITY_EMAIL_COOLDOWN_SECONDS",
        str(DEFAULT_SECURE_ACTIVITY_EMAIL_COOLDOWN_SECONDS),
    )
    try:
        return max(0, int(raw_value))
    except ValueError:
        return DEFAULT_SECURE_ACTIVITY_EMAIL_COOLDOWN_SECONDS


def get_portal_activity_url(user: User, matter_id: int) -> str:
    frontend_base = get_frontend_base_url()
    if user.role == "lawyer":
        return f"{frontend_base}/portal/lawyer/inbox?matterId={matter_id}"
    if user.role == "client":
        return f"{frontend_base}/portal/client/matters/{matter_id}#messages"
    return frontend_base


def get_shared_update_url(user: User, matter_id: int) -> str:
    frontend_base = get_frontend_base_url()
    if user.role == "lawyer":
        return f"{frontend_base}/portal/lawyer/matters/{matter_id}#shared-updates"
    if user.role == "client":
        return f"{frontend_base}/portal/client/matters/{matter_id}#shared-updates"
    return frontend_base


def get_matter_recipient_for_actor(matter: Matter, actor: User, db: Session):
    if actor.role == "lawyer":
        recipient_id = matter.client_id
    elif actor.role == "client":
        recipient_id = matter.lawyer_id
    else:
        return None

    if not recipient_id:
        return None

    return db.query(User).filter(User.id == recipient_id).first()


def send_secure_activity_email(
    *,
    to_email: str,
    recipient_name: str | None,
    activity_type: str,
    portal_url: str,
):
    if not to_email:
        return

    display_name = recipient_name.strip() if recipient_name else "there"
    if not display_name:
        display_name = "there"

    safe_display_name = html.escape(display_name)
    safe_activity_type = html.escape(activity_type)
    safe_portal_url = html.escape(portal_url, quote=True)
    subject = f"{activity_type} in your Ochoa Lawyers portal"

    if activity_type == "New secure message":
        activity_copy = "You have received a new secure message in your Ochoa Lawyers portal."
        action_copy = "Please log in securely to review and respond."
    elif activity_type == "New shared update":
        activity_copy = "A new shared update has been added in your Ochoa Lawyers portal."
        action_copy = "Please log in securely to review it."
    else:
        activity_copy = "You have new secure activity in your Ochoa Lawyers portal."
        action_copy = "Please log in securely to review it."

    safe_activity_copy = html.escape(activity_copy)
    safe_action_copy = html.escape(action_copy)

    html_body = f"""
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #0f172a;">
      <h2 style="margin-bottom: 12px;">Ochoa Lawyers</h2>
      <p>Hi {safe_display_name},</p>
      <p>{safe_activity_copy}</p>
      <p>
        <strong>Activity:</strong><br />
        {safe_activity_type}
      </p>
      <p>{safe_action_copy}</p>
      <p>
        <a href="{safe_portal_url}"
           style="display: inline-block; background: #2563eb; color: white; padding: 10px 16px; border-radius: 8px; text-decoration: none;">
          Open Secure Portal
        </a>
      </p>
      <p style="font-size: 12px; color: #64748b; margin-top: 24px;">
        For your privacy, this email does not include message, update, or case details.
      </p>
    </div>
    """
    text_body = f"""
Hi {display_name},

{activity_copy}

Activity:
{activity_type}

{action_copy}
{portal_url}

For your privacy, this email does not include message, update, or case details.
"""

    send_transactional_email(
        to_email=to_email,
        subject=subject,
        html_body=html_body,
        text_body=text_body,
    )


def should_send_secure_activity_email(
    *,
    recipient_id: int,
    matter_id: int,
    email_type: str,
) -> bool:
    cooldown_seconds = get_secure_activity_email_cooldown_seconds()
    if cooldown_seconds <= 0:
        return True

    key = (recipient_id, matter_id, email_type)
    last_sent_at = _secure_activity_email_sent_at.get(key)
    if last_sent_at is None:
        return True

    return time.time() - last_sent_at >= cooldown_seconds


def mark_secure_activity_email_sent(
    *,
    recipient_id: int,
    matter_id: int,
    email_type: str,
):
    now = time.time()
    cooldown_seconds = get_secure_activity_email_cooldown_seconds()
    _secure_activity_email_sent_at[(recipient_id, matter_id, email_type)] = now

    if len(_secure_activity_email_sent_at) > 1000 and cooldown_seconds > 0:
        stale_before = now - cooldown_seconds
        stale_keys = [
            key
            for key, sent_at in _secure_activity_email_sent_at.items()
            if sent_at < stale_before
        ]
        for key in stale_keys:
            _secure_activity_email_sent_at.pop(key, None)


def send_matter_activity_email_to_recipient(
    *,
    db: Session,
    matter: Matter,
    actor: User,
    activity_type: str,
    email_type: str,
):
    try:
        recipient = get_matter_recipient_for_actor(matter, actor, db)
        if not recipient or recipient.id == actor.id:
            return
        if not recipient.email:
            return
        if not should_send_secure_activity_email(
            recipient_id=recipient.id,
            matter_id=matter.id,
            email_type=email_type,
        ):
            return

        if email_type == "message":
            portal_url = get_portal_activity_url(recipient, matter.id)
        elif email_type == "shared_update":
            portal_url = get_shared_update_url(recipient, matter.id)
        else:
            portal_url = get_frontend_base_url()

        send_secure_activity_email(
            to_email=recipient.email,
            recipient_name=recipient.name,
            activity_type=activity_type,
            portal_url=portal_url,
        )
        mark_secure_activity_email_sent(
            recipient_id=recipient.id,
            matter_id=matter.id,
            email_type=email_type,
        )
    except Exception as email_error:
        print(f"Failed to send secure activity email: {email_error}")


def _safe_content_disposition(disposition: str, filename: str) -> str:
    safe_filename = (filename or "document").replace("\\", "_").replace('"', "")
    return f'{disposition}; filename="{safe_filename}"'


def get_authorized_document_for_user(document_id: int, user: User, db: Session):
    return get_accessible_document(db, user, document_id)


def get_valid_document_access_token(token: str, db: Session):
    access = (
        db.query(DocumentAccessToken)
        .options(joinedload(DocumentAccessToken.document))
        .filter(DocumentAccessToken.token == token)
        .first()
    )
    if not access:
        raise HTTPException(status_code=404, detail="Document access token not found")

    expires_at = access.expires_at
    now = datetime.now(timezone.utc)
    if expires_at is not None and expires_at.tzinfo is None:
        now = now.replace(tzinfo=None)
    if expires_at is not None and expires_at < now:
        raise HTTPException(status_code=400, detail="Document access token expired")

    return access

@app.get("/auth/me")
def auth_me(user: User = Depends(get_current_user)):
    return user_payload(user)


@app.get("/notifications")
def list_notifications(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    notifications = (
        db.query(Notification)
        .filter(Notification.user_id == user.id)
        .order_by(Notification.created_at.desc())
        .limit(50)
        .all()
    )
    return [serialize_notification(n) for n in notifications]


@app.get("/notifications/unread-count")
def get_unread_notification_count(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    count = (
        db.query(Notification)
        .filter(
            Notification.user_id == user.id,
            Notification.is_read.is_(False),
        )
        .count()
    )
    return {"unread_count": count}


@app.patch("/notifications/{notification_id}/read")
def mark_notification_read(
    notification_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    notification = (
        db.query(Notification)
        .filter(
            Notification.id == notification_id,
            Notification.user_id == user.id,
        )
        .first()
    )
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")

    notification.is_read = True
    notification.read_at = utc_now()
    db.commit()
    db.refresh(notification)
    return serialize_notification(notification)


@app.patch("/notifications/read-all")
def mark_all_notifications_read(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    notifications = (
        db.query(Notification)
        .filter(
            Notification.user_id == user.id,
            Notification.is_read.is_(False),
        )
        .all()
    )
    now = utc_now()
    for notification in notifications:
        notification.is_read = True
        notification.read_at = now
    db.commit()
    return {"updated": len(notifications)}


@app.post("/auth/refresh")
def auth_refresh(
    request: Request,
    db: Session = Depends(get_db),
):
    session = get_session_from_refresh_cookie(request, db)
    user = db.query(User).filter(User.id == session.user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    new_access_token = build_access_token_for_user(user)
    new_refresh_token = create_refresh_token()
    new_csrf_token = create_csrf_token()

    session.refresh_token_hash = hash_token(new_refresh_token)
    session.csrf_token_hash = hash_token(new_csrf_token)
    session.last_used_at = utc_now()
    log_audit_event(db, "session_refresh", user_id=user.id, request=request)
    db.commit()

    response = JSONResponse({"message": "Session refreshed"})
    set_auth_cookies(response, new_access_token, new_refresh_token, new_csrf_token)
    return response


@app.post("/auth/logout")
def auth_logout(
    request: Request,
    db: Session = Depends(get_db),
):
    refresh_token = request.cookies.get(REFRESH_COOKIE_NAME)
    user_id = None
    if refresh_token:
        session = (
            db.query(UserSession)
            .filter(UserSession.refresh_token_hash == hash_token(refresh_token))
            .first()
        )
        if session and session.revoked_at is None:
            session.revoked_at = utc_now()
            user_id = session.user_id

    log_audit_event(db, "logout", user_id=user_id, request=request)
    db.commit()

    response = JSONResponse({"message": "Logged out"})
    clear_auth_cookies(response)
    return response


@app.get("/profile")
def profile(user: User = Depends(get_current_user)):
    return user_payload(user)

@app.get("/me")
def me(user: User = Depends(get_current_user)):
    return user_payload(user)

# Get matters for current client
@app.get("/client/matters")
def get_client_matters(user: User = Depends(get_current_user), db: Session = Depends(get_db )):
    if user.role != "client":
        raise HTTPException(status_code=403, detail="Not a client")
    
    matters = (
        db.query(Matter)
        .filter(Matter.client_id == user.id)
        .order_by(Matter.created_at.desc())
        .all()
    )

    return [
        {
            "id": m.id,
            "title": m.title,
            "status": m.status,
            "description": m.description,
            "created_at": m.created_at.isoformat() if m.created_at else None,
        }
        for m in matters
    ]

# Get matters for lawyers
@app.get("/lawyer/matters")
def get_lawyer_matters(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role != "lawyer":
        raise HTTPException(status_code=403, detail="Not a lawyer")

    matters = (
        db.query(Matter)
        .filter(Matter.lawyer_id == user.id)
        .order_by(Matter.created_at.desc())
        .all()
    )

    return [
        {
            "id": m.id,
            "title": m.title,
            "status": m.status,
            "description": m.description,
            "client_id": m.client_id,
            "created_at": m.created_at.isoformat() if m.created_at else None,
        }
        for m in matters
    ]


@app.get("/lawyer/inbox")
def get_lawyer_inbox(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role != "lawyer":
        raise HTTPException(status_code=403, detail="Only lawyers can access inbox")

    matters = (
        db.query(Matter)
        .options(joinedload(Matter.client))
        .filter(Matter.lawyer_id == user.id)
        .order_by(Matter.created_at.desc())
        .all()
    )

    inbox_items = []
    for matter in matters:
        latest_message = (
            db.query(MatterMessage)
            .options(joinedload(MatterMessage.sender))
            .filter(MatterMessage.matter_id == matter.id)
            .order_by(MatterMessage.created_at.desc())
            .first()
        )
        if not latest_message:
            continue

        inbox_items.append(
            {
                "matter_id": matter.id,
                "matter_title": matter.title,
                "matter_status": matter.status,
                "client_id": matter.client_id,
                "client_name": matter.client.name if matter.client else None,
                "latest_message_id": latest_message.id,
                "latest_message_body": latest_message.body,
                "latest_message_sender_id": latest_message.sender_id,
                "latest_message_sender_name": latest_message.sender.name
                if latest_message.sender
                else None,
                "latest_message_sender_role": latest_message.sender.role
                if latest_message.sender
                else None,
                "latest_message_created_at": latest_message.created_at.isoformat()
                if latest_message.created_at
                else None,
            }
        )

    inbox_items.sort(
        key=lambda item: item["latest_message_created_at"] or "",
        reverse=True,
    )
    return inbox_items


# (Recommended) one unified endpoint: returns matters for current user based on role
@app.get("/matters")
def get_my_matters(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    matter_query = db.query(Matter).options(
        joinedload(Matter.client),
        joinedload(Matter.lawyer),
    )

    if user.role == "lawyer":
        q = matter_query.filter(Matter.lawyer_id == user.id)
    elif user.role == "client":
        q = matter_query.filter(Matter.client_id == user.id)
    else:
        raise HTTPException(status_code=403, detail="Invalid role")

    matters = q.order_by(Matter.created_at.desc()).all()

    return [
        {
            "id": m.id,
            "title": m.title,
            "status": m.status,
            "description": m.description,
            "client_id": m.client_id,
            "lawyer_id": m.lawyer_id,
            "client_name": m.client.name if m.client else None,
            "lawyer_name": m.lawyer.name if m.lawyer else None,
            "created_at": m.created_at.isoformat() if m.created_at else None,
        }
        for m in matters
    ]

# Lawyer creates a matter for a selected client
class MatterCreate(BaseModel):
    title: str
    description: Optional[str] = None
    client_id: int


ALLOWED_MATTER_STATUSES = {"Open", "In Progress", "Waiting on Client", "Closed"}


class ClientOut(BaseModel):
    id: int
    name: str
    email: str


class MatterOut(BaseModel):
    id: int
    title: str
    status: str
    description: Optional[str]
    client_id: int
    lawyer_id: Optional[int]
    created_at: Optional[str]


class MatterUpdate(BaseModel):
    status: Optional[str] = None
    description: Optional[str] = None


class MatterNoteCreate(BaseModel):
    content: str


class MatterMessageCreate(BaseModel):
    body: str


class MatterNoteOut(BaseModel):
    id: int
    matter_id: int
    user_id: int
    user_name: Optional[str]
    note_type: str
    content: str
    created_at: Optional[str]


class MatterEventOut(BaseModel):
    id: int
    matter_id: int
    user_id: Optional[int]
    user_name: Optional[str]
    event_type: str
    message: str
    created_at: Optional[str]


class MatterMessageOut(BaseModel):
    id: int
    matter_id: int
    sender_id: int
    sender_name: Optional[str]
    sender_role: Optional[str]
    body: str
    created_at: Optional[str]


class ClientInviteCreate(BaseModel):
    name: str
    email: str


class ClientInviteAccept(BaseModel):
    token: str
    password: str


class PasswordResetRequest(BaseModel):
    email: str


class PasswordResetConfirm(BaseModel):
    token: str
    password: str

# S3 classes
class PresignUploadRequest(BaseModel):
    file_name: str
    content_type: str
    file_size: Optional[int] = None


class DocumentCompleteRequest(BaseModel):
    file_name: str
    object_key: str


class DocumentOut(BaseModel):
    id: int
    filename: str
    s3_key: str
    matter_id: int
    uploaded_by_id: int
    created_at: Optional[str]


@app.get("/lawyer/clients", response_model=list[ClientOut])
def search_clients(
    query: str = Query(..., min_length=1),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if user.role != "lawyer":
        raise HTTPException(status_code=403, detail="Not a lawyer")

    q = query.strip()
    if not q:
        return []

    results = (
        db.query(User)
        .filter(User.role == "client")
        .filter(
            or_(
                User.name.ilike(f"%{q}%"),
                User.email.ilike(f"%{q}%"),
            )
        )
        .order_by(User.name.asc())
        .limit(10)
        .all()
    )

    return [{"id": u.id, "name": u.name, "email": u.email} for u in results]


@app.post("/lawyer/invitations", status_code=201)
def create_client_invitation(
    body: ClientInviteCreate,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    enforce_rate_limit(request, "invite")

    if user.role != "lawyer":
        raise HTTPException(status_code=403, detail="Only lawyers can invite clients")

    email = body.email.strip().lower()
    name = body.name.strip()

    if not email or not name:
        raise HTTPException(status_code=400, detail="Name and email are required")

    existing_user = db.query(User).filter(User.email == email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="A user with this email already exists")

    token = token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)

    invitation = ClientInvitation(
        name=name,
        email=email,
        token=token,
        invited_by_user_id=user.id,
        expires_at=expires_at,
    )

    db.add(invitation)
    db.flush()
    log_audit_event(
        db,
        "invitation_sent",
        user_id=user.id,
        resource_type="client_invitation",
        resource_id=invitation.id,
        request=request,
        metadata={"email": email},
    )
    db.commit()
    db.refresh(invitation)

    frontend_base = os.getenv("FRONTEND_BASE_URL", "http://localhost:3000").rstrip("/")
    invite_link = f"{frontend_base}/portal/accept-invite?token={token}"

    send_transactional_email(
        to_email=email,
        subject="You have been invited to Ochoa Lawyers Portal",
        html_body=f"""
            <h2>You have been invited</h2>
            <p>Hello {name},</p>
            <p>You have been invited to access the Ochoa Lawyers client portal.</p>
            <p><a href="{invite_link}">Click here to set your password and access your portal</a></p>
            <p>This link expires in 7 days.</p>
        """,
        text_body=(
            f"Hello {name},\n\n"
            f"You have been invited to access the Ochoa Lawyers client portal.\n\n"
            f"Use this link to set your password:\n{invite_link}\n\n"
            f"This link expires in 7 days."
        ),
    )

    return {
        "id": invitation.id,
        "email": invitation.email,
        "expires_at": invitation.expires_at.isoformat(),
    }


@app.get("/invitations/{token}")
def get_invitation(token: str, db: Session = Depends(get_db)):
    invitation = db.query(ClientInvitation).filter(ClientInvitation.token == token).first()
    if not invitation:
        raise HTTPException(status_code=404, detail="Invitation not found")

    if invitation.accepted_at is not None:
        raise HTTPException(status_code=400, detail="Invitation has already been accepted")

    if invitation.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Invitation has expired")

    return {
        "name": invitation.name,
        "email": invitation.email,
        "expires_at": invitation.expires_at.isoformat(),
    }


@app.post("/invitations/accept", status_code=201)
def accept_client_invitation(
    body: ClientInviteAccept,
    request: Request,
    db: Session = Depends(get_db),
):
    invitation = db.query(ClientInvitation).filter(ClientInvitation.token == body.token).first()
    if not invitation:
        raise HTTPException(status_code=404, detail="Invitation not found")

    if invitation.accepted_at is not None:
        raise HTTPException(status_code=400, detail="Invitation has already been accepted")

    if invitation.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Invitation has expired")

    existing_user = db.query(User).filter(User.email == invitation.email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="A user with this email already exists")

    user = User(
        name=invitation.name,
        email=invitation.email,
        password_hash=hash_password(body.password),
        role="client",
    )
    db.add(user)
    db.flush()

    invitation.accepted_at = datetime.now(timezone.utc)

    access_token = build_access_token_for_user(user)
    refresh_token, csrf_token, _session = create_session_for_user(user, request, db)
    log_audit_event(
        db,
        "invitation_accepted",
        user_id=user.id,
        resource_type="client_invitation",
        resource_id=invitation.id,
        request=request,
    )

    db.commit()
    db.refresh(user)

    response = JSONResponse(
        {
            "message": "Invitation accepted",
            "user": user_payload(user),
        },
        status_code=201,
    )
    set_auth_cookies(response, access_token, refresh_token, csrf_token)
    return response


@app.post("/password-reset/request")
def request_password_reset(
    body: PasswordResetRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    enforce_rate_limit(request, "password_reset")
    email = body.email.strip().lower()

    # Always return success shape to avoid leaking whether email exists.
    user = db.query(User).filter(User.email == email).first()
    if not user:
        log_audit_event(
            db,
            "password_reset_requested",
            request=request,
            metadata={"email": email, "user_found": False},
        )
        db.commit()
        return {"message": "If that email exists, a reset link has been sent."}

    token = token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(hours=1)

    reset_token = PasswordResetToken(
        user_id=user.id,
        token=token,
        expires_at=expires_at,
    )
    db.add(reset_token)
    log_audit_event(
        db,
        "password_reset_requested",
        user_id=user.id,
        request=request,
        metadata={"email": email, "user_found": True},
    )
    db.commit()
    db.refresh(reset_token)

    frontend_base = os.getenv("FRONTEND_BASE_URL", "http://localhost:3000").rstrip("/")
    reset_link = f"{frontend_base}/reset-password?token={token}"

    try:
        send_transactional_email(
            to_email=user.email,
            subject="Reset your Ochoa Lawyers portal password",
            html_body=f"""
                <h2>Password Reset</h2>
                <p>Hello {user.name},</p>
                <p>We received a request to reset your password.</p>
                <p><a href="{reset_link}">Click here to reset your password</a></p>
                <p>This link expires in 1 hour.</p>
                <p>If you did not request this, you can ignore this email.</p>
            """,
            text_body=(
                f"Hello {user.name},\n\n"
                f"We received a request to reset your password.\n\n"
                f"Use this link to reset it:\n{reset_link}\n\n"
                f"This link expires in 1 hour.\n\n"
                f"If you did not request this, you can ignore this email."
            ),
        )
    except Exception as email_error:
        print(f"Password reset email failed: {email_error}")

    return {"message": "If that email exists, a reset link has been sent."}


@app.get("/password-reset/{token}")
def get_password_reset_token(token: str, db: Session = Depends(get_db)):
    reset_token = (
        db.query(PasswordResetToken)
        .options(joinedload(PasswordResetToken.user))
        .filter(PasswordResetToken.token == token)
        .first()
    )
    if not reset_token:
        raise HTTPException(status_code=404, detail="Reset token not found")

    if reset_token.used_at is not None:
        raise HTTPException(status_code=400, detail="Reset token has already been used")

    if reset_token.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Reset token has expired")

    return {
        "email": reset_token.user.email if reset_token.user else None,
        "expires_at": reset_token.expires_at.isoformat(),
    }


@app.post("/password-reset/confirm")
def confirm_password_reset(
    body: PasswordResetConfirm,
    request: Request,
    db: Session = Depends(get_db),
):
    reset_token = (
        db.query(PasswordResetToken)
        .options(joinedload(PasswordResetToken.user))
        .filter(PasswordResetToken.token == body.token)
        .first()
    )
    if not reset_token:
        raise HTTPException(status_code=404, detail="Reset token not found")

    if reset_token.used_at is not None:
        raise HTTPException(status_code=400, detail="Reset token has already been used")

    if reset_token.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Reset token has expired")

    user = reset_token.user
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.password_hash = hash_password(body.password)
    reset_token.used_at = datetime.now(timezone.utc)
    log_audit_event(db, "password_reset_completed", user_id=user.id, request=request)

    db.commit()

    return {"message": "Password reset successful"}

@app.post("/matters", status_code=201)
def create_matter(
    payload: MatterCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if user.role != "lawyer":
        raise HTTPException(status_code=403, detail="Only lawyers can create matters.")

    client = (
        db.query(User)
        .filter(User.id == payload.client_id, User.role == "client")
        .first()
    )
    if not client:
        raise HTTPException(status_code=404, detail="Client not found.")

    matter = Matter(
        title=payload.title.strip(),
        description=(payload.description.strip() if payload.description else None),
        status="Open",
        client_id=client.id,
        lawyer_id=user.id,
    )
    db.add(matter)
    db.flush()  # assign matter.id without committing the transaction

    create_matter_event(
        db=db,
        matter_id=matter.id,
        event_type="matter_created",
        message=f"Matter created by {user.name}.",
        user_id=user.id,
    )

    db.commit()
    db.refresh(matter)

    return {
        "id": matter.id,
        "title": matter.title,
        "status": matter.status,
        "description": matter.description,
        "client_id": matter.client_id,
        "lawyer_id": matter.lawyer_id,
        "client_name": client.name,
        "lawyer_name": user.name,
        "created_at": matter.created_at.isoformat() if matter.created_at else None,
    }

# presign endpoint
@app.post("/matters/{matter_id}/uploads/presign")
def presign_matter_upload(
    matter_id: int,
    body: PresignUploadRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    enforce_rate_limit(request, "upload_presign")

    if not S3_BUCKET_NAME:
        raise HTTPException(status_code=500, detail="S3 bucket is not configured")

    get_accessible_matter(db, user, matter_id, request=request)

    safe_name = validate_document_file(body.file_name, body.content_type, body.file_size)
    key = f"{S3_UPLOAD_PREFIX}/matter-{matter_id}/{uuid4()}-{safe_name}"

    try:
        upload_url = s3_client.generate_presigned_url(
            "put_object",
            Params={
                "Bucket": S3_BUCKET_NAME,
                "Key": key,
                "ContentType": body.content_type,
            },
            ExpiresIn=PRESIGNED_EXPIRATION,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not presign upload: {str(e)}")

    return {"upload_url": upload_url, "object_key": key}

# create a document record after upload completes
@app.post("/matters/{matter_id}/documents", status_code=201)
def create_document(
    matter_id: int,
    body: DocumentCompleteRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not S3_BUCKET_NAME:
        raise HTTPException(status_code=500, detail="S3 bucket is not configured")

    matter = get_accessible_matter(db, user, matter_id, request=request)

    expected_prefix = f"{S3_UPLOAD_PREFIX}/matter-{matter_id}/"
    if not body.object_key.startswith(expected_prefix):
        raise HTTPException(status_code=400, detail="Invalid object_key for this matter")

    safe_name = sanitize_filename(body.file_name)
    try:
        object_meta = s3_client.head_object(Bucket=S3_BUCKET_NAME, Key=body.object_key)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Uploaded file could not be verified: {str(e)}")

    content_type = object_meta.get("ContentType") or "application/octet-stream"
    validate_document_file(safe_name, content_type, object_meta.get("ContentLength"))

    doc = Document(
        matter_id=matter_id,
        filename=safe_name,
        s3_key=body.object_key,
        uploaded_by_id=user.id,
    )
    db.add(doc)
    db.flush()

    create_matter_event(
        db=db,
        matter_id=matter_id,
        event_type="document_uploaded",
        message=f"{user.name} uploaded document {doc.filename}.",
        user_id=user.id,
    )
    recipient_id = get_notification_recipient_id(user, matter)
    if recipient_id and recipient_id != user.id:
        create_notification(
            db=db,
            user_id=recipient_id,
            type="document_uploaded",
            title="New document uploaded",
            body=f"{doc.filename} was uploaded to {matter.title}.",
            matter_id=matter.id,
            document_id=doc.id,
        )
    log_audit_event(
        db,
        "document_uploaded",
        user_id=user.id,
        resource_type="document",
        resource_id=doc.id,
        request=request,
        metadata={"matter_id": matter_id, "filename": doc.filename},
    )

    db.commit()
    db.refresh(doc)

    return {
        "id": doc.id,
        "filename": doc.filename,
        "s3_key": doc.s3_key,
        "matter_id": doc.matter_id,
        "uploaded_by_id": doc.uploaded_by_id,
        "created_at": doc.created_at.isoformat() if doc.created_at else None,
    }

# List documents for a matter
@app.get("/matters/{matter_id}/documents")
def list_documents(
    matter_id: int,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    get_accessible_matter(db, user, matter_id, request=request)

    docs = (
        db.query(Document)
        .filter(Document.matter_id == matter_id)
        .order_by(Document.created_at.desc())
        .all()
    )

    return [
        {
            "id": d.id,
            "filename": d.filename,
            "s3_key": d.s3_key,
            "matter_id": d.matter_id,
            "uploaded_by_id": d.uploaded_by_id,
            "created_at": d.created_at.isoformat() if d.created_at else None,
        }
        for d in docs
    ]


@app.post("/documents/{document_id}/access-links")
def create_document_access_links(
    document_id: int,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not S3_BUCKET_NAME:
        raise HTTPException(status_code=500, detail="S3 bucket is not configured")

    doc, _matter = get_accessible_document(db, user, document_id, request=request)
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)

    api_base = os.getenv("API_BASE_URL", "").strip().rstrip("/")
    if not api_base:
        api_base = str(request.base_url).rstrip("/")

    return {
        "content_url": f"{api_base}/documents/{doc.id}/content",
        "download_url": f"{api_base}/documents/{doc.id}/download",
        "expires_at": expires_at.isoformat(),
        "filename": doc.filename,
    }


def stream_document_from_s3(doc: Document, disposition: str):
    if not S3_BUCKET_NAME:
        raise HTTPException(status_code=500, detail="S3 bucket is not configured")

    try:
        s3_response = s3_client.get_object(
            Bucket=S3_BUCKET_NAME,
            Key=doc.s3_key,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not fetch document: {str(e)}")

    content_type = s3_response.get("ContentType") or "application/octet-stream"

    return StreamingResponse(
        s3_response["Body"],
        media_type=content_type,
        headers={
            "Content-Disposition": _safe_content_disposition(disposition, doc.filename),
            "Cache-Control": "private, max-age=300",
        },
    )


@app.get("/documents/{document_id}/content")
def serve_document_content(
    document_id: int,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    doc, _matter = get_accessible_document(db, user, document_id, request=request)
    log_audit_event(
        db,
        "document_previewed",
        user_id=user.id,
        resource_type="document",
        resource_id=doc.id,
        request=request,
    )
    db.commit()
    return stream_document_from_s3(doc, "inline")


@app.get("/documents/{document_id}/download")
def serve_document_download(
    document_id: int,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    doc, _matter = get_accessible_document(db, user, document_id, request=request)
    log_audit_event(
        db,
        "document_downloaded",
        user_id=user.id,
        resource_type="document",
        resource_id=doc.id,
        request=request,
    )
    db.commit()
    return stream_document_from_s3(doc, "attachment")


@app.get("/documents/access/{token}/content")
def serve_legacy_document_content(
    token: str,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    access = get_valid_document_access_token(token, db)
    if access.user_id != user.id:
        raise_access_denied(db, user, request, "document", access.document_id)

    doc = access.document
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    get_accessible_document(db, user, doc.id, request=request)
    return stream_document_from_s3(doc, "inline")


@app.get("/documents/access/{token}/download")
def serve_legacy_document_download(
    token: str,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    access = get_valid_document_access_token(token, db)
    if access.user_id != user.id:
        raise_access_denied(db, user, request, "document", access.document_id)

    doc = access.document
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    get_accessible_document(db, user, doc.id, request=request)
    return stream_document_from_s3(doc, "attachment")


@app.get("/matters/{matter_id}", response_model=MatterOut)
def get_matter(
    matter_id: int,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    matter = get_accessible_matter(db, user, matter_id, request=request)

    return {
        "id": matter.id,
        "title": matter.title,
        "status": matter.status,
        "description": matter.description,
        "client_id": matter.client_id,
        "lawyer_id": matter.lawyer_id,
        "created_at": matter.created_at.isoformat() if matter.created_at else None,
    }


@app.patch("/matters/{matter_id}", response_model=MatterOut)
def update_matter(
    matter_id: int,
    body: MatterUpdate,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    matter = get_accessible_matter(db, user, matter_id, request=request)

    # MVP rule: only the assigned lawyer can edit matter status/description.
    if user.role != "lawyer" or user.id != matter.lawyer_id:
        raise HTTPException(
            status_code=403,
            detail="Only the assigned lawyer can update this matter",
        )

    old_status = matter.status
    old_description = matter.description or ""

    if body.status is not None:
        status_value = body.status.strip()
        if status_value not in ALLOWED_MATTER_STATUSES:
            raise HTTPException(status_code=400, detail="Invalid status")
        matter.status = status_value

    if body.description is not None:
        description_value = body.description.strip()
        matter.description = description_value if description_value else None

    new_description = matter.description or ""

    if body.status is not None and old_status != matter.status:
        create_matter_event(
            db=db,
            matter_id=matter.id,
            event_type="status_changed",
            message=f"Status changed from {old_status} to {matter.status}.",
            user_id=user.id,
        )

    if body.description is not None and old_description != new_description:
        create_matter_event(
            db=db,
            matter_id=matter.id,
            event_type="description_changed",
            message=f"{user.name} updated the matter description.",
            user_id=user.id,
        )

    db.add(matter)
    db.commit()
    db.refresh(matter)

    return {
        "id": matter.id,
        "title": matter.title,
        "status": matter.status,
        "description": matter.description,
        "client_id": matter.client_id,
        "lawyer_id": matter.lawyer_id,
        "created_at": matter.created_at.isoformat() if matter.created_at else None,
    }


@app.get("/matters/{matter_id}/events", response_model=list[MatterEventOut])
def list_matter_events(
    matter_id: int,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    get_accessible_matter(db, user, matter_id, request=request)

    query = (
        db.query(MatterEvent)
        .options(joinedload(MatterEvent.user))
        .filter(MatterEvent.matter_id == matter_id)
    )

    if user.role == "client":
        query = query.filter(MatterEvent.event_type != "internal_note_added")

    events = query.order_by(MatterEvent.created_at.desc()).all()

    return [serialize_event(e) for e in events]


@app.get("/matters/{matter_id}/messages", response_model=list[MatterMessageOut])
def list_matter_messages(
    matter_id: int,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    matter = get_accessible_matter(db, user, matter_id, request=request)

    messages = (
        db.query(MatterMessage)
        .options(joinedload(MatterMessage.sender))
        .filter(MatterMessage.matter_id == matter.id)
        .order_by(MatterMessage.created_at.asc())
        .all()
    )

    return [serialize_matter_message(m) for m in messages]


@app.post("/matters/{matter_id}/messages", status_code=201, response_model=MatterMessageOut)
def create_matter_message(
    matter_id: int,
    body: MatterMessageCreate,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    matter = get_accessible_matter(db, user, matter_id, request=request)

    message_body = body.body.strip()
    if not message_body:
        raise HTTPException(status_code=400, detail="Message cannot be empty")
    if len(message_body) > 5000:
        raise HTTPException(status_code=400, detail="Message is too long")

    message = MatterMessage(
        matter_id=matter.id,
        sender_id=user.id,
        body=message_body,
    )
    db.add(message)
    db.flush()

    create_matter_event(
        db=db,
        matter_id=matter.id,
        event_type="message_sent",
        message=f"{user.name} sent a message.",
        user_id=user.id,
    )
    recipient_id = get_notification_recipient_id(user, matter)
    if recipient_id and recipient_id != user.id:
        create_notification(
            db=db,
            user_id=recipient_id,
            type="new_message",
            title=f"New message from {user.name}",
            body=matter.title,
            matter_id=matter.id,
            message_id=message.id,
        )
    log_audit_event(
        db=db,
        event_type="matter_message_sent",
        user_id=user.id,
        resource_type="matter",
        resource_id=matter.id,
        request=request,
        metadata={"message_id": message.id},
    )

    db.commit()
    db.refresh(message)

    send_matter_activity_email_to_recipient(
        db=db,
        matter=matter,
        actor=user,
        activity_type="New secure message",
        email_type="message",
    )

    return serialize_matter_message(message)


@app.get("/matters/{matter_id}/internal-notes", response_model=list[MatterNoteOut])
def list_internal_notes(
    matter_id: int,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    matter = get_accessible_matter(db, user, matter_id, request=request)
    assert_can_access_internal_notes(user, matter)

    notes = (
        db.query(MatterNote)
        .options(joinedload(MatterNote.user))
        .filter(
            MatterNote.matter_id == matter_id,
            MatterNote.note_type == "internal",
        )
        .order_by(MatterNote.created_at.desc())
        .all()
    )

    return [serialize_note(n) for n in notes]


@app.post("/matters/{matter_id}/internal-notes", status_code=201, response_model=MatterNoteOut)
def create_internal_note(
    matter_id: int,
    body: MatterNoteCreate,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    matter = get_accessible_matter(db, user, matter_id, request=request)
    assert_can_access_internal_notes(user, matter)

    content = body.content.strip()
    if not content:
        raise HTTPException(status_code=400, detail="Note content is required")

    note = MatterNote(
        matter_id=matter_id,
        user_id=user.id,
        note_type="internal",
        content=content,
    )

    db.add(note)

    create_matter_event(
        db=db,
        matter_id=matter_id,
        event_type="internal_note_added",
        message=f"{user.name} added an internal note.",
        user_id=user.id,
    )

    db.commit()
    db.refresh(note)

    return serialize_note(note)


@app.get("/matters/{matter_id}/shared-updates", response_model=list[MatterNoteOut])
def list_shared_updates(
    matter_id: int,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    get_accessible_matter(db, user, matter_id, request=request)

    notes = (
        db.query(MatterNote)
        .options(joinedload(MatterNote.user))
        .filter(
            MatterNote.matter_id == matter_id,
            MatterNote.note_type == "shared",
        )
        .order_by(MatterNote.created_at.desc())
        .all()
    )

    return [serialize_note(n) for n in notes]


@app.post("/matters/{matter_id}/shared-updates", status_code=201, response_model=MatterNoteOut)
def create_shared_update(
    matter_id: int,
    body: MatterNoteCreate,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    matter = get_accessible_matter(db, user, matter_id, request=request)

    content = body.content.strip()
    if not content:
        raise HTTPException(status_code=400, detail="Note content is required")

    note = MatterNote(
        matter_id=matter_id,
        user_id=user.id,
        note_type="shared",
        content=content,
    )

    db.add(note)

    create_matter_event(
        db=db,
        matter_id=matter_id,
        event_type="shared_update_added",
        message=f"{user.name} added a shared update.",
        user_id=user.id,
    )
    recipient_id = get_notification_recipient_id(user, matter)
    if recipient_id and recipient_id != user.id:
        create_notification(
            db=db,
            user_id=recipient_id,
            type="shared_update_added",
            title="New shared update",
            body=f"A new update was added to {matter.title}.",
            matter_id=matter.id,
        )

    db.commit()
    db.refresh(note)

    send_matter_activity_email_to_recipient(
        db=db,
        matter=matter,
        actor=user,
        activity_type="New shared update",
        email_type="shared_update",
    )

    return serialize_note(note)

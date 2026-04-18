from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from secrets import token_urlsafe
from typing import Optional

from fastapi import FastAPI, Form, Depends, HTTPException, status, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse, StreamingResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import text, or_

from database import SessionLocal, engine
from models import (
    Base,
    ClientInvitation,
    ContactSubmission,
    Document,
    DocumentAccessToken,
    Matter,
    MatterEvent,
    MatterNote,
    PasswordResetToken,
    User,
)
from email_service import send_transactional_email

from auth_utils import hash_password, verify_password, create_access_token, decode_access_token

from pydantic import BaseModel

import os
from uuid import uuid4

import boto3


ALLOWED_ORIGINS = [
    "https://ochoalaw.vercel.app", 
    "http://localhost:3000",
    "https://ochoalawyers.com",
    "https://www.ochoalawyers.com"
    ]

MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024  # 25MB FILE SIZE LIMIT

ALLOWED_CONTENT_TYPES = {
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "image/jpeg",
    "image/png",
}

DISALLOWED_EXTENSIONS = {".exe", ".bat", ".sh", ".js"}

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

# login
@app.post("/login")
def login(
    email: str = Form(...),
    password: str = Form(...),
    db: Session = Depends(get_db)
):
    # FIXED — Correct SQLAlchemy query
    user = db.query(User).filter(User.email == email.strip().lower()).first()

    if not user or not verify_password(password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    # FIXED — Correct dict for JWT
    access_token = create_access_token({
        "sub": str(user.id),
        "email": user.email,
        "role": user.role
    })

    return {"access_token": access_token, "token_type": "bearer"}


security = HTTPBearer(auto_error=False)
def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db)
):
    # Require a Bearer token
    if not credentials or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="Not authenticated")

    # Verifies the JWT from the authorization header, loads the current user from the db or raises 401
    token = credentials.credentials # bearer token
    payload = decode_access_token(token) # verify signature and expiration

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token payload")
    
    user = db.query(User).filter(User.id == int(user_id)).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user

# S3 authorization helper
def assert_can_access_matter(user: User, matter: Matter):
    # Lawyer or client assigned to this matter can access
    if user.id != matter.client_id and user.id != matter.lawyer_id:
        raise HTTPException(status_code=403, detail="Not authorized for this matter")


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


def _safe_content_disposition(disposition: str, filename: str) -> str:
    safe_filename = (filename or "document").replace("\\", "_").replace('"', "")
    return f'{disposition}; filename="{safe_filename}"'


def get_authorized_document_for_user(document_id: int, user: User, db: Session):
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    matter = db.query(Matter).filter(Matter.id == doc.matter_id).first()
    if not matter:
        raise HTTPException(status_code=404, detail="Matter not found")

    assert_can_access_matter(user, matter)
    return doc, matter


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

@app.get("/profile")
def profile(user: User = Depends(get_current_user)):
    return {
        "id": user.id,
        "email": user.email,
        "role": user.role,
    }

@app.get("/me")
def me(user: User = Depends(get_current_user)):
    return {"id": user.id, "email": user.email, "role": user.role}

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
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
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

    db.commit()
    db.refresh(user)

    access_token = create_access_token(
        {
            "sub": str(user.id),
            "email": user.email,
            "role": user.role,
        }
    )

    return {
        "message": "Invitation accepted",
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "email": user.email,
            "role": user.role,
            "name": user.name,
        },
    }


@app.post("/password-reset/request")
def request_password_reset(
    body: PasswordResetRequest,
    db: Session = Depends(get_db),
):
    email = body.email.strip().lower()

    # Always return success shape to avoid leaking whether email exists.
    user = db.query(User).filter(User.email == email).first()
    if not user:
        return {"message": "If that email exists, a reset link has been sent."}

    token = token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(hours=1)

    reset_token = PasswordResetToken(
        user_id=user.id,
        token=token,
        expires_at=expires_at,
    )
    db.add(reset_token)
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
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not S3_BUCKET_NAME:
        raise HTTPException(status_code=500, detail="S3 bucket is not configured")

    matter = db.query(Matter).filter(Matter.id == matter_id).first()
    if not matter:
        raise HTTPException(status_code=404, detail="Matter not found")

    assert_can_access_matter(user, matter)

    # File Rules
    ext = os.path.splitext(body.file_name)[1].lower()

    if ext in DISALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="File Type not allowed")
    
    if body.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(status_code=400, detail="Unsupported file type")

    safe_name = body.file_name.replace(" ", "_")
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
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    matter = db.query(Matter).filter(Matter.id == matter_id).first()
    if not matter:
        raise HTTPException(status_code=404, detail="Matter not found")

    assert_can_access_matter(user, matter)

    expected_prefix = f"{S3_UPLOAD_PREFIX}/matter-{matter_id}/"
    if not body.object_key.startswith(expected_prefix):
        raise HTTPException(status_code=400, detail="Invalid object_key for this matter")

    doc = Document(
        matter_id=matter_id,
        filename=body.file_name,
        s3_key=body.object_key,
        uploaded_by_id=user.id,
    )
    db.add(doc)

    create_matter_event(
        db=db,
        matter_id=matter_id,
        event_type="document_uploaded",
        message=f"{user.name} uploaded document {doc.filename}.",
        user_id=user.id,
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
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    matter = db.query(Matter).filter(Matter.id == matter_id).first()
    if not matter:
        raise HTTPException(status_code=404, detail="Matter not found")

    assert_can_access_matter(user, matter)

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

    doc, _matter = get_authorized_document_for_user(document_id, user, db)

    token = token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)

    access = DocumentAccessToken(
        document_id=doc.id,
        user_id=user.id,
        token=token,
        expires_at=expires_at,
    )
    db.add(access)
    db.commit()

    api_base = os.getenv("API_BASE_URL", "").strip().rstrip("/")
    if not api_base:
        api_base = str(request.base_url).rstrip("/")

    return {
        "content_url": f"{api_base}/documents/access/{token}/content",
        "download_url": f"{api_base}/documents/access/{token}/download",
        "expires_at": expires_at.isoformat(),
        "filename": doc.filename,
    }


@app.get("/documents/access/{token}/content")
def serve_document_content(token: str, db: Session = Depends(get_db)):
    if not S3_BUCKET_NAME:
        raise HTTPException(status_code=500, detail="S3 bucket is not configured")

    access = get_valid_document_access_token(token, db)

    doc = access.document
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

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
            "Content-Disposition": _safe_content_disposition("inline", doc.filename),
            "Cache-Control": "private, max-age=300",
        },
    )


@app.get("/documents/access/{token}/download")
def serve_document_download(token: str, db: Session = Depends(get_db)):
    if not S3_BUCKET_NAME:
        raise HTTPException(status_code=500, detail="S3 bucket is not configured")

    access = get_valid_document_access_token(token, db)

    doc = access.document
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

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
            "Content-Disposition": _safe_content_disposition("attachment", doc.filename),
            "Cache-Control": "private, max-age=300",
        },
    )


@app.get("/matters/{matter_id}", response_model=MatterOut)
def get_matter(
    matter_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    matter = db.query(Matter).filter(Matter.id == matter_id).first()
    if not matter:
        raise HTTPException(status_code=404, detail="Matter not found")

    assert_can_access_matter(user, matter)

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
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    matter = db.query(Matter).filter(Matter.id == matter_id).first()
    if not matter:
        raise HTTPException(status_code=404, detail="Matter not found")

    assert_can_access_matter(user, matter)

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
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    matter = db.query(Matter).filter(Matter.id == matter_id).first()
    if not matter:
        raise HTTPException(status_code=404, detail="Matter not found")

    assert_can_access_matter(user, matter)

    query = (
        db.query(MatterEvent)
        .options(joinedload(MatterEvent.user))
        .filter(MatterEvent.matter_id == matter_id)
    )

    if user.role == "client":
        query = query.filter(MatterEvent.event_type != "internal_note_added")

    events = query.order_by(MatterEvent.created_at.desc()).all()

    return [serialize_event(e) for e in events]


@app.get("/matters/{matter_id}/internal-notes", response_model=list[MatterNoteOut])
def list_internal_notes(
    matter_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    matter = db.query(Matter).filter(Matter.id == matter_id).first()
    if not matter:
        raise HTTPException(status_code=404, detail="Matter not found")

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
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    matter = db.query(Matter).filter(Matter.id == matter_id).first()
    if not matter:
        raise HTTPException(status_code=404, detail="Matter not found")

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
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    matter = db.query(Matter).filter(Matter.id == matter_id).first()
    if not matter:
        raise HTTPException(status_code=404, detail="Matter not found")

    assert_can_access_matter(user, matter)

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
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    matter = db.query(Matter).filter(Matter.id == matter_id).first()
    if not matter:
        raise HTTPException(status_code=404, detail="Matter not found")

    assert_can_access_matter(user, matter)

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

    db.commit()
    db.refresh(note)

    return serialize_note(note)

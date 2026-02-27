from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, Form, Depends, HTTPException, status, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from sqlalchemy import text, or_

from database import SessionLocal, engine
from models import Base, ContactSubmission, User, Matter, Document 

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
    if user.role == "lawyer":
        q = db.query(Matter).filter(Matter.lawyer_id == user.id)
    elif user.role == "client":
        q = db.query(Matter).filter(Matter.client_id == user.id)
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
            "created_at": m.created_at.isoformat() if m.created_at else None,
        }
        for m in matters
    ]

# Lawyer creates a matter for a selected client
class MatterCreate(BaseModel):
    title: str
    description: Optional[str] = None
    client_id: int


class ClientOut(BaseModel):
    id: int
    name: str
    email: str

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

@app.get("/documents/{document_id}/download")
def download_document(
    document_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not S3_BUCKET_NAME:
        raise HTTPException(status_code=500, detail="S3 bucket is not configured")

    # 1) Fetch document
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # 2) Fetch matter + authorization check
    matter = db.query(Matter).filter(Matter.id == doc.matter_id).first()
    if not matter:
        raise HTTPException(status_code=404, detail="Matter not found")

    assert_can_access_matter(user, matter)

    # 3) Presign GET
    try:
        download_url = s3_client.generate_presigned_url(
            "get_object",
            Params={
                "Bucket": S3_BUCKET_NAME,
                "Key": doc.s3_key,
                # optional: force download (instead of open in browser)
                # "ResponseContentDisposition": f'attachment; filename="{doc.filename}"'
            },
            ExpiresIn=PRESIGNED_EXPIRATION,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not presign download: {str(e)}")

    return {"download_url": download_url}


@app.get("/matters/{matter_id}")
def get_matter_detail(
    matter_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    matter = db.query(Matter).filter(Matter.id == matter_id).first()
    if not matter:
        raise HTTPException(status_code=404, detail="Matter not found")

    assert_can_access_matter(user, matter)

    documents = (
        db.query(Document)
        .filter(Document.matter_id == matter_id)
        .order_by(Document.created_at.desc())
        .all()
    )

    return {
        "matter": {
            "id": matter.id,
            "title": matter.title,
            "description": matter.description,
            "status": matter.status,
            "client_id": matter.client_id,
            "lawyer_id": matter.lawyer_id,
            "created_at": matter.created_at.isoformat() if matter.created_at else None,
        },
        "documents": [
            {
                "id": d.id,
                "filename": d.filename,
                "s3_key": d.s3_key,
                "uploaded_by_id": d.uploaded_by_id,
                "created_at": d.created_at.isoformat() if d.created_at else None,
            }
            for d in documents
        ],
    }

from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, Form, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from sqlalchemy import text

from database import SessionLocal, engine
from models import ContactSubmission, Base

from auth_utils import hash_password, verify_password, create_access_token, decode_access_token
from models import User
from models import Matter


ALLOWED_ORIGINS = [
    "https://ochoalaw.vercel.app", 
    "http://localhost:3000"
    ]

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
    
app = FastAPI(title="Ochoa & Company", version="1.0.0", lifespan=lifespan,)

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

@app.get("/profile")
def profile(user: User = Depends(get_current_user)):
    return {
        "id": user.id,
        "email": user.email,
        "role": user.role,
    }

@app.get("/me")
def me(User: User = Depends(get_current_user)):
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
        .order(Matters.created_at.desc())
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

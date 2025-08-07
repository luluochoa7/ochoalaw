from fastapi import FastAPI, Form, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from database import SessionLocal
from models import ContactSubmission


app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://ochoalaw.vercel.app"],  # Update with actual frontend domain in production,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.get("/")
def root():
    return {"message": "API is running"}

@app.get("/test-db")
def test_db(db: Session = Depends(get_db)):
    try:
        db.execute("SELECT 1")
        return {"message": "DB connection successful"}
    except Exception as e:
        return {"error": str(e)}

@app.post("/contact")
def contact(
    name: str = Form(...),
    email: str = Form(...),
    phone: str = Form(None),  # Optional field
    message: str = Form(...),
    db: Session = Depends(get_db)
):
    submission = ContactSubmission(name=name, email=email, phone=phone, message=message)
    db.add(submission)
    db.commit()
    db.refresh(submission)
    print("🔥 Contact received:", name, email, phone, message)
    return {"message": "Saved to Supabase"}


from fastapi import FastAPI, Form
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://ochoalaw.vercel.app"],  # Update with actual frontend domain in production,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# @app.get("/")
# def read_root():
#     return {"Hello": "World"}   

@app.post("/contact-us")
def contact_us(
    name: str = Form(...),
    email: str = Form(...),
    phone: str = Form(None),  # Optional field
    message: str = Form(...)
):
    # Process the form data here
    # For example, log the data or send an email
    return {"status": "success", "message": "Thank you for contacting us!"}

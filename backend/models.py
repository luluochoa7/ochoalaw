from sqlalchemy import Column, Integer, String, Text, DateTime, func
from sqlalchemy.ext.declarative import declarative_base     

Base = declarative_base()

class ContactSubmission(Base):
    __tablename__ = "contact_submissions"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, nullable=False)
    phone = Column(String, nullable=True)
    message = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), default=func.now())   
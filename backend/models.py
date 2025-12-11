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

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)
    role = Column(String, default='client')
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Matter(Base):
    __tablename__ = "matters"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    status = Column(String(50), nullable=False, default="open")
    description = Column(String(1000), nullable=True)

    client_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    lawyer_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    client = relationship("User", foreign_keys=[client_id], backref="client_matters")
    lawyer = relationship("User", foreign_keys=[lawyer.id], backref="lawyer_matters")
    
    
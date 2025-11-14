# backend/auth_utils.py
import os
from datetime import datetime, timedelta

from passlib.context import CryptContext
import jwt
from fastapi import HTTPException, status

# Use a strong default, but prefer environment variable in production
JWT_SECRET = os.getenv("JWT_SECRET", "dev-secret")  # set this in Render later
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

# IMPORTANT: use pbkdf2_sha256 instead of bcrypt to avoid backend issues
pwd_context = CryptContext(
    schemes=["pbkdf2_sha256"],
    deprecated="auto",
)

def hash_password(password: str) -> str:
    """
    Hash a plain-text password using pbkdf2_sha256.
    No 72-byte limitation, safe for normal passwords.
    """
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify a plain-text password against its hash.
    """
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    """
    Create a signed JWT access token.
    `data` should be a dict with at least a "sub" (subject/user id).
    """
    to_encode = data.copy()
    expire = datetime.utcnow() + (
        expires_delta if expires_delta is not None
        else timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)
    return encoded_jwt

def decode_access_token(token: str) -> dict:
    """
    Decode and verify a JWT. Raises HTTPException if invalid or expired.
    """
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        )
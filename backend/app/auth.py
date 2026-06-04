from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import os
import logging
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from passlib.context import CryptContext
from jose import JWTError, jwt
from datetime import datetime, timedelta, timezone
from typing import Optional

from .database import get_db
from .models import User

# ========== CONFIG ==========
SECRET_KEY = os.getenv("SECRET_KEY", "ai-for-loneliness-super-secret-key-2024-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24


pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer(auto_error=False)

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


# ========== SCHEMAS ==========
class RegisterRequest(BaseModel):
    email: str
    password: str
    display_name: Optional[str] = None


class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


class UserResponse(BaseModel):
    id: int
    email: str
    display_name: Optional[str]
    is_admin: bool
    ai_enabled: bool
    ai_personality: Optional[str]
    ai_voice_model: Optional[str]
    ai_voice_gender: Optional[str]
    ai_voice_speed: Optional[str]
    ai_greeting_name: Optional[str]
    ai_business_prompt: Optional[str]
    ai_collect_data: Optional[bool]
    created_at: datetime

    class Config:
        from_attributes = True


class UpdateProfileRequest(BaseModel):
    display_name: Optional[str] = None
    ai_enabled: Optional[bool] = None
    ai_personality: Optional[str] = None
    ai_voice_model: Optional[str] = None
    ai_voice_gender: Optional[str] = None
    ai_voice_speed: Optional[str] = None
    ai_greeting_name: Optional[str] = None
    ai_business_prompt: Optional[str] = None
    ai_collect_data: Optional[bool] = None


# ========== UTILITIES ==========
def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(user_id: int, email: str, is_admin: bool = False) -> str:
    expire = datetime.now(timezone.utc) + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    payload = {
        "sub": str(user_id),
        "email": email,
        "is_admin": is_admin,
        "exp": expire
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    """Extract and verify JWT token, return current user."""
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated. Please login first."
        )
    
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = int(payload.get("sub"))
    except (JWTError, ValueError, TypeError) as e:
        logger.error(f"JWT Decode error: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token. Please login again."
        )
    
    user = db.query(User).filter(User.id == user_id, User.is_active == True).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or deactivated."
        )
    
    return user


def get_admin_user(current_user: User = Depends(get_current_user)) -> User:
    """Verify the current user is an admin."""
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required."
        )
    return current_user


# ========== ENDPOINTS ==========
@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(request: RegisterRequest, db: Session = Depends(get_db)):
    """Register a new user with email and password."""
    # Check if email already exists
    existing = db.query(User).filter(User.email == request.email.lower()).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered. Please login instead."
        )
    
    if len(request.password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 6 characters."
        )
    
    # Create user
    user = User(
        email=request.email.lower().strip(),
        hashed_password=hash_password(request.password),
        display_name=request.display_name or request.email.split("@")[0],
        is_admin=False,
        ai_enabled=False
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    
    # Generate token
    token = create_access_token(user.id, user.email, user.is_admin)
    
    return TokenResponse(
        access_token=token,
        user={
            "id": user.id,
            "email": user.email,
            "display_name": user.display_name,
            "is_admin": user.is_admin,
            "ai_enabled": user.ai_enabled
        }
    )


@router.post("/login", response_model=TokenResponse)
async def login(request: LoginRequest, db: Session = Depends(get_db)):
    """Login with email and password."""
    email_clean = request.email.lower().strip()
    user = db.query(User).filter(User.email == email_clean).first()
    
    if not user:
        logger.warning(f"Login failed: User {email_clean} not found")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password."
        )
    
    if not verify_password(request.password, user.hashed_password):
        logger.warning(f"Login failed: Incorrect password for {email_clean}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password."
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account has been deactivated. Contact admin."
        )
    
    token = create_access_token(user.id, user.email, user.is_admin)
    
    return TokenResponse(
        access_token=token,
        user={
            "id": user.id,
            "email": user.email,
            "display_name": user.display_name,
            "is_admin": user.is_admin,
            "ai_enabled": user.ai_enabled
        }
    )


@router.get("/me", response_model=UserResponse)
async def get_profile(current_user: User = Depends(get_current_user)):
    """Get current user profile."""
    return current_user


@router.put("/me", response_model=UserResponse)
async def update_profile(
    request: UpdateProfileRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update current user profile."""
    if request.display_name is not None:
        current_user.display_name = request.display_name
    if request.ai_enabled is not None:
        current_user.ai_enabled = request.ai_enabled
    if request.ai_personality is not None:
        current_user.ai_personality = request.ai_personality
    if request.ai_voice_model is not None:
        current_user.ai_voice_model = request.ai_voice_model
    if request.ai_voice_gender is not None:
        current_user.ai_voice_gender = request.ai_voice_gender
    if request.ai_voice_speed is not None:
        current_user.ai_voice_speed = request.ai_voice_speed
    if request.ai_greeting_name is not None:
        current_user.ai_greeting_name = request.ai_greeting_name
    if request.ai_business_prompt is not None:
        current_user.ai_business_prompt = request.ai_business_prompt
    if request.ai_collect_data is not None:
        current_user.ai_collect_data = request.ai_collect_data
    
    db.commit()
    db.refresh(current_user)
    return current_user


@router.get("/users")
async def search_users(
    search: str = "",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Search/list all users (excluding self) for starting conversations."""
    query = db.query(User).filter(
        User.id != current_user.id,
        User.is_active == True
    )
    
    if search:
        query = query.filter(
            (User.email.ilike(f"%{search}%")) |
            (User.display_name.ilike(f"%{search}%"))
        )
    
    users = query.order_by(User.display_name).limit(50).all()
    
    return [
        {
            "id": u.id,
            "email": u.email,
            "display_name": u.display_name,
            "ai_enabled": u.ai_enabled
        }
        for u in users
    ]

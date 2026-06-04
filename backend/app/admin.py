from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional
from pydantic import BaseModel

from .database import get_db
from .models import User, Message, CallLog, Conversation
from .auth import get_admin_user

router = APIRouter(prefix="/api/admin", tags=["Admin"])


# ========== SCHEMAS ==========
class UpdateUserRequest(BaseModel):
    is_active: Optional[bool] = None
    is_admin: Optional[bool] = None
    ai_enabled: Optional[bool] = None


# ========== ENDPOINTS ==========
@router.get("/stats")
async def get_dashboard_stats(
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    """Get admin dashboard statistics."""
    total_users = db.query(func.count(User.id)).scalar()
    active_users = db.query(func.count(User.id)).filter(User.is_active == True).scalar()
    ai_enabled_users = db.query(func.count(User.id)).filter(User.ai_enabled == True).scalar()
    total_messages = db.query(func.count(Message.id)).scalar()
    ai_messages = db.query(func.count(Message.id)).filter(Message.is_ai_generated == True).scalar()
    total_calls = db.query(func.count(CallLog.id)).scalar()
    ai_calls = db.query(func.count(CallLog.id)).filter(CallLog.ai_handled == True).scalar()
    total_conversations = db.query(func.count(Conversation.id)).scalar()
    
    return {
        "total_users": total_users,
        "active_users": active_users,
        "ai_enabled_users": ai_enabled_users,
        "total_messages": total_messages,
        "ai_messages": ai_messages,
        "total_calls": total_calls,
        "ai_calls": ai_calls,
        "total_conversations": total_conversations
    }


@router.get("/users")
async def list_users(
    search: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    """List all users with optional search."""
    query = db.query(User)
    
    if search:
        query = query.filter(
            (User.email.ilike(f"%{search}%")) |
            (User.display_name.ilike(f"%{search}%"))
        )
    
    total = query.count()
    users = query.order_by(User.created_at.desc()).offset(offset).limit(limit).all()
    
    return {
        "total": total,
        "users": [
            {
                "id": u.id,
                "email": u.email,
                "display_name": u.display_name,
                "is_admin": u.is_admin,
                "is_active": u.is_active,
                "ai_enabled": u.ai_enabled,
                "created_at": str(u.created_at),
                "message_count": db.query(func.count(Message.id)).filter(Message.sender_id == u.id).scalar(),
                "call_count": db.query(func.count(CallLog.id)).filter(
                    (CallLog.caller_id == u.id) | (CallLog.callee_id == u.id)
                ).scalar()
            }
            for u in users
        ]
    }


@router.put("/users/{user_id}")
async def update_user(
    user_id: int,
    request: UpdateUserRequest,
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    """Update user properties (admin only)."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if request.is_active is not None:
        user.is_active = request.is_active
    if request.is_admin is not None:
        user.is_admin = request.is_admin
    if request.ai_enabled is not None:
        user.ai_enabled = request.ai_enabled
    
    db.commit()
    db.refresh(user)
    
    return {
        "id": user.id,
        "email": user.email,
        "display_name": user.display_name,
        "is_admin": user.is_admin,
        "is_active": user.is_active,
        "ai_enabled": user.ai_enabled
    }


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: int,
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    """Delete a user (admin only)."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user.id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself!")
    
    db.delete(user)
    db.commit()
    
    return {"message": f"User {user.email} deleted successfully"}

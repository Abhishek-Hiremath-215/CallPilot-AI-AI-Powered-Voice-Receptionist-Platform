from fastapi import APIRouter, HTTPException, Depends, WebSocket, WebSocketDisconnect, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, Dict, List
from datetime import datetime, timezone
import json
import asyncio
import logging

from .database import get_db, SessionLocal
from .models import User, Conversation, ConversationMember, Message
from .auth import get_current_user
from .llm import chat_completion

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/chat", tags=["Chat"])


# ========== SCHEMAS ==========
class CreateConversationRequest(BaseModel):
    email: str


class SendMessageRequest(BaseModel):
    content: str


class MessageResponse(BaseModel):
    id: int
    conversation_id: int
    sender_id: int
    sender_name: str
    content: str
    is_ai_generated: bool
    created_at: str


# ========== WEBSOCKET CONNECTION MANAGER ==========
class ConnectionManager:
    """Manages WebSocket connections for real-time chat."""
    
    def __init__(self):
        # { user_id: WebSocket }
        self.active_connections: Dict[int, WebSocket] = {}
    
    async def connect(self, user_id: int, websocket: WebSocket):
        await websocket.accept()
        self.active_connections[user_id] = websocket
        logger.info(f"🟢 User {user_id} connected to chat")
    
    def disconnect(self, user_id: int):
        self.active_connections.pop(user_id, None)
        logger.info(f"🔴 User {user_id} disconnected from chat")
    
    async def send_to_user(self, user_id: int, message: dict):
        ws = self.active_connections.get(user_id)
        if ws:
            try:
                await ws.send_json(message)
            except Exception as e:
                logger.error(f"Failed to send to user {user_id}: {e}")
                self.disconnect(user_id)
    
    def is_online(self, user_id: int) -> bool:
        return user_id in self.active_connections
    
    def get_online_users(self) -> List[int]:
        return list(self.active_connections.keys())


manager = ConnectionManager()


# ========== AI RESPONSE ENGINE ==========

async def generate_ai_response(user: User, incoming_message: str, conversation_messages: list) -> str:
    """Generate an AI response on behalf of a user using Gemini."""
    
    greeting_name = user.ai_greeting_name or user.display_name or "our representative"
    personality = user.ai_personality or (
        "You are a professional, helpful, and friendly customer support chat representative. "
        "You speak naturally, clearly, and concisely in English. Keep responses brief — max 2-3 sentences."
    )
    
    # Custom business context if available
    business_instructions = ""
    if user.ai_business_prompt:
        business_instructions = f"Custom business instructions:\n---\n{user.ai_business_prompt}\n---\n"
    
    system_prompt = f"""You are responding as the customer support chat agent on behalf of {greeting_name}.
{business_instructions}
PERSONALITY & TONE: {personality}

RULES:
1. Respond naturally like a support agent on live chat — short, helpful, professional, yet warm.
2. Greet the customer, help answer their inquiries based on instructions, and politely ask for their name, phone/email, and request details if not already provided.
3. Keep responses extremely brief (1-3 sentences max).
4. Do not mention you are an AI assistant unless asked; speak as a human representative.
5. React with empathy and validate their concerns.
6. NEVER use placeholders in brackets (e.g. [Customer's Name] or [Phone]). If you don't know the name yet, simply ask for it directly or omit the name reference entirely.
"""

    # Build context from recent messages
    context_messages = [{"role": "system", "content": system_prompt}]
    
    for msg in conversation_messages[-6:]:
        role = "assistant" if msg.get("is_self") else "user"
        context_messages.append({"role": role, "content": msg["content"]})
    
    context_messages.append({"role": "user", "content": incoming_message})
    
    try:
        ai_text = await chat_completion(context_messages)
        
        # Clean up the response
        if ai_text:
            for prefix in ["As an AI", "I'm an AI", "Sure!", "Of course!", "Certainly!"]:
                if ai_text.startswith(prefix):
                    ai_text = ai_text[len(prefix):].strip().lstrip(",").strip()
            return ai_text
        
        return "Hey, tell me more! 😊"
        
    except Exception as e:
        logger.error(f"AI response generation failed: {e}")
        return None


# ========== REST ENDPOINTS ==========
@router.get("/conversations")
async def list_conversations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all conversations for the current user."""
    memberships = db.query(ConversationMember).filter(
        ConversationMember.user_id == current_user.id
    ).all()
    
    conversations = []
    for membership in memberships:
        conv = db.query(Conversation).filter(Conversation.id == membership.conversation_id).first()
        if not conv:
            continue
        
        # Get the other user in direct conversation
        other_member = db.query(ConversationMember).filter(
            ConversationMember.conversation_id == conv.id,
            ConversationMember.user_id != current_user.id
        ).first()
        
        other_user = None
        if other_member:
            other_user = db.query(User).filter(User.id == other_member.user_id).first()
        
        # Get last message
        last_msg = db.query(Message).filter(
            Message.conversation_id == conv.id
        ).order_by(Message.created_at.desc()).first()
        
        # Count unread (simplified — all messages not from current user after last seen)
        unread_count = db.query(Message).filter(
            Message.conversation_id == conv.id,
            Message.sender_id != current_user.id
        ).count()
        
        conversations.append({
            "id": conv.id,
            "type": conv.conversation_type,
            "name": conv.name or (other_user.display_name if other_user else "Unknown"),
            "other_user": {
                "id": other_user.id,
                "email": other_user.email,
                "display_name": other_user.display_name,
                "is_online": manager.is_online(other_user.id),
                "ai_enabled": other_user.ai_enabled
            } if other_user else None,
            "last_message": {
                "content": last_msg.content[:100] if last_msg else None,
                "sender_id": last_msg.sender_id if last_msg else None,
                "is_ai": last_msg.is_ai_generated if last_msg else False,
                "created_at": str(last_msg.created_at) if last_msg else None
            },
            "updated_at": str(conv.updated_at)
        })
    
    # Sort by last message time
    conversations.sort(key=lambda c: c["last_message"]["created_at"] or "", reverse=True)
    return conversations


@router.post("/conversations")
async def create_conversation(
    request: CreateConversationRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create or find a direct conversation with another user by email."""
    other_user = db.query(User).filter(User.email == request.email.lower()).first()
    if not other_user:
        raise HTTPException(status_code=404, detail="User not found with that email.")
    
    if other_user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot chat with yourself, yaar! 😄")
    
    # Check if conversation already exists
    my_convos = db.query(ConversationMember.conversation_id).filter(
        ConversationMember.user_id == current_user.id
    ).subquery()
    
    existing = db.query(ConversationMember).filter(
        ConversationMember.conversation_id.in_(my_convos),
        ConversationMember.user_id == other_user.id
    ).first()
    
    if existing:
        return {
            "id": existing.conversation_id,
            "message": "Conversation already exists!",
            "other_user": {
                "id": other_user.id,
                "display_name": other_user.display_name,
                "email": other_user.email
            }
        }
    
    # Create new conversation
    conv = Conversation(conversation_type="direct")
    db.add(conv)
    db.flush()
    
    db.add(ConversationMember(conversation_id=conv.id, user_id=current_user.id))
    db.add(ConversationMember(conversation_id=conv.id, user_id=other_user.id))
    db.commit()
    
    return {
        "id": conv.id,
        "message": "Conversation created!",
        "other_user": {
            "id": other_user.id,
            "display_name": other_user.display_name,
            "email": other_user.email
        }
    }


@router.get("/conversations/{conversation_id}/messages")
async def get_messages(
    conversation_id: int,
    limit: int = 50,
    offset: int = 0,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get messages for a conversation."""
    # Verify user is member
    member = db.query(ConversationMember).filter(
        ConversationMember.conversation_id == conversation_id,
        ConversationMember.user_id == current_user.id
    ).first()
    
    if not member:
        raise HTTPException(status_code=403, detail="You are not part of this conversation.")
    
    messages = db.query(Message).filter(
        Message.conversation_id == conversation_id
    ).order_by(Message.created_at.desc()).offset(offset).limit(limit).all()
    
    result = []
    for msg in reversed(messages):
        sender = db.query(User).filter(User.id == msg.sender_id).first()
        result.append({
            "id": msg.id,
            "conversation_id": msg.conversation_id,
            "sender_id": msg.sender_id,
            "sender_name": sender.display_name if sender else "Unknown",
            "content": msg.content,
            "is_ai_generated": msg.is_ai_generated,
            "created_at": str(msg.created_at)
        })
    
    return result


# ========== WEBSOCKET ENDPOINT ==========
@router.websocket("/ws/{token}")
async def websocket_chat(websocket: WebSocket, token: str):
    """WebSocket endpoint for real-time chat messaging."""
    from jose import jwt as jose_jwt
    from .auth import SECRET_KEY, ALGORITHM
    
    # Authenticate via token
    try:
        payload = jose_jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = int(payload.get("sub"))
    except Exception:
        await websocket.close(code=4001, reason="Invalid token")
        return
    
    db = SessionLocal()
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        db.close()
        await websocket.close(code=4001, reason="User not found")
        return
    
    await manager.connect(user_id, websocket)
    
    try:
        while True:
            data = await websocket.receive_json()
            action = data.get("action")
            
            if action == "send_message":
                conversation_id = data.get("conversation_id")
                content = data.get("content", "").strip()
                
                if not content or not conversation_id:
                    continue
                
                # Verify membership
                member = db.query(ConversationMember).filter(
                    ConversationMember.conversation_id == conversation_id,
                    ConversationMember.user_id == user_id
                ).first()
                
                if not member:
                    await manager.send_to_user(user_id, {
                        "type": "error",
                        "message": "Not a member of this conversation"
                    })
                    continue
                
                # Save message
                msg = Message(
                    conversation_id=conversation_id,
                    sender_id=user_id,
                    content=content,
                    is_ai_generated=False
                )
                db.add(msg)
                
                # Update conversation timestamp
                conv = db.query(Conversation).filter(Conversation.id == conversation_id).first()
                if conv:
                    conv.updated_at = datetime.now(timezone.utc)
                
                db.commit()
                db.refresh(msg)
                
                msg_data = {
                    "type": "new_message",
                    "message": {
                        "id": msg.id,
                        "conversation_id": conversation_id,
                        "sender_id": user_id,
                        "sender_name": user.display_name,
                        "content": content,
                        "is_ai_generated": False,
                        "created_at": str(msg.created_at)
                    }
                }
                
                # Send to sender (confirmation)
                await manager.send_to_user(user_id, msg_data)
                
                # Send to other members
                other_members = db.query(ConversationMember).filter(
                    ConversationMember.conversation_id == conversation_id,
                    ConversationMember.user_id != user_id
                ).all()
                
                for om in other_members:
                    other_user = db.query(User).filter(User.id == om.user_id).first()
                    
                    if manager.is_online(om.user_id):
                        # Send to online user
                        await manager.send_to_user(om.user_id, msg_data)
                    
                    # If other user has AI enabled, generate AI response
                    if other_user and other_user.ai_enabled:
                        # Get recent conversation context
                        recent_msgs = db.query(Message).filter(
                            Message.conversation_id == conversation_id
                        ).order_by(Message.created_at.desc()).limit(8).all()
                        
                        context = [
                            {
                                "content": m.content,
                                "is_self": m.sender_id == other_user.id
                            }
                            for m in reversed(recent_msgs)
                        ]
                        
                        # Send typing indicator
                        await manager.send_to_user(user_id, {
                            "type": "typing",
                            "user_id": other_user.id,
                            "user_name": other_user.display_name,
                            "conversation_id": conversation_id
                        })
                        
                        # Generate AI response
                        ai_response = await generate_ai_response(other_user, content, context)
                        
                        if ai_response:
                            # Save AI message
                            ai_msg = Message(
                                conversation_id=conversation_id,
                                sender_id=other_user.id,
                                content=ai_response,
                                is_ai_generated=True
                            )
                            db.add(ai_msg)
                            db.commit()
                            db.refresh(ai_msg)
                            
                            ai_msg_data = {
                                "type": "new_message",
                                "message": {
                                    "id": ai_msg.id,
                                    "conversation_id": conversation_id,
                                    "sender_id": other_user.id,
                                    "sender_name": other_user.display_name,
                                    "content": ai_response,
                                    "is_ai_generated": True,
                                    "created_at": str(ai_msg.created_at)
                                }
                            }
                            
                            # Send AI response to sender
                            await manager.send_to_user(user_id, ai_msg_data)
                            
                            # Also send to the AI user if they're online
                            if manager.is_online(other_user.id):
                                await manager.send_to_user(other_user.id, ai_msg_data)
            
            elif action == "typing":
                conversation_id = data.get("conversation_id")
                if conversation_id:
                    other_members = db.query(ConversationMember).filter(
                        ConversationMember.conversation_id == conversation_id,
                        ConversationMember.user_id != user_id
                    ).all()
                    
                    for om in other_members:
                        await manager.send_to_user(om.user_id, {
                            "type": "typing",
                            "user_id": user_id,
                            "user_name": user.display_name,
                            "conversation_id": conversation_id
                        })
            
            elif action == "get_online_users":
                await manager.send_to_user(user_id, {
                    "type": "online_users",
                    "users": manager.get_online_users()
                })
    
    except WebSocketDisconnect:
        manager.disconnect(user_id)
        logger.info(f"User {user_id} disconnected")
    except Exception as e:
        logger.error(f"WebSocket error for user {user_id}: {e}")
        manager.disconnect(user_id)
    finally:
        db.close()

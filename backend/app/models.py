from sqlalchemy import (
    Column, Integer, String, Text, Boolean, DateTime, ForeignKey, Enum
)
from sqlalchemy.orm import relationship
from datetime import datetime
import enum

from .database import Base


# ========== ENUMS ==========
class ContactStatus(str, enum.Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    BLOCKED = "blocked"


class ConversationType(str, enum.Enum):
    DIRECT = "direct"
    GROUP = "group"


class CallStatus(str, enum.Enum):
    RINGING = "ringing"
    ACTIVE = "active"
    ENDED = "ended"
    MISSED = "missed"
    REJECTED = "rejected"


# ========== MODELS ==========
class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    display_name = Column(String(100), nullable=True)
    is_admin = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    ai_enabled = Column(Boolean, default=False)
    ai_personality = Column(Text, default="You are a professional, friendly customer support agent. You speak naturally in brief, clear sentences. Your main objective is to retrieve the customer's name, telephone number, and details of their inquiry.")
    created_at = Column(DateTime, default=datetime.utcnow)

    # AI Voice & Call Settings
    ai_voice_model = Column(String(100), default="en_US-ryan-medium")
    ai_voice_gender = Column(String(20), default="male")
    ai_voice_speed = Column(String(10), default="1.0")
    ai_greeting_name = Column(String(100), nullable=True)
    ai_business_prompt = Column(Text, nullable=True)
    ai_collect_data = Column(Boolean, default=True)

    # Relationships
    sent_messages = relationship("Message", back_populates="sender", foreign_keys="Message.sender_id")
    conversations = relationship("ConversationMember", back_populates="user")
    contacts_added = relationship("Contact", back_populates="user", foreign_keys="Contact.user_id")
    contacts_received = relationship("Contact", back_populates="contact_user", foreign_keys="Contact.contact_user_id")


class Contact(Base):
    __tablename__ = "contacts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    contact_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    status = Column(String(20), default=ContactStatus.ACCEPTED)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="contacts_added", foreign_keys=[user_id])
    contact_user = relationship("User", back_populates="contacts_received", foreign_keys=[contact_user_id])


class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(Integer, primary_key=True, index=True)
    conversation_type = Column(String(20), default=ConversationType.DIRECT)
    name = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    members = relationship("ConversationMember", back_populates="conversation")
    messages = relationship("Message", back_populates="conversation", order_by="Message.created_at")


class ConversationMember(Base):
    __tablename__ = "conversation_members"

    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    joined_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    conversation = relationship("Conversation", back_populates="members")
    user = relationship("User", back_populates="conversations")


class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id"), nullable=False)
    sender_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    content = Column(Text, nullable=False)
    is_ai_generated = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    conversation = relationship("Conversation", back_populates="messages")
    sender = relationship("User", back_populates="sent_messages", foreign_keys=[sender_id])


class CallLog(Base):
    __tablename__ = "call_logs"

    id = Column(Integer, primary_key=True, index=True)
    caller_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    callee_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    call_type = Column(String(20), default="audio")
    status = Column(String(20), default=CallStatus.RINGING)
    ai_handled = Column(Boolean, default=False)
    started_at = Column(DateTime, default=datetime.utcnow)
    ended_at = Column(DateTime, nullable=True)

    # Relationships
    caller = relationship("User", foreign_keys=[caller_id])
    callee = relationship("User", foreign_keys=[callee_id])


class AICallData(Base):
    """Stores data collected by AI during calls on behalf of the user."""
    __tablename__ = "ai_call_data"

    id = Column(Integer, primary_key=True, index=True)
    call_id = Column(Integer, ForeignKey("call_logs.id"), nullable=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    caller_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    caller_name = Column(String(200), nullable=True)
    caller_need = Column(Text, nullable=True)
    caller_phone = Column(String(50), nullable=True)
    urgency = Column(String(20), default="low")  # high / medium / low
    summary = Column(Text, nullable=True)
    sentiment = Column(String(20), default="neutral")  # positive / neutral / negative
    full_transcript = Column(Text, nullable=True)  # JSON string
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    call = relationship("CallLog", foreign_keys=[call_id])
    owner = relationship("User", foreign_keys=[owner_id])
    caller = relationship("User", foreign_keys=[caller_id])

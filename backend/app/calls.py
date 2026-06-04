from fastapi import APIRouter, HTTPException, Depends, WebSocket, WebSocketDisconnect, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, Dict, List
from datetime import datetime, timezone
import json
import asyncio
import logging
import tempfile
import os
import sys

from .database import get_db, SessionLocal
from .models import User, CallLog
from .auth import get_current_user, SECRET_KEY, ALGORITHM
from .llm import chat_completion

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/calls", tags=["Calls"])

# Piper TTS paths
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PIPER_DIR = os.path.join(BASE_DIR, "piper", "piper", "piper")
PIPER_EXE = os.path.join(PIPER_DIR, "piper.exe")

# Voice models
INDIAN_VOICE_MODELS = {
    "male": "en_US-ryan-medium",
    "female": "en_US-lessac-medium"
}


# ========== SCHEMAS ==========
class InitiateCallRequest(BaseModel):
    callee_id: int
    call_type: str = "audio"


class EndCallRequest(BaseModel):
    call_id: int


# ========== CALL SIGNALING MANAGER ==========
class CallSignalingManager:
    """Manages WebRTC signaling for audio calls."""
    
    def __init__(self):
        self.active_connections: Dict[int, WebSocket] = {}
        self.active_calls: Dict[int, dict] = {}  # call_id -> call info
    
    async def connect(self, user_id: int, websocket: WebSocket):
        await websocket.accept()
        self.active_connections[user_id] = websocket
        logger.info(f"📞 User {user_id} connected to call signaling")
    
    def disconnect(self, user_id: int, websocket: WebSocket):
        if self.active_connections.get(user_id) == websocket:
            self.active_connections.pop(user_id, None)
            logger.info(f"📞 User {user_id} disconnected from call signaling")
        else:
            logger.info(f"📞 Ignore stale disconnect for user {user_id}")

    
    async def send_to_user(self, user_id: int, message: dict):
        ws = self.active_connections.get(user_id)
        if ws:
            try:
                await ws.send_json(message)
            except Exception as e:
                logger.error(f"Call signaling send failed for user {user_id}: {e}")
    
    def is_available(self, user_id: int) -> bool:
        return user_id in self.active_connections


call_manager = CallSignalingManager()


# ========== AI VOICE RESPONSE ==========

import re

# Per-call conversation memory (call_id -> list of messages)
call_conversations = {}

# Available voice models metadata
VOICE_MODELS = [
    {"id": "en_US-ryan-low", "name": "Ryan", "gender": "male", "quality": "Low"},
    {"id": "en_US-ryan-medium", "name": "Ryan", "gender": "male", "quality": "Medium"},
    {"id": "en_US-ryan-high", "name": "Ryan", "gender": "male", "quality": "High"},
    {"id": "en_US-amy-low", "name": "Amy", "gender": "female", "quality": "Low"},
    {"id": "en_US-amy-medium", "name": "Amy", "gender": "female", "quality": "Medium"},
    {"id": "en_US-lessac-medium", "name": "Lessac", "gender": "female", "quality": "Medium"},
    {"id": "en_US-lessac-high", "name": "Lessac", "gender": "female", "quality": "High"},
    {"id": "en_US-libritts-high", "name": "LibriTTS", "gender": "mixed", "quality": "High"},
]

HINDI_FILLERS = ["yaar", "haan", "theek", "kaisi", "accha", "kya", "bhai", "arrey", "bas", "ji", "toh", "nahi",
                 "arey", "dekho", "suniye", "bilkul", "sahi", "matlab", "samjha", "pata"]


def _clean_hindi(text: str) -> str:
    """Remove any Hindi filler words from AI text."""
    for word in HINDI_FILLERS:
        text = re.sub(rf'\b{word}\b', '', text, flags=re.IGNORECASE)
    text = re.sub(r' +', ' ', text).strip()
    # Clean up orphaned punctuation
    text = re.sub(r'\s+([,!?.])', r'\1', text)
    return text if text else "I'm here, go ahead!"


def get_ai_system_prompt(user: User) -> str:
    """Build the system prompt based on user's settings."""
    greeting_name = user.ai_greeting_name or user.display_name or "the assistant"
    
    # If user has a business prompt, use it as the core identity
    if user.ai_business_prompt:
        business_context = (
            f"You are a warm, professional customer support voice agent answering a phone call on behalf of {greeting_name}.\n"
            f"Here are your custom business instructions from {greeting_name}:\n"
            f"---\n{user.ai_business_prompt}\n---\n\n"
            f"IMPORTANT: {greeting_name} is not available right now. You are their AI support representative.\n"
            "Your job is to:\n"
            "1. Greet the caller warmly and introduce yourself as their support agent\n"
            "2. Listen attentively to what they need\n"
            "3. Ask relevant follow-up questions to understand their issue based on the instructions above\n"
            "4. Collect their name, phone number, and a description of their issue/need\n"
            "5. Advise them that their details have been logged and a support representative will follow up shortly\n"
            "6. Be professional, friendly, and helpful\n"
        )
    else:
        business_context = (
            f"You are a warm, professional customer support voice agent answering a phone call on behalf of {greeting_name}.\n"
            "Your main objectives are:\n"
            "1. Greet the customer warmly and ask how you can help them.\n"
            "2. Listen attentively to their query or problem.\n"
            "3. Politely retrieve their name, contact phone number, and the specific details of their request.\n"
            "4. Acknowledge and summarize their concern with empathy, ensuring they feel heard.\n"
            "5. Advise them that their details have been logged and a support representative will follow up shortly.\n"
            "Stick only to retrieving details from the customer and being helpful."
        )
    
    return (
        f"{business_context}\n\n"
        "STRICT RULES FOR NATURAL SPEECH AND BARGE-IN:\n"
        "1. Speak ONLY in English. NEVER use Hindi, Hinglish, or non-English words.\n"
        "2. BANNED words: yaar, haan, theek, kaisi, accha, kya, bhai, arrey, bas, ji, toh, nahi. ZERO tolerance.\n"
        "3. Speak like a real human on a phone call — use relaxed, natural support agent dialogue.\n"
        "4. Keep responses EXTREMELY SHORT (1-2 sentences max) so the customer has frequent opportunities to speak and interrupt you naturally.\n"
        "5. Use natural conversational acknowledgments (e.g., 'Got it', 'Sure thing', 'Mhmm', 'Okay...', 'I see').\n"
        "6. Do not mention that you are an AI or virtual assistant unless explicitly asked. Talk like a real human representative sitting in an office.\n"
        "7. Acknowledge urgency if the customer describes a critical situation.\n"
        "8. Ensure you retrieve the caller's name and contact number before ending the conversation.\n"
        "9. NEVER use placeholders in brackets (e.g. [Customer's Name], [Name], or [Phone]). If you don't know the name yet, simply ask for it directly or address them generally without a name placeholder."
    )


async def generate_ai_greeting(user: User, call_id: int) -> dict:
    """Generate an initial greeting when AI picks up the call."""
    greeting_name = user.ai_greeting_name or user.display_name or "here"
    system_prompt = get_ai_system_prompt(user)
    
    if user.ai_business_prompt:
        greeting_instruction = (
            f"[The phone is ringing and you just picked up. You are the customer support voice agent for {greeting_name}. "
            f"Greet the caller warmly, say {greeting_name} is not available right now but you can help them. "
            "One sentence only. Sound professional, human, and friendly.]"
        )
    else:
        greeting_instruction = (
            f"[The phone is ringing and you just picked up as {greeting_name}'s customer support agent. "
            "Greet the caller warmly and ask how you can help. One sentence only. Sound professional, human, and friendly.]"
        )
    
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": greeting_instruction}
    ]
    
    try:
        raw_text = await chat_completion(messages)
        
        ai_text = _clean_hindi(raw_text)
        if not ai_text or len(ai_text) < 3:
            ai_text = f"Hi there! This is {greeting_name}'s assistant. How can I help you?"
        
        # Initialize conversation memory
        call_conversations[call_id] = [
            {"role": "system", "content": system_prompt},
            {"role": "assistant", "content": ai_text}
        ]
        
        result = {"text": ai_text, "audio_available": False}
        voice_model = user.ai_voice_model or "en_US-ryan-medium"
        await _generate_tts_audio(ai_text, result, voice_model)
        logger.info(f"👋 [GREETING] call_id={call_id}: '{ai_text}'")
        return result
        
    except Exception as e:
        import traceback
        logger.error(f"AI greeting failed: {type(e).__name__}: {e}")
        logger.error(traceback.format_exc())
        return {"text": f"Hi! This is {greeting_name}'s assistant. How can I help you?", "audio_available": False}


async def generate_ai_voice_response(user: User, speech_text: str, call_id: int = None) -> dict:
    """Generate AI voice response with conversation memory."""
    system_prompt = get_ai_system_prompt(user)
    
    # Build messages with conversation history
    if call_id and call_id in call_conversations:
        messages = call_conversations[call_id].copy()
        messages.append({"role": "user", "content": speech_text})
    else:
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": speech_text}
        ]
    
    try:
        raw_text = await chat_completion(messages)
        
        ai_text = _clean_hindi(raw_text)
        
        # Update conversation memory
        if call_id:
            if call_id not in call_conversations:
                call_conversations[call_id] = [{"role": "system", "content": system_prompt}]
            call_conversations[call_id].append({"role": "user", "content": speech_text})
            call_conversations[call_id].append({"role": "assistant", "content": ai_text})
            # Keep memory manageable
            if len(call_conversations[call_id]) > 42:
                call_conversations[call_id] = [call_conversations[call_id][0]] + call_conversations[call_id][-20:]
        
        result = {"text": ai_text, "audio_available": False}
        voice_model = user.ai_voice_model or "en_US-ryan-medium"
        await _generate_tts_audio(ai_text, result, voice_model)
        return result

    except Exception as e:
        import traceback
        logger.error(f"AI voice response failed: {type(e).__name__}: {e}")
        logger.error(traceback.format_exc())
        return {"text": "Sorry, I didn't catch that. Could you repeat?", "audio_available": False}



async def _generate_call_summary(call_id: int, owner_id: int, caller_id: int):
    """Generate summary from call conversation and save as AICallData."""
    if call_id not in call_conversations:
        return
    
    # Wait for the last message to be fully processed if needed
    await asyncio.sleep(2)
    
    conversation = call_conversations[call_id]
    # Build transcript text
    transcript_lines = []
    for msg in conversation:
        if msg["role"] == "system":
            continue
        role_label = "AI" if msg["role"] == "assistant" else "Caller"
        transcript_lines.append(f"{role_label}: {msg['content']}")
    
    transcript_text = "\n".join(transcript_lines)
    if not transcript_text:
        return
    
    # Use AI to generate structured summary
    try:
        analysis_prompt = (
            "Analyze this phone call transcript between an AI assistant and a caller. "
            "Extract the following information and return it ONLY as JSON:\n\n"
            "{\n"
            '  "caller_name": "the full name of the caller if mentioned (even if they told it late)",\n'
            '  "caller_phone": "the phone number if provided by the caller (may be digits like 897...)",\n'
            '  "caller_need": "a concise summary of what the caller is looking for (1 sentence)",\n'
            '  "urgency": "high" or "medium" or "low",\n'
            '  "sentiment": "positive" or "neutral" or "negative",\n'
            '  "summary": "a 2-3 sentence overview of the conversation"\n'
            "}\n\n"
            "Urgency rules: 'high' if words like urgent/emergency/ASAP/deadline/today/2 days, "
            "'medium' if time-sensitive, 'low' otherwise.\n"
            "BE ACCURATE. Look closely at the transcript to find the name and phone number.\n"
            "RESPOND WITH RAW JSON ONLY.\n\n"
            f"Transcript:\n{transcript_text}"
        )
        
        ai_output = await chat_completion([
            {"role": "system", "content": "You are a data extraction expert. You return only valid JSON."},
            {"role": "user", "content": analysis_prompt}
        ])
        
        # Parse JSON from AI response
        import json as json_module
        try:
            # Handle potential markdown code blocks
            if "```" in ai_output:
                lines = ai_output.split("\n")
                # Find the starts and ends of the code block
                start = -1
                end = -1
                for i, l in enumerate(lines):
                    if l.startswith("```"):
                        if start == -1: start = i
                        else: end = i; break
                if start != -1 and end != -1:
                    ai_output = "\n".join(lines[start+1:end])
                    if ai_output.startswith("json"):
                        ai_output = ai_output[4:].strip()
                elif start != -1:
                    ai_output = "\n".join(lines[start+1:]).strip()
            
            data = json_module.loads(ai_output)
        except Exception:
            # Fallback parsing
            data = {
                "caller_name": None,
                "caller_phone": None,
                "caller_need": "Unable to extract",
                "urgency": "low",
                "sentiment": "neutral",
                "summary": transcript_text[:200]
            }
        
        # Save to database
        from .models import AICallData
        db = SessionLocal()
        try:
            call_data = AICallData(
                call_id=call_id,
                owner_id=owner_id,
                caller_id=caller_id,
                caller_name=data.get("caller_name"),
                caller_need=data.get("caller_need"),
                caller_phone=data.get("caller_phone"),
                urgency=data.get("urgency", "low"),
                summary=data.get("summary"),
                sentiment=data.get("sentiment", "neutral"),
                full_transcript=json_module.dumps(transcript_lines),
                is_read=False
            )
            db.add(call_data)
            db.commit()
            logger.info(f"📊 Saved call data for call_id={call_id}, urgency={data.get('urgency')}")
            
            # Notify owner about new data
            await call_manager.send_to_user(owner_id, {
                "type": "new_call_data",
                "call_id": call_id,
                "caller_name": data.get("caller_name", "Unknown"),
                "caller_need": data.get("caller_need", ""),
                "urgency": data.get("urgency", "low"),
                "sentiment": data.get("sentiment", "neutral")
            })
            
            # Extra notification for high urgency
            if data.get("urgency") == "high":
                await call_manager.send_to_user(owner_id, {
                    "type": "urgent_call_data",
                    "call_id": call_id,
                    "caller_name": data.get("caller_name", "Unknown"),
                    "caller_need": data.get("caller_need", ""),
                    "urgency": "high"
                })
        finally:
            db.close()
            
    except Exception as e:
        logger.error(f"Failed to generate call summary: {e}")
    finally:
        if call_id in call_conversations:
            del call_conversations[call_id]


async def _generate_tts_audio(ai_text: str, result: dict, voice_model: str = "en_US-ryan-medium"):
    """Generate TTS audio from text using the specified voice model."""
    if not os.path.exists(PIPER_EXE):
        return
    
    try:
        voice_file = os.path.join(PIPER_DIR, f"{voice_model}.onnx")
        
        if not os.path.exists(voice_file):
            # Fallback to default
            voice_file = os.path.join(PIPER_DIR, "en_US-ryan-medium.onnx")
            if not os.path.exists(voice_file):
                logger.error(f"❌ Voice model file missing: {voice_file}")
                return

        with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as f:
            temp_path = f.name
        
        # Check for Proactor loop support on Windows
        use_async_subprocess = True
        if sys.platform == 'win32':
            loop = asyncio.get_event_loop()
            if "Proactor" not in type(loop).__name__:
                use_async_subprocess = False
        
        if use_async_subprocess:
            process = await asyncio.create_subprocess_exec(
                PIPER_EXE, "--model", voice_file, "--output_file", temp_path,
                stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=PIPER_DIR
            )
            await asyncio.wait_for(
                process.communicate(input=ai_text.encode('utf-8')),
                timeout=15.0
            )
        else:
            import subprocess
            from concurrent.futures import ThreadPoolExecutor
            
            def run_piper_sync():
                return subprocess.run(
                    [PIPER_EXE, "--model", voice_file, "--output_file", temp_path],
                    input=ai_text.encode('utf-8'),
                    capture_output=True,
                    cwd=PIPER_DIR
                )
            
            loop = asyncio.get_event_loop()
            with ThreadPoolExecutor() as pool:
                await loop.run_in_executor(pool, run_piper_sync)
        
        if os.path.exists(temp_path) and os.path.getsize(temp_path) > 0:
            import base64
            with open(temp_path, 'rb') as f:
                audio_data = base64.b64encode(f.read()).decode('utf-8')
            result["audio_base64"] = audio_data
            result["audio_available"] = True
            os.unlink(temp_path)
        else:
            logger.error("❌ Piper failed to generate audio")
    except Exception as e:
        logger.error(f"💥 TTS generation failed ({type(e).__name__}): {e}")








# ========== REST ENDPOINTS ==========
@router.post("/initiate")
async def initiate_call(
    request: InitiateCallRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Initiate a call to another user."""
    callee = db.query(User).filter(User.id == request.callee_id).first()
    if not callee:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Create call log
    call = CallLog(
        caller_id=current_user.id,
        callee_id=callee.id,
        call_type=request.call_type,
        status="ringing",
        ai_handled=callee.ai_enabled
    )
    db.add(call)
    db.commit()
    db.refresh(call)
    
    # If callee has AI enabled, the call is AI-handled
    if callee.ai_enabled:
        call.status = "active"
        call.ai_handled = True
        db.commit()
        
        # Generate AI greeting and send it via WebSocket
        caller_id = current_user.id
        callee_id = callee.id
        call_id = call.id
        
        async def send_greeting():
            # Create fresh session for background task to avoid DetachedInstanceError
            db_bg = SessionLocal()
            try:
                db_callee = db_bg.query(User).filter(User.id == callee_id).first()
                if db_callee:
                    greeting = await generate_ai_greeting(db_callee, call_id)
                    await call_manager.send_to_user(caller_id, {
                        "type": "ai_voice_response",
                        "call_id": call_id,
                        **greeting
                    })
            except Exception as e:
                logger.error(f"Error in send_greeting background task: {e}")
            finally:
                db_bg.close()
        
        asyncio.ensure_future(send_greeting())
        
        return {
            "call_id": call.id,
            "status": "ai_connected",
            "message": f"Connected to {callee.display_name}'s AI assistant",
            "ai_handled": True,
            "callee": {
                "id": callee.id,
                "display_name": callee.display_name
            }
        }
    
    # Send ringing signal to callee
    if call_manager.is_available(callee.id):
        await call_manager.send_to_user(callee.id, {
            "type": "incoming_call",
            "call_id": call.id,
            "caller": {
                "id": current_user.id,
                "display_name": current_user.display_name,
                "email": current_user.email
            },
            "call_type": request.call_type
        })
    
    return {
        "call_id": call.id,
        "status": "ringing",
        "ai_handled": False,
        "callee": {
            "id": callee.id,
            "display_name": callee.display_name,
            "is_online": call_manager.is_available(callee.id)
        }
    }


@router.post("/end")
async def end_call(
    request: EndCallRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """End an active call."""
    call = db.query(CallLog).filter(CallLog.id == request.call_id).first()
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")
    
    call.status = "ended"
    call.ended_at = datetime.now(timezone.utc)
    db.commit()
    
    # Trigger data collection for AI-handled calls before clearing memory
    if call.ai_handled and call.id in call_conversations:
        # Get the callee (whose AI was handling) to check if data collection is enabled
        callee_user = db.query(User).filter(User.id == call.callee_id).first()
        if callee_user and callee_user.ai_collect_data:
            asyncio.ensure_future(
                _generate_call_summary(call.id, call.callee_id, call.caller_id)
            )
            # Don't delete memory yet — let summary generation use it
            # It will be cleaned up naturally when memory is overwritten
        else:
            del call_conversations[call.id]
    elif call.id in call_conversations:
        del call_conversations[call.id]
    
    # Notify the other party
    other_id = call.callee_id if call.caller_id == current_user.id else call.caller_id
    await call_manager.send_to_user(other_id, {
        "type": "call_ended",
        "call_id": call.id
    })
    
    return {"status": "ended", "call_id": call.id}


@router.get("/history")
async def call_history(
    limit: int = 20,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get call history for current user."""
    calls = db.query(CallLog).filter(
        (CallLog.caller_id == current_user.id) | (CallLog.callee_id == current_user.id)
    ).order_by(CallLog.started_at.desc()).limit(limit).all()
    
    result = []
    for call in calls:
        other_id = call.callee_id if call.caller_id == current_user.id else call.caller_id
        other_user = db.query(User).filter(User.id == other_id).first()
        
        result.append({
            "id": call.id,
            "caller_id": call.caller_id,
            "callee_id": call.callee_id,
            "other_user": {
                "id": other_user.id,
                "display_name": other_user.display_name
            } if other_user else None,
            "call_type": call.call_type,
            "status": call.status,
            "ai_handled": call.ai_handled,
            "started_at": str(call.started_at),
            "ended_at": str(call.ended_at) if call.ended_at else None,
            "is_outgoing": call.caller_id == current_user.id
        })
    
    return result


# ========== AI SETTINGS ENDPOINTS ==========
@router.get("/voice-models")
async def get_voice_models():
    """Get available voice models."""
    result = []
    for vm in VOICE_MODELS:
        voice_file = os.path.join(PIPER_DIR, f"{vm['id']}.onnx")
        result.append({
            **vm,
            "available": os.path.exists(voice_file)
        })
    return result


@router.get("/voice-preview/{model_id}")
async def get_voice_preview(model_id: str):
    """Generate a preview audio sample for a voice model."""
    from fastapi.responses import Response
    import base64
    
    # Validate model exists
    valid_ids = [vm["id"] for vm in VOICE_MODELS]
    if model_id not in valid_ids:
        raise HTTPException(status_code=404, detail="Voice model not found")
    
    voice_file = os.path.join(PIPER_DIR, f"{model_id}.onnx")
    if not os.path.exists(voice_file):
        raise HTTPException(status_code=404, detail="Voice model file not installed")
    
    sample_text = "Hi there! I'm ready to help you. How are you doing today?"
    result = {"audio_available": False}
    await _generate_tts_audio(sample_text, result, model_id)
    
    if result.get("audio_available"):
        return {"audio_base64": result["audio_base64"], "text": sample_text}
    else:
        raise HTTPException(status_code=500, detail="Failed to generate preview audio")


@router.get("/collected-data")
async def get_collected_data(
    filter: str = "all",
    search: str = "",
    limit: int = 50,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get AI-collected call data for current user."""
    from .models import AICallData
    
    query = db.query(AICallData).filter(AICallData.owner_id == current_user.id)
    
    if filter == "unread":
        query = query.filter(AICallData.is_read == False)
    elif filter == "urgent":
        query = query.filter(AICallData.urgency == "high")
    
    if search:
        query = query.filter(
            (AICallData.caller_name.ilike(f"%{search}%")) |
            (AICallData.caller_need.ilike(f"%{search}%")) |
            (AICallData.summary.ilike(f"%{search}%"))
        )
    
    items = query.order_by(AICallData.created_at.desc()).limit(limit).all()
    
    results = []
    for item in items:
        # Get caller display name
        caller_display = item.caller_name or "Unknown"
        if item.caller_id:
            caller_user = db.query(User).filter(User.id == item.caller_id).first()
            if caller_user and not item.caller_name:
                caller_display = caller_user.display_name or caller_user.email
        
        results.append({
            "id": item.id,
            "call_id": item.call_id,
            "caller_name": caller_display,
            "caller_need": item.caller_need,
            "caller_phone": item.caller_phone,
            "urgency": item.urgency,
            "summary": item.summary,
            "sentiment": item.sentiment,
            "full_transcript": item.full_transcript,
            "is_read": item.is_read,
            "created_at": str(item.created_at)
        })
    
    return results


@router.put("/collected-data/{data_id}/read")
async def mark_data_read(
    data_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Mark collected data as read."""
    from .models import AICallData
    item = db.query(AICallData).filter(
        AICallData.id == data_id,
        AICallData.owner_id == current_user.id
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Data not found")
    item.is_read = True
    db.commit()
    return {"status": "read", "id": data_id}


@router.get("/collected-data/unread-count")
async def get_unread_count(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get unread call data count for badge."""
    from .models import AICallData
    count = db.query(AICallData).filter(
        AICallData.owner_id == current_user.id,
        AICallData.is_read == False
    ).count()
    
    urgent_count = db.query(AICallData).filter(
        AICallData.owner_id == current_user.id,
        AICallData.urgency == "high",
        AICallData.is_read == False
    ).count()
    
    return {"unread": count, "urgent": urgent_count}


# ========== WEBSOCKET FOR CALL SIGNALING ==========
@router.websocket("/ws/{token}")
async def websocket_call_signaling(websocket: WebSocket, token: str):
    """WebSocket for WebRTC call signaling and AI call handling."""
    from jose import jwt as jose_jwt
    
    logger.info(f"🔌 WebSocket connection attempt with token: {token[:10]}...")
    try:
        payload = jose_jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = int(payload.get("sub"))
        logger.info(f"🔑 WebSocket authenticated user_id: {user_id}")
    except Exception as e:
        logger.error(f"❌ WebSocket authentication failed: {e}")
        await websocket.close(code=4001, reason="Invalid token")
        return
    
    db = SessionLocal()
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        db.close()
        await websocket.close(code=4001, reason="User not found")
        return
    
    await call_manager.connect(user_id, websocket)
    
    try:
        while True:
            data = await websocket.receive_json()
            action = data.get("action")
            
            if action == "webrtc_offer":
                # Forward WebRTC offer to callee
                target_id = data.get("target_id")
                await call_manager.send_to_user(target_id, {
                    "type": "webrtc_offer",
                    "offer": data.get("offer"),
                    "caller_id": user_id
                })
            
            elif action == "webrtc_answer":
                target_id = data.get("target_id")
                await call_manager.send_to_user(target_id, {
                    "type": "webrtc_answer",
                    "answer": data.get("answer"),
                    "answerer_id": user_id
                })
            
            elif action == "ice_candidate":
                target_id = data.get("target_id")
                await call_manager.send_to_user(target_id, {
                    "type": "ice_candidate",
                    "candidate": data.get("candidate"),
                    "from_id": user_id
                })
            
            elif action == "accept_call":
                call_id = data.get("call_id")
                call = db.query(CallLog).filter(CallLog.id == call_id).first()
                if call:
                    call.status = "active"
                    call.ai_handled = False # Human accepted, disable AI flow
                    db.commit()
                    await call_manager.send_to_user(call.caller_id, {
                        "type": "call_accepted",
                        "call_id": call_id,
                        "answerer_id": user_id
                    })
            
            elif action == "reject_call":
                call_id = data.get("call_id")
                call = db.query(CallLog).filter(CallLog.id == call_id).first()
                if call:
                    call.status = "rejected"
                    call.ended_at = datetime.utcnow()
                    db.commit()
                    await call_manager.send_to_user(call.caller_id, {
                        "type": "call_rejected",
                        "call_id": call_id
                    })
            
            elif action == "ai_speech_input":
                # User sent speech text for AI to respond to during a call
                speech_text = data.get("text", "")
                call_id = data.get("call_id")
                
                logger.info(f"🎤 [USER SPEECH] call_id={call_id}, text='{speech_text}'")
                
                if speech_text and call_id:
                    call = db.query(CallLog).filter(CallLog.id == call_id).first()
                    if call and call.ai_handled:
                        callee = db.query(User).filter(User.id == call.callee_id).first()
                        if callee:
                            ai_response = await generate_ai_voice_response(callee, speech_text, call_id=call_id)
                            logger.info(f"🤖 [AI RESPONSE] call_id={call_id}, text='{ai_response.get('text', '')}', audio={ai_response.get('audio_available', False)}")
                            await call_manager.send_to_user(user_id, {
                                "type": "ai_voice_response",
                                "call_id": call_id,
                                **ai_response
                            })
                    else:
                        if not call:
                            logger.warning(f"⚠️ ai_speech_input: call_id={call_id} not found in DB")
                        elif not call.ai_handled:
                            logger.warning(f"⚠️ ai_speech_input: call_id={call_id} is not AI-handled, ignoring")

    
    except WebSocketDisconnect:
        call_manager.disconnect(user_id, websocket)
    except Exception as e:
        logger.error(f"Call signaling error for user {user_id}: {e}")
        call_manager.disconnect(user_id, websocket)
    finally:
        db.close()


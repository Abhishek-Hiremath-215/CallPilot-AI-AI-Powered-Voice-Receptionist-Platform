"""
Centralized LLM client using OpenAI GPT-4o-mini.
All AI features (chat, calls, summaries) use this module.
"""
import os
import asyncio
import logging
from typing import List, Dict, Optional
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
LLM_MODEL = os.getenv("LLM_MODEL", "gpt-4o-mini")

_client = None


def _get_client():
    global _client
    if _client is None:
        if not OPENAI_API_KEY or OPENAI_API_KEY == "your-openai-api-key-here":
            raise RuntimeError(
                "OPENAI_API_KEY not set! Get one from https://platform.openai.com/api-keys "
                "and add it to backend/.env"
            )
        from openai import AsyncOpenAI
        _client = AsyncOpenAI(api_key=OPENAI_API_KEY)
        logger.info(f"✅ OpenAI client initialized (model: {LLM_MODEL})")
    return _client


async def chat_completion(
    messages: List[Dict[str, str]],
    model: Optional[str] = None,
    max_tokens: int = 120,
    temperature: float = 0.85,
) -> str:
    """
    Send messages to OpenAI and get a response.

    Args:
        messages: List of {"role": "system"|"user"|"assistant", "content": "..."}
        model: Override the default model

    Returns:
        The AI response text
    """
    client = _get_client()
    target_model = model or LLM_MODEL

    try:
        response = await client.chat.completions.create(
            model=target_model,
            messages=messages,
            max_tokens=max_tokens,
            temperature=temperature,
        )
        result = (response.choices[0].message.content or "").strip()
        logger.debug(f"OpenAI response: {result[:80]}")
        return result

    except Exception as e:
        logger.error(f"❌ OpenAI API error ({type(e).__name__}): {e}")
        raise


async def chat_completion_stream(
    messages: List[Dict[str, str]],
    model: Optional[str] = None,
):
    """
    Stream responses from OpenAI (yields text chunks).
    """
    client = _get_client()
    target_model = model or LLM_MODEL

    try:
        stream = await client.chat.completions.create(
            model=target_model,
            messages=messages,
            max_tokens=300,
            temperature=0.85,
            stream=True,
        )
        async for chunk in stream:
            delta = chunk.choices[0].delta.content
            if delta:
                yield delta

    except Exception as e:
        logger.error(f"❌ OpenAI streaming error ({type(e).__name__}): {e}")
        yield "I'm having trouble connecting right now. Please try again."


def is_configured() -> bool:
    return bool(OPENAI_API_KEY and OPENAI_API_KEY != "your-openai-api-key-here")

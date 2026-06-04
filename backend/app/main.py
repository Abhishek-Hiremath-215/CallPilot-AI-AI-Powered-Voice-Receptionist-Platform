import asyncio
import sys
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Set event loop policy for Windows to support subprocesses
# This MUST happen at the very top before any other imports
if sys.platform == 'win32':
    try:
        asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
    except Exception:
        pass

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from contextlib import asynccontextmanager
import logging

from .database import engine, Base


from .models import User
from .auth import router as auth_router
from .chat import router as chat_router
from .calls import router as calls_router
from .admin import router as admin_router

logging.basicConfig(
    level=getattr(logging, os.getenv("LOG_LEVEL", "INFO")),
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Path to frontend build
FRONTEND_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "frontend", "dist")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """App startup and shutdown events."""
    logger.info("🚀 Starting CallPilot AI Platform...")
    
    # Create all database tables
    try:
        Base.metadata.create_all(bind=engine)
        logger.info("✅ Database tables created successfully")
    except Exception as e:
        logger.error(f"❌ Database error: {e}")
        logger.error("Make sure PostgreSQL is running and 'automation' database exists!")
    
    # Check Gemini API
    from .llm import is_configured
    if is_configured():
        logger.info("✅ OpenAI API key configured")
    else:
        logger.warning("⚠️ OPENAI_API_KEY not set! AI features will not work.")
        logger.warning("   Get a key at: https://platform.openai.com/api-keys")
    
    # Create default admin if none exists
    from .database import SessionLocal
    from .auth import hash_password
    db = SessionLocal()
    try:
        admin_count = db.query(User).filter(User.is_admin == True).count()
        if admin_count == 0:
            admin_email = os.getenv("ADMIN_EMAIL", "admin@admin.com")
            admin_password = os.getenv("ADMIN_PASSWORD", "admin123")
            admin = User(
                email=admin_email,
                hashed_password=hash_password(admin_password),
                display_name="Admin",
                is_admin=True,
                is_active=True,
                ai_enabled=False
            )
            db.add(admin)
            db.commit()
            logger.info(f"👑 Default admin created: {admin_email}")
    except Exception as e:
        logger.error(f"Admin setup error: {e}")
    finally:
        db.close()
    
    logger.info("✅ CallPilot AI Platform is ready!")
    logger.info(f"📖 API docs: http://localhost:8000/docs")
    if os.path.isdir(FRONTEND_DIR):
        logger.info(f"🌐 Frontend served from: {FRONTEND_DIR}")
    else:
        logger.warning(f"⚠️ Frontend not built. Run 'npm run build' in frontend/")
    
    yield
    
    logger.info("🛑 Shutting down...")


app = FastAPI(
    title="CallPilot AI",
    description="Real-time audio calls and chat with CallPilot AI - your AI-Powered Voice Receptionist Platform",
    version="2.0.0",
    lifespan=lifespan
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Mount routers (API routes — these must come BEFORE static files)
app.include_router(auth_router)
app.include_router(chat_router)
app.include_router(calls_router)
app.include_router(admin_router)


@app.get("/api/health")
async def health_check():
    """Health check endpoint."""
    from .database import SessionLocal
    from .llm import is_configured
    try:
        db = SessionLocal()
        user_count = db.query(User).count()
        db.close()
        return {
            "status": "healthy",
            "database": "connected",
            "llm": "gemini" if is_configured() else "not_configured",
            "users": user_count
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "database": "error",
            "error": str(e)
        }


# Serve frontend static files (JS, CSS, images)
if os.path.isdir(FRONTEND_DIR):
    app.mount("/assets", StaticFiles(directory=os.path.join(FRONTEND_DIR, "assets")), name="static")

    @app.get("/{full_path:path}")
    async def serve_frontend(request: Request, full_path: str):
        """Serve the React SPA — all non-API routes get index.html."""
        # Try to serve the exact file first
        file_path = os.path.join(FRONTEND_DIR, full_path)
        if full_path and os.path.isfile(file_path):
            return FileResponse(file_path)
        # Otherwise serve index.html for SPA routing
        return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))
else:
    @app.get("/")
    async def root():
        return {
            "status": "running",
            "app": "CallPilot AI",
            "version": "2.0.0",
            "message": "Frontend not built. Run 'npm run build' in frontend/"
        }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")

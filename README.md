# CallPilot AI - AI-Powered Voice Receptionist Platform

CallPilot AI is a professional, full-stack platform that allows users to deploy personalized, interactive AI voice receptionists. The AI receptionists handle calls when users are busy, greet callers according to custom prompts, hold natural conversations, and automatically structure and log customer details into organized tickets.

---

## 🚀 Key Features

*   **Smart Call Interception**: If a user is offline or has their AI assistant enabled, CallPilot AI automatically answers incoming calls.
*   **Interactive Voice Dialog**: Uses the browser's Web Speech API for real-time speech-to-text translation.
*   **Piper TTS (Text-to-Speech)**: High-speed, natural-sounding voice responses generated locally on the backend.
*   **Natural Barge-in (Interruption)**: Frontend Voice Activity Detection (VAD) allows callers to cut off the AI mid-sentence to start speaking naturally.
*   **LLM structured Intake Summaries**: At call termination, a background task sends the transcript to the OpenAI LLM to parse and extract caller names, phone numbers, requests, sentiments, and urgency levels.
*   **Admin & Callee Dashboard**: A dashboard to review logs, read full call transcripts, customize greeting names, select voice models, and provide custom prompt guidelines.
*   **Standalone Demo Mode**: An in-browser mock API and WebSocket layer. When hosted statically (e.g. on Netlify), it uses `localStorage` for data persistence and the browser's native `SpeechSynthesis` to simulate the AI's voice, allowing the entire app to run completely client-side.

---

## 🛠️ Technology Stack

*   **Frontend**: React (Vite), TailwindCSS-like custom styling, HTML5 Web Speech API (SpeechRecognition & SpeechSynthesis).
*   **Backend**: FastAPI, Websockets (WebRTC signaling and AI voice stream coordination), Uvicorn.
*   **Database**: PostgreSQL / SQLAlchemy ORM.
*   **AI Integration**: OpenAI API (GPT-4o-mini).
*   **TTS Integration**: Local Piper TTS engine.

---

## 📊 System Architecture & Call Flow

```mermaid
sequenceDiagram
    autonumber
    actor Caller
    participant FE as React Frontend (CallPage)
    participant BE as FastAPI Backend
    participant LLM as OpenAI (GPT-4o-mini)
    participant TTS as Piper TTS (Local)
    participant DB as PostgreSQL Database
    actor Callee as Agent (Dashboard)

    Caller->>FE: Placed Call
    FE->>BE: POST /api/calls/initiate
    Note over BE: Checks Callee's settings.<br/>If Callee.ai_enabled == True:
    BE-->>FE: Returns call_id & ai_handled=True
    
    rect rgb(25, 25, 40)
        Note over FE, BE: Call Setup & AI Greeting
        BE->>LLM: Requests greeting using callee prompt
        LLM-->>BE: Returns greeting text
        BE->>TTS: Generates audio for greeting
        TTS-->>BE: Returns audio bytes (Base64)
        BE->>FE: WebSocket: type "ai_voice_response"
        FE->>Caller: Plays greeting audio
    end

    rect rgb(35, 25, 35)
        Note over FE, BE: Dialog Loop (Barge-in Active)
        Caller->>FE: Speaks
        FE->>FE: Web Speech API transcribes voice
        FE->>BE: WebSocket: "ai_speech_input" (Text)
        BE->>LLM: Requests next response turn
        LLM-->>BE: Returns response text
        BE->>TTS: Generates audio
        TTS-->>BE: Returns audio bytes (Base64)
        BE->>FE: WebSocket: "ai_voice_response"
        FE->>Caller: Plays audio
    end

    rect rgb(25, 35, 30)
        Note over FE, BE: Call Termination & Structured Intake
        Caller->>FE: Hangs up (Clicks "End Call")
        FE->>BE: POST /api/calls/end
        BE->>LLM: Sends full conversation transcript
        Note over LLM: Parses caller details: Name, Phone,<br/>Inquiry text, Urgency, Sentiment
        LLM-->>BE: Returns structured JSON ticket
        BE->>DB: Inserts into AICallData table
        BE->>Callee: WebSocket Notify: "new_call_data"
        Callee->>DB: Reads structured ticket and transcript
    end
```

---

## ⚙️ Local Setup Instructions

### 1. Backend Setup
1. Navigate to the `backend/` directory.
2. Create a virtual environment and activate it:
   ```bash
   python -m venv venv
   venv\Scripts\activate  # Windows
   source venv/bin/activate  # macOS/Linux
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Create a `.env` file based on `.env.example` and fill in your credentials:
   ```env
   OPENAI_API_KEY=your_openai_api_key_here
   DATABASE_URL=postgresql://username:password@localhost:5432/database_name
   ```
5. **Piper TTS Setup (Local Voice Generation)**:
   * Download the standalone Piper Windows release (`piper_windows_amd64.zip`) from the [Rhasspy Piper Releases Page](https://github.com/rhasspy/piper/releases).
   * Create a folder `backend/piper/` and extract the zip contents so that the executable is located at:
     `backend/piper/piper/piper/piper.exe`
   * Download your preferred voice model `.onnx` file and its corresponding `.onnx.json` config file (e.g., `en_US-ryan-medium.onnx` and `en_US-ryan-medium.onnx.json`) from the [Rhasspy Piper Models Repository](https://github.com/rhasspy/piper/releases/tag/v0.0.2).
   * Place both voice files inside the directory:
     `backend/piper/piper/piper/`
6. Run the FastAPI server:
   ```bash
   python -m uvicorn app.main:app --reload --port 8000
   ```

### 2. Frontend Setup
1. Navigate to the `frontend/` directory.
2. Install Node packages:
   ```bash
   npm install
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```
4. To test the static build locally:
   ```bash
   npm run build
   ```

---

## 💡 Demo Mode
When deploying this application on a static host like Netlify or Vercel, click the **⚙️ Mode** toggle in the bottom right corner of the **Login Page** to switch to **Demo Mode**. 
In Demo Mode:
*   A client-side database is simulated and persisted in `localStorage`.
*   WebSockets are mocked locally, allowing the voice conversation loop to run entirely client-side.
*   Browser speech synthesis (`speechSynthesis`) is used to read the AI responses aloud, allowing visitors to have an interactive call experience.

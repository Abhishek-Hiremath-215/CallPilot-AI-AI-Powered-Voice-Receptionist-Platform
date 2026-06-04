export const API_BASE_URL = 'http://localhost:8000';

export const STORAGE_KEY = 'voice_ai_chat_history';
export const MODEL_NAME = 'gpt-4o-mini';
export const SPEECH_LANG = 'en-US';

// TTS Voice options (Edge TTS - Free)
export const TTS_VOICES = {
  MALE_US: 'en-US-AndrewNeural',           // Friendly male voice
  FEMALE_US: 'en-US-AvaNeural',            // Natural female voice
  FEMALE_US_2: 'en-US-EmmaNeural',         // Cheerful female voice
  MALE_US_2: 'en-US-BrianNeural',          // Professional male voice
  MALE_UK: 'en-GB-RyanNeural',             // British male voice
  FEMALE_UK: 'en-GB-SoniaNeural'           // British female voice
};

export const DEFAULT_TTS_VOICE = TTS_VOICES.MALE_US;

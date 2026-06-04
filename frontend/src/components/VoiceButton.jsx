import React from 'react';
import { Mic, MicOff } from 'lucide-react';

const VoiceButton = ({ isListening, isDisabled, onClick }) => {
  return (
    <button
      onClick={onClick}
      disabled={isDisabled}
      className={`p-3 rounded-lg transition-all duration-200 ${
        isListening
          ? 'bg-red-600 hover:bg-red-700 animate-pulse'
          : 'bg-gray-700 hover:bg-gray-600'
      } text-white disabled:opacity-50 disabled:cursor-not-allowed`}
      title={isListening ? 'Stop recording' : 'Start recording'}
    >
      {isListening ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
    </button>
  );
};

export default VoiceButton;

import React from 'react';
import { Mic, MicOff } from 'lucide-react';

const VoiceFab = ({ isListening, onClick, isDisabled }) => {
  return (
    <button
      onClick={onClick}
      disabled={isDisabled}
      className={`relative w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300 shadow-2xl ${
        isListening
          ? 'bg-red-600 hover:bg-red-700 scale-110'
          : 'bg-green-600 hover:bg-green-700 hover:scale-105'
      } disabled:opacity-50 disabled:cursor-not-allowed`}
    >
      {isListening ? (
        <>
          <div className="absolute inset-0 rounded-full bg-red-500 opacity-75 animate-ping"></div>
          <MicOff className="w-12 h-12 text-white relative z-10" />
        </>
      ) : (
        <Mic className="w-12 h-12 text-white" />
      )}
    </button>
  );
};

export default VoiceFab;

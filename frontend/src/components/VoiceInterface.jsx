import React from 'react';
import { Mic, Volume2, StopCircle, Loader2 } from 'lucide-react';

const VoiceInterface = ({ 
  isListening, 
  isSpeaking, 
  onToggle, 
  isDisabled,
  onInterrupt 
}) => {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-gray-900 via-gray-900 to-transparent pb-8 pt-12">
      <div className="max-w-4xl mx-auto flex flex-col items-center">
        {/* Status Text */}
        <div className="mb-6 text-center min-h-[24px]">
          {isListening && (
            <div className="flex items-center gap-2 justify-center">
              <div className="flex gap-1">
                <span className="w-1 h-4 bg-blue-400 rounded-full animate-pulse"></span>
                <span className="w-1 h-4 bg-blue-400 rounded-full animate-pulse delay-75"></span>
                <span className="w-1 h-4 bg-blue-400 rounded-full animate-pulse delay-150"></span>
              </div>
              <p className="text-blue-400 text-sm font-medium">
                Listening...
              </p>
            </div>
          )}
          {isSpeaking && !isListening && (
            <div className="flex items-center gap-2 text-green-400 text-sm font-medium">
              <Volume2 className="w-4 h-4 animate-pulse" />
              <span>AI is speaking...</span>
              <button
                onClick={onInterrupt}
                className="ml-2 px-3 py-1 bg-red-500 hover:bg-red-600 rounded-full text-white text-xs transition-colors flex items-center gap-1"
              >
                <StopCircle className="w-3 h-3" />
                Interrupt
              </button>
            </div>
          )}
          {!isListening && !isSpeaking && !isDisabled && (
            <p className="text-gray-400 text-sm">
              Tap to speak
            </p>
          )}
          {isDisabled && !isSpeaking && (
            <div className="flex items-center gap-2 text-gray-500 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              Processing...
            </div>
          )}
        </div>

        {/* Main Controls */}
        <div className="flex items-center gap-4">
          {/* Interrupt Button (visible when AI is speaking) */}
          {isSpeaking && (
            <button
              onClick={onInterrupt}
              className="w-14 h-14 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-all duration-200 shadow-lg hover:scale-105 animate-fade-in"
            >
              <StopCircle className="w-6 h-6 text-white" />
            </button>
          )}

          {/* Main Microphone Button */}
          <div className="relative">
            {/* Outer pulse rings when listening */}
            {isListening && (
              <>
                <div className="absolute inset-0 rounded-full bg-blue-500 opacity-75 animate-ping"></div>
                <div className="absolute -inset-4 rounded-full bg-blue-500 opacity-50 animate-pulse"></div>
              </>
            )}
            
            {/* Speaking indicator rings */}
            {isSpeaking && !isListening && (
              <>
                <div className="absolute inset-0 rounded-full bg-green-500 opacity-60 animate-pulse"></div>
                <div className="absolute -inset-2 rounded-full bg-green-500 opacity-30 animate-ping"></div>
              </>
            )}
            
            {/* Main circular button */}
            <button
              onClick={onToggle}
              disabled={isDisabled && !isSpeaking}
              className={`relative w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 shadow-2xl ${
                isListening
                  ? 'bg-blue-600 scale-110 ring-4 ring-blue-400 ring-opacity-50'
                  : isSpeaking
                  ? 'bg-green-600 scale-105'
                  : 'bg-blue-500 hover:bg-blue-600 hover:scale-105'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {isDisabled && !isSpeaking ? (
                <Loader2 className="w-10 h-10 text-white animate-spin" />
              ) : (
                <Mic className={`w-10 h-10 text-white ${isListening ? 'animate-pulse' : ''}`} />
              )}
            </button>
          </div>
        </div>

        {/* Hint Text */}
        <div className="mt-6 text-center">
          <p className="text-gray-500 text-xs max-w-md">
            {isListening 
              ? "Speak naturally. I'm here to listen." 
              : isSpeaking 
              ? "Speak 2+ words to interrupt me anytime"
              : "Press and speak to start our conversation"}
          </p>
        </div>
      </div>
    </div>
  );
};

export default VoiceInterface;

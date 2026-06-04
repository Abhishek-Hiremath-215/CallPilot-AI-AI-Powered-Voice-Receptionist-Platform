import React from 'react';
import { Mic } from 'lucide-react';

const PushToTalkButton = ({ isTalking, isListening, onTalkStart, onTalkEnd }) => {
  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        {/* Outer pulse ring when listening */}
        {isListening && (
          <>
            <div className="absolute inset-0 rounded-full bg-blue-500 animate-ping opacity-75"></div>
            <div className="absolute inset-0 rounded-full bg-blue-500 animate-pulse opacity-50" style={{ animationDuration: '1.5s' }}></div>
          </>
        )}
        
        {/* Main button */}
        <button
          onMouseDown={onTalkStart}
          onMouseUp={onTalkEnd}
          onMouseLeave={onTalkEnd}
          onTouchStart={onTalkStart}
          onTouchEnd={onTalkEnd}
          className={`relative w-32 h-32 rounded-full transition-all duration-200 flex items-center justify-center shadow-2xl ${
            isTalking
              ? 'bg-blue-600 scale-95'
              : 'bg-blue-500 hover:bg-blue-600 hover:scale-105'
          }`}
          style={{
            touchAction: 'none',
            userSelect: 'none',
            WebkitUserSelect: 'none'
          }}
        >
          <Mic className="w-16 h-16 text-white" />
        </button>
      </div>
      
      {/* Instructions */}
      <div className="mt-6 text-center">
        <p className="text-white text-lg font-semibold">
          {isListening ? 'Listening...' : 'Hold to Talk'}
        </p>
        <p className="text-gray-400 text-sm mt-1">
          {isListening ? 'Release when done' : 'Press and hold the button to speak'}
        </p>
      </div>
    </div>
  );
};

export default PushToTalkButton;

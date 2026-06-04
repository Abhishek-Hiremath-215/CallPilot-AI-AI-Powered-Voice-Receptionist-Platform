import React from 'react';
import { PhoneOff, Trash2 } from 'lucide-react';
import PushToTalkButton from './PushToTalkButton';
import CallMessage from './CallMessage';
import LoadingDots from './LoadingDots';

const PhoneCallUI = ({
  messages,
  isLoading,
  isTalking,
  isSpeaking,
  isListening,
  onTalkStart,
  onTalkEnd,
  onEndCall,
  onClearHistory,
  messagesEndRef,
  error
}) => {
  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 p-4 shadow-lg">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-white">AI Voice Call</h1>
            <p className="text-sm text-gray-400">
              {isSpeaking ? 'AI is speaking...' : isListening ? 'Listening...' : 'Hold button to talk'}
            </p>
          </div>
          <button
            onClick={onClearHistory}
            className="flex items-center gap-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors duration-200"
            title="Clear conversation"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Conversation Area */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-3xl mx-auto space-y-3">
          {messages.map((message, index) => (
            <CallMessage key={index} message={message} />
          ))}
          
          {isLoading && messages[messages.length - 1]?.content === '' && (
            <LoadingDots />
          )}
          
          {error && (
            <div className="text-center text-red-400 text-sm bg-red-900/20 py-2 px-4 rounded-lg">
              Error: {error}
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Push-to-Talk Control Area */}
      <div className="bg-gray-800 border-t border-gray-700 p-8">
        <div className="max-w-4xl mx-auto">
          <PushToTalkButton
            isTalking={isTalking}
            isListening={isListening}
            onTalkStart={onTalkStart}
            onTalkEnd={onTalkEnd}
          />
          
          {/* End Call Button */}
          <div className="flex justify-center mt-6">
            <button
              onClick={onEndCall}
              className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-full transition-all duration-200 flex items-center gap-2 shadow-lg hover:shadow-xl"
            >
              <PhoneOff className="w-5 h-5" />
              End Call
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PhoneCallUI;

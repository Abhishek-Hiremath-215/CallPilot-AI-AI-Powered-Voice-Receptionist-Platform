import React from 'react';
import { Send } from 'lucide-react';

const ChatInput = ({ inputText, setInputText, onSend, isLoading, isSpeaking }) => {
  const handleSubmit = (e) => {
    e.preventDefault();
    if (inputText.trim() && !isSpeaking) onSend();
  };
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(e); }
  };

  return (
    <div className="border-t border-border bg-secondary p-4">
      <form onSubmit={handleSubmit} className="max-w-4xl mx-auto">
        <div className="flex gap-2 items-end">
          <div className="flex-1 relative">
            <textarea value={inputText} onChange={(e) => setInputText(e.target.value)} onKeyPress={handleKeyPress}
              placeholder="Type your message..." disabled={isSpeaking} rows="1"
              className="w-full px-4 py-3 bg-card text-txt rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50 disabled:cursor-not-allowed border border-border"
              style={{ minHeight: '50px', maxHeight: '150px', overflowY: inputText.length > 100 ? 'auto' : 'hidden' }} />
            {isLoading && <div className="absolute right-3 top-3 text-accent text-xs">AI is typing...</div>}
          </div>
          <button type="submit" disabled={!inputText.trim() || isSpeaking}
            className="px-6 py-3 bg-accent hover:bg-accent-light disabled:bg-hover disabled:cursor-not-allowed text-white rounded-xl transition-colors flex items-center gap-2">
            <Send className="w-5 h-5" /> Send
          </button>
        </div>
      </form>
    </div>
  );
};
export default ChatInput;

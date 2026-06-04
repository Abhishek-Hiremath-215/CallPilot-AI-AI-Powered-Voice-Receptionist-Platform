import React from 'react';

const ChatMessage = ({ message }) => {
  const isUser = message.role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-3xl px-4 py-3 rounded-2xl ${isUser ? 'bg-accent text-white rounded-br-sm' : 'bg-card text-txt border border-border rounded-bl-sm'
        }`}>
        <p className="whitespace-pre-wrap break-words">{message.content}</p>
      </div>
    </div>
  );
};
export default ChatMessage;

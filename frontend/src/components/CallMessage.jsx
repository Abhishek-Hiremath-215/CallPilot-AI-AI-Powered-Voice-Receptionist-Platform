import React from 'react';
import { User, Bot } from 'lucide-react';

const CallMessage = ({ message }) => {
  const isUser = message.role === 'user';
  return (
    <div className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      <div className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${isUser ? 'bg-accent' : 'bg-card border border-border'}`}>
        {isUser ? <User className="w-6 h-6 text-white" /> : <Bot className="w-6 h-6 text-txt" />}
      </div>
      <div className={`max-w-2xl px-4 py-2 rounded-2xl ${isUser ? 'bg-accent text-white' : 'bg-card text-txt border border-border'}`}>
        <p className="whitespace-pre-wrap break-words text-sm">{message.content}</p>
      </div>
    </div>
  );
};
export default CallMessage;

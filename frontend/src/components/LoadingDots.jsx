import React from 'react';

const LoadingDots = () => {
  return (
    <div className="flex justify-start">
      <div className="bg-gray-700 text-gray-100 px-4 py-3 rounded-2xl rounded-bl-none">
        <div className="flex gap-1">
          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
        </div>
      </div>
    </div>
  );
};

export default LoadingDots;

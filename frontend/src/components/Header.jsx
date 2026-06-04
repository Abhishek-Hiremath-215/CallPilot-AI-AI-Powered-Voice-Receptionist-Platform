import React from 'react';
import { Trash2 } from 'lucide-react';

const Header = ({ onClearHistory, children }) => {
  return (
    <div className="bg-gray-800/50 backdrop-blur-sm border-b border-gray-700 p-4 shadow-lg">
      <div className="max-w-6xl mx-auto flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-white">AI Voice Assistant</h1>
          <p className="text-xs text-gray-400">Chat or talk naturally</p>
        </div>
        
        <div className="flex items-center gap-4">
          {children}
          <button
            onClick={onClearHistory}
            className="flex items-center gap-2 px-3 py-2 bg-gray-700/50 hover:bg-gray-600 text-white rounded-lg transition-colors text-sm"
          >
            <Trash2 className="w-4 h-4" />
            Clear
          </button>
        </div>
      </div>
    </div>
  );
};

export default Header;

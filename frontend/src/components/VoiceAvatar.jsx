import React from 'react';
import { Mic, MicOff, MessageSquare, Settings } from 'lucide-react';
const VoiceAvatar = ({ 
  isActive, 
  isListening, 
  isSpeaking, 
  isProcessing,
  currentTranscript,
  avatarConfig,
  onToggle,
  onSettings,
  onModeSwitch
}) => {

  const avatarMap = {
    child: { male: '/avatars/child_male.png', female: '/avatars/child_female.png' },
    teenager: { male: '/avatars/teen_male.png', female: '/avatars/teen_female.png' },
    young_adult: { male: '/avatars/young_adult_male.png', female: '/avatars/young_adult_female.png' },
    middle_aged: { male: '/avatars/middle_male.png', female: '/avatars/middle_female.png' },
    senior: { male: '/avatars/senior_male.png', female: '/avatars/senior_female.png' },
  };

  const getAvatarImage = () => {
    const { age, gender } = avatarConfig;
    const src = avatarMap[age]?.[gender] || '/avatars/default.png';
    return <img src={src} alt="AI Avatar" className="w-full h-full object-cover rounded-full" />;
  };

  const getVoiceDescription = () => {
    const { age, gender } = avatarConfig;
    const genderText = gender === 'male' ? 'Male' : 'Female';
    const ageText = {
      child: 'Child',
      teenager: 'Teen',
      young_adult: 'Young Adult',
      middle_aged: 'Adult',
      senior: 'Senior'
    }[age] || 'Adult';
    return `${genderText} ${ageText} Voice`;
  };

  return (
    <div className="relative w-full h-screen bg-black flex flex-col items-center justify-center">
      {/* Top controls */}
      <div className="absolute top-4 right-4 flex gap-2">
        <button onClick={onSettings} className="p-3 bg-gray-800 hover:bg-gray-700 rounded-full text-white" title="Customize AI Voice">
          <Settings className="w-5 h-5" />
        </button>
        <button onClick={onModeSwitch} className="p-3 bg-gray-800 hover:bg-gray-700 rounded-full text-white" title="Switch to Chat">
          <MessageSquare className="w-5 h-5" />
        </button>
      </div>

      {/* Voice info badge */}
      <div className="absolute top-4 left-4 px-4 py-2 bg-gray-800/80 backdrop-blur-sm rounded-full">
        <p className="text-gray-300 text-sm">{getVoiceDescription()}</p>
      </div>

      {/* Avatar Circle */}
      <div className="relative mb-8 w-48 h-48 rounded-full overflow-hidden shadow-lg">
        {/* Glow rings */}
        {isListening && <div className="absolute inset-0 rounded-full bg-blue-500 opacity-30 animate-ping"></div>}
        {isSpeaking && <div className="absolute inset-0 rounded-full bg-green-500 opacity-30 animate-ping"></div>}
        {/* Avatar Image */}
        {getAvatarImage()}
      </div>

      {/* Status & Transcript */}
      <div className="text-center mb-8 min-h-[100px]">
        {isSpeaking && <div className="text-green-400 text-2xl font-medium animate-pulse mb-2">Speaking...</div>}
        {isListening && !isSpeaking && <div className="text-blue-400 text-2xl font-medium animate-pulse mb-2">Listening...</div>}
        {isProcessing && !isSpeaking && <div className="text-yellow-400 text-2xl font-medium mb-2">Thinking...</div>}
        {!isActive && <div className="text-gray-400 text-2xl font-medium mb-2">Ready to talk</div>}

        {currentTranscript && (
          <div className="mt-4 px-6 py-3 bg-gray-800/50 rounded-lg max-w-2xl">
            <p className="text-white text-lg">{currentTranscript}</p>
          </div>
        )}
      </div>

      {/* Control button */}
      <button
        onClick={onToggle}
        className={`w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 shadow-2xl ${
          isActive ? 'bg-red-600 hover:bg-red-700 scale-110' : 'bg-green-600 hover:bg-green-700 hover:scale-105'
        }`}
      >
        {isActive ? <MicOff className="w-10 h-10 text-white" /> : <Mic className="w-10 h-10 text-white" />}
      </button>
      <p className="text-white text-sm mt-4">{isActive ? 'Tap to stop' : 'Tap to start talking'}</p>
      {isActive && <p className="text-gray-400 text-xs mt-2">Interrupt me anytime by speaking</p>}
    </div>
  );
};

export default VoiceAvatar;

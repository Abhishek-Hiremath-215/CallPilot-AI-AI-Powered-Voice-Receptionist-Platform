import React, { useState } from 'react';
import { X } from 'lucide-react';

const AvatarSettings = ({ config, onSave, onClose }) => {
  const [settings, setSettings] = useState(config);

  const ageOptions = [
    { value: 'child', label: 'Child (6-12)', desc: 'High-pitched, youthful voice' },
    { value: 'teenager', label: 'Teenager (13-19)', desc: 'Young, energetic voice' },
    { value: 'young_adult', label: 'Young Adult (20-35)', desc: 'Natural adult voice' },
    { value: 'middle_aged', label: 'Middle Aged (36-55)', desc: 'Mature, experienced voice' },
    { value: 'senior', label: 'Senior (55+)', desc: 'Wise, deeper voice' }
  ];

  const genderOptions = [
    { value: 'male', label: 'Male Voice', desc: 'Deeper, masculine voice' },
    { value: 'female', label: 'Female Voice', desc: 'Softer, feminine voice' }
  ];

  const styleOptions = [
    { value: 'professional', label: 'Professional', desc: 'Formal and clear' },
    { value: 'friendly', label: 'Friendly', desc: 'Warm and conversational' },
    { value: 'casual', label: 'Casual', desc: 'Relaxed and informal' }
  ];

  // Map avatar images for each combination
  const avatarImages = {
    child: {
      male: '/avatars/child_male.png',
      female: '/avatars/child_female.png'
    },
    teenager: {
      male: '/avatars/teen_male.png',
      female: '/avatars/teen_female.png'
    },
    young_adult: {
      male: '/avatars/young_adult_male.png',
      female: '/avatars/young_adult_female.png'
    },
    middle_aged: {
      male: '/avatars/middle_male.png',
      female: '/avatars/middle_female.png'
    },
    senior: {
      male: '/avatars/senior_male.png',
      female: '/avatars/senior_female.png'
    }
  };

  const handleChange = (field, value) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-bold text-white">Customize AI Assistant</h2>
            <p className="text-gray-400 text-sm mt-1">Choose your AI's voice and appearance</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="space-y-6">
          {/* Gender Selection */}
          <div>
            <label className="block text-white text-sm font-medium mb-3">AI Voice Gender</label>
            <p className="text-gray-400 text-xs mb-3">Choose the voice you prefer to hear</p>
            <div className="grid grid-cols-2 gap-3">
              {genderOptions.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => handleChange('gender', opt.value)}
                  className={`p-4 rounded-lg transition-all ${
                    settings.gender === opt.value
                      ? 'bg-blue-600 text-white ring-2 ring-blue-400'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  <div className="font-medium">{opt.label}</div>
                  <div className="text-xs opacity-80 mt-1">{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Age Selection */}
          <div>
            <label className="block text-white text-sm font-medium mb-3">AI Voice Age</label>
            <p className="text-gray-400 text-xs mb-3">Different ages have different voice characteristics</p>
            <select
              value={settings.age}
              onChange={(e) => handleChange('age', e.target.value)}
              className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {ageOptions.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.label} - {opt.desc}
                </option>
              ))}
            </select>
          </div>

          {/* Style Selection */}
          <div>
            <label className="block text-white text-sm font-medium mb-3">Conversation Style</label>
            <p className="text-gray-400 text-xs mb-3">How the AI talks to you</p>
            <div className="grid grid-cols-3 gap-2">
              {styleOptions.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => handleChange('style', opt.value)}
                  className={`p-3 rounded-lg transition-all text-sm ${
                    settings.style === opt.value
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  <div className="font-medium">{opt.label}</div>
                  <div className="text-xs opacity-80 mt-1">{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div className="bg-gray-700/50 rounded-lg p-4 border border-gray-600">
            <p className="text-gray-400 text-sm mb-3 font-medium">Preview:</p>
            <div className="flex items-center justify-center gap-4">
              <div className="w-24 h-24 rounded-full overflow-hidden shadow-lg border border-gray-600">
                <img
                  src={avatarImages[settings.age]?.[settings.gender] || '/avatars/default.png'}
                  alt="AI Avatar Preview"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1">
                <div className="text-white font-medium mb-1">
                  {settings.gender === 'male' ? 'Male' : 'Female'}{' '}
                  {ageOptions.find(a => a.value === settings.age)?.label}
                </div>
                <div className="text-gray-400 text-sm">
                  {styleOptions.find(s => s.value === settings.style)?.label} style
                </div>
              </div>
            </div>
          </div>

          {/* Info note */}
          <div className="bg-blue-900/30 border border-blue-700/50 rounded-lg p-3">
            <p className="text-blue-300 text-xs">
              💡 <strong>Tip:</strong> Anyone can choose any voice! Pick the voice that makes you most comfortable during conversations.
            </p>
          </div>

          {/* Save button */}
          <button
            onClick={() => onSave(settings)}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors shadow-lg"
          >
            Save & Apply Voice
          </button>
        </div>
      </div>
    </div>
  );
};

export default AvatarSettings;

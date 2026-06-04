import React from 'react';
import { X, Music } from 'lucide-react';

const MusicPlayer = ({ youtubeUrl, onClose }) => {
  if (!youtubeUrl) return null;

  // Extract video ID from URL
  const getVideoId = (url) => {
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)/);
    return match ? match[1] : null;
  };

  const videoId = getVideoId(youtubeUrl);

  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-lg max-w-4xl w-full p-6">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2 text-white">
            <Music className="w-6 h-6 text-blue-400" />
            <h2 className="text-xl font-bold">Calming Music for You</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {videoId ? (
          <div className="aspect-video rounded-lg overflow-hidden">
            <iframe
              width="100%"
              height="100%"
              src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
              title="YouTube video player"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            ></iframe>
          </div>
        ) : (
          <div className="aspect-video bg-gray-800 rounded-lg flex items-center justify-center">
            <p className="text-gray-400">Invalid YouTube URL</p>
          </div>
        )}

        <p className="text-gray-400 text-sm mt-4 text-center">
          Take a moment to relax and breathe deeply 🧘
        </p>
      </div>
    </div>
  );
};

export default MusicPlayer;

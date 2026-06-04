import { useState, useRef } from 'react';
import { API_BASE_URL } from '../utils/constants';

export const useSpeechSynthesis = (avatarConfig) => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const audioRef = useRef(null);
  const audioQueueRef = useRef([]);
  const isProcessingRef = useRef(false);

  const speak = async (text) => {
    if (!text?.trim()) return;
    
    // Break long text into sentences
    const sentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [text];
    
    sentences.forEach(sentence => {
      if (sentence.trim()) {
        audioQueueRef.current.push(sentence.trim());
      }
    });
    
    if (!isProcessingRef.current) processQueue();
  };

  const processQueue = async () => {
    if (audioQueueRef.current.length === 0) {
      isProcessingRef.current = false;
      setIsSpeaking(false);
      return;
    }

    isProcessingRef.current = true;
    setIsSpeaking(true);
    const text = audioQueueRef.current.shift();

    try {
      // Send age and gender from avatar config
      const response = await fetch(`${API_BASE_URL}/api/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: text,
          age: avatarConfig?.age || 'young_adult',
          gender: avatarConfig?.gender || 'female'
        }),
      });

      if (!response.ok) throw new Error('TTS failed');

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);

      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }

      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        audioRef.current = null;
        processQueue();
      };

      audio.onerror = () => {
        URL.revokeObjectURL(audioUrl);
        audioRef.current = null;
        processQueue();
      };

      await audio.play();
    } catch (error) {
      console.error('TTS Error:', error);
      processQueue();
    }
  };

  const cancel = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    audioQueueRef.current = [];
    isProcessingRef.current = false;
    setIsSpeaking(false);
  };

  return { 
    isSpeaking, 
    isSupported: true, 
    speak, 
    cancel 
  };
};

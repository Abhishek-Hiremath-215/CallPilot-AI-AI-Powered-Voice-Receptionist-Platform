import { useState, useEffect, useRef, useCallback } from 'react';
import { SPEECH_LANG } from '../utils/constants';

export const useSpeechRecognition = () => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isSupported, setIsSupported] = useState(false);
  const recognitionRef = useRef(null);
  const timeoutRef = useRef(null);
  const finalTranscriptRef = useRef('');
  const isStoppingRef = useRef(false);
  const restartAttemptsRef = useRef(0);

  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      setIsSupported(true);
      
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      
      // MOBILE OPTIMIZED SETTINGS
      recognitionRef.current.continuous = false;  // Better for mobile
      recognitionRef.current.interimResults = false;  // Only final results
      recognitionRef.current.lang = SPEECH_LANG;
      recognitionRef.current.maxAlternatives = 1;

      recognitionRef.current.onstart = () => {
        console.log('🎤 Recognition started');
        setIsListening(true);
        isStoppingRef.current = false;
        restartAttemptsRef.current = 0;
      };

      recognitionRef.current.onresult = (event) => {
        console.log('📝 Got result, total:', event.results.length);
        
        // Only process final results
        let finalText = '';
        for (let i = 0; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            finalText += event.results[i][0].transcript;
          }
        }

        if (finalText.trim()) {
          console.log('✅ Final:', finalText);
          finalTranscriptRef.current = finalText.trim();
          setTranscript(finalText.trim());
          
          // Auto-stop after getting result
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
          timeoutRef.current = setTimeout(() => {
            if (recognitionRef.current && isListening && !isStoppingRef.current) {
              try {
                recognitionRef.current.stop();
              } catch (e) {
                console.log('Already stopped');
              }
            }
          }, 100);
        }
      };

      recognitionRef.current.onerror = (event) => {
        console.error('❌ Recognition error:', event.error);
        
        // Handle different error types
        if (event.error === 'no-speech') {
          console.log('⚠️ No speech detected');
          setIsListening(false);
        } else if (event.error === 'aborted') {
          console.log('⚠️ Aborted');
          setIsListening(false);
        } else if (event.error === 'network') {
          console.log('⚠️ Network error');
          setIsListening(false);
        } else {
          setIsListening(false);
        }
      };

      recognitionRef.current.onend = () => {
        console.log('🛑 Recognition ended');
        setIsListening(false);
        isStoppingRef.current = false;
        
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
      };
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          // Ignore
        }
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const startListening = useCallback(() => {
    if (!recognitionRef.current) return;
    
    // Prevent multiple start attempts
    if (isListening || isStoppingRef.current) {
      console.log('⚠️ Already listening or stopping');
      return;
    }

    // Reset state
    finalTranscriptRef.current = '';
    setTranscript('');
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    try {
      console.log('▶️ Starting recognition...');
      recognitionRef.current.start();
    } catch (error) {
      console.error('Start error:', error);
      
      // If already started, just update state
      if (error.message.includes('already started')) {
        setIsListening(true);
      }
    }
  }, [isListening]);

  const stopListening = useCallback(() => {
    if (!recognitionRef.current || !isListening) return;
    
    isStoppingRef.current = true;
    
    try {
      console.log('⏸️ Stopping recognition...');
      recognitionRef.current.stop();
    } catch (error) {
      console.error('Stop error:', error);
    }
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  }, [isListening]);

  const resetTranscript = useCallback(() => {
    console.log('🔄 Resetting transcript');
    finalTranscriptRef.current = '';
    setTranscript('');
  }, []);

  return {
    isListening,
    transcript,
    isSupported,
    startListening,
    stopListening,
    resetTranscript
  };
};

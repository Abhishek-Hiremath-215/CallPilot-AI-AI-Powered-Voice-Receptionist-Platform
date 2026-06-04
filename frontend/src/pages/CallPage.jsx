import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { authAPI, callsAPI } from '../services/api';
import { useCall } from '../context/CallContext';

export default function CallPage() {
    const { userId } = useParams();
    const [searchParams] = useSearchParams();
    const callId = searchParams.get('callId');
    const aiHandled = searchParams.get('aiHandled') === 'true';
    const navigate = useNavigate();

    const [calleeInfo, setCalleeInfo] = useState(null);
    const [callState, setCallState] = useState(aiHandled ? 'connected' : 'ringing');
    const [callDuration, setCallDuration] = useState(0);
    const [isMuted, setIsMuted] = useState(false);
    const [aiResponses, setAiResponses] = useState([]);
    const [liveTranscript, setLiveTranscript] = useState('');
    const [lastSent, setLastSent] = useState('');
    const [debugText, setDebugText] = useState('');
    const [phase, setPhase] = useState('idle');
    const [micLevel, setMicLevel] = useState(0);

    const { subscribeToSignals, sendSignal, clearIncoming } = useCall();
    const shouldAccept = searchParams.get('shouldAccept') === 'true';

    const peerRef = useRef(null);
    const localStreamRef = useRef(null);
    const timerRef = useRef(null);
    const recRef = useRef(null);
    const audioRef = useRef(null);
    const remoteAudioRef = useRef(null);
    const signalQueueRef = useRef([]);
    const isSpeakingRef = useRef(false);
    const mountedRef = useRef(true);
    const callStateRef = useRef(callState);
    const silenceTimerRef = useRef(null);
    const transcriptRef = useRef('');
    const greetingDoneRef = useRef(false);
    const micAnimRef = useRef(null);
    const restartTimerRef = useRef(null);
    const thinkingTimeoutRef = useRef(null);
    const bargeCooldownRef = useRef(false);

    const phaseRef = useRef(phase);
    const shouldListenRef = useRef(false);

    useEffect(() => { callStateRef.current = callState; }, [callState]);
    useEffect(() => { phaseRef.current = phase; }, [phase]);

    useEffect(() => {
        mountedRef.current = true;
        authAPI.searchUsers(userId).then(data => {
            if (Array.isArray(data)) {
                const m = data.find(u => u.id === parseInt(userId));
                if (m) setCalleeInfo(m);
            }
        }).catch(() => {});

        const init = async () => {
            if (!aiHandled) await setupWebRTC();
            if (shouldAccept) sendSignal('accept_call', { call_id: parseInt(callId) });
            while (signalQueueRef.current.length) handleSignal(signalQueueRef.current.shift());
        };
        init();

        const unsub = subscribeToSignals(handleSignal);
        if (aiHandled) startTimer();

        return () => { mountedRef.current = false; unsub(); cleanup(); };
    }, []);

    const setupWebRTC = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            localStreamRef.current = stream;
            const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
            stream.getTracks().forEach(t => pc.addTrack(t, stream));
            pc.onicecandidate = e => { if (e.candidate) sendSignal('ice_candidate', { target_id: parseInt(userId), candidate: e.candidate }); };
            pc.ontrack = e => { if (remoteAudioRef.current) remoteAudioRef.current.srcObject = e.streams[0]; };
            peerRef.current = pc;
        } catch (e) { console.error('WebRTC failed:', e); }
    };

    const handleSignal = async (data) => {
        if (!mountedRef.current) return;
        if (data.call_id && callId && parseInt(data.call_id) !== parseInt(callId)) {
            console.log(`Ignoring signal of type ${data.type} with mismatching call_id: ${data.call_id} (current call_id: ${callId})`);
            return;
        }
        const needsPeer = ['webrtc_offer', 'webrtc_answer', 'ice_candidate'].includes(data.type);
        if (needsPeer && !peerRef.current && !aiHandled) { signalQueueRef.current.push(data); return; }

        if (data.type === 'call_accepted') {
            setCallState('connected'); if (!timerRef.current) startTimer();
            if (peerRef.current) {
                const offer = await peerRef.current.createOffer();
                await peerRef.current.setLocalDescription(offer);
                sendSignal('webrtc_offer', { target_id: parseInt(userId), offer });
            }
        }
        if (data.type === 'webrtc_offer' && peerRef.current) {
            setCallState('connected'); if (!timerRef.current) startTimer();
            await peerRef.current.setRemoteDescription(new RTCSessionDescription(data.offer));
            const ans = await peerRef.current.createAnswer();
            await peerRef.current.setLocalDescription(ans);
            sendSignal('webrtc_answer', { target_id: parseInt(userId), answer: ans });
        }
        if (data.type === 'webrtc_answer' && peerRef.current) await peerRef.current.setRemoteDescription(new RTCSessionDescription(data.answer));
        if (data.type === 'ice_candidate' && peerRef.current) try { await peerRef.current.addIceCandidate(new RTCIceCandidate(data.candidate)); } catch {}
        if (data.type === 'call_rejected' || data.type === 'call_ended') {
            callStateRef.current = 'ended';
            setCallState('ended');
            cleanup();
            setTimeout(() => navigate('/'), 2000);
        }

        if (data.type === 'ai_voice_response') {
            const text = data.text || '';
            // Block exact duplicate while already speaking it
            if (isSpeakingRef.current && text === aiResponses[aiResponses.length - 1]) return;
            clearTimeout(thinkingTimeoutRef.current);
            setAiResponses(prev => [...prev, text]);
            isSpeakingRef.current = true;
            setPhase('speaking');
            stopListening();
            if (data.audio_available && data.audio_base64) playPiperAudio(data.audio_base64);
            else if (text) speakBrowser(text);
            else scheduleListenRestart();
        }
    };

    const scheduleListenRestart = useCallback(() => {
        isSpeakingRef.current = false;
        if (!mountedRef.current || callStateRef.current !== 'connected') return;
        clearTimeout(restartTimerRef.current);
        restartTimerRef.current = setTimeout(() => {
            if (mountedRef.current && !isSpeakingRef.current) {
                setPhase('listening');
                shouldListenRef.current = true;
                startListening();
            }
        }, 600);
    }, []);

    const playPiperAudio = (b64) => {
        try {
            const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
            const audio = new Audio(URL.createObjectURL(new Blob([bytes], { type: 'audio/wav' })));
            audioRef.current = audio;
            let done = false;
            const onDone = () => { if (!done) { done = true; scheduleListenRestart(); } };
            audio.onended = onDone; audio.onerror = onDone;
            audio.play().catch(onDone);
        } catch { scheduleListenRestart(); }
    };

    const speakBrowser = (text) => {
        if (!window.speechSynthesis) { scheduleListenRestart(); return; }
        window.speechSynthesis.cancel();
        const utt = new SpeechSynthesisUtterance(text);
        utt.lang = 'en-US'; utt.rate = 1.05; utt.volume = 1.0;
        let fired = false;
        const done = () => { if (!fired) { fired = true; scheduleListenRestart(); } };
        utt.onend = done; utt.onerror = done;
        const go = () => {
            const voices = window.speechSynthesis.getVoices();
            const v = voices.find(v => v.lang.startsWith('en') && (v.name.includes('Google') || v.name.includes('Microsoft'))) || voices.find(v => v.lang.startsWith('en'));
            if (v) utt.voice = v;
            window.speechSynthesis.speak(utt);
            setTimeout(() => { if (!fired) { window.speechSynthesis.cancel(); done(); } }, 30000);
        };
        if (window.speechSynthesis.getVoices().length > 0) go();
        else { window.speechSynthesis.onvoiceschanged = () => { window.speechSynthesis.onvoiceschanged = null; go(); }; }
    };

    // ── Barge-in + Mic meter ─────────────────────────────────────────────────
    // Monitors mic the ENTIRE call. If user speaks while AI is talking → cut AI off immediately.
    const startMicMonitor = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            const ctx = new AudioContext();
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 256;
            ctx.createMediaStreamSource(stream).connect(analyser);
            const buf = new Uint8Array(analyser.frequencyBinCount);
            const BARGE_THRESHOLD = 20; // 0-128, increase to make less sensitive

            const tick = () => {
                if (!mountedRef.current) { stream.getTracks().forEach(t => t.stop()); return; }
                analyser.getByteFrequencyData(buf);
                const avg = buf.reduce((a, b) => a + b, 0) / buf.length;
                setMicLevel(Math.min(100, avg * 2.5));

                // BARGE-IN: detect user voice while AI speaks
                if (isSpeakingRef.current && avg > BARGE_THRESHOLD && !bargeCooldownRef.current) {
                    bargeCooldownRef.current = true;
                    setTimeout(() => { bargeCooldownRef.current = false; }, 2500);
                    // Cut AI off
                    window.speechSynthesis?.cancel();
                    if (audioRef.current) audioRef.current.pause();
                    isSpeakingRef.current = false;
                    clearTimeout(restartTimerRef.current);
                    clearTimeout(thinkingTimeoutRef.current);
                    setPhase('listening');
                    if (!recRef.current) startListening();
                }

                micAnimRef.current = requestAnimationFrame(tick);
            };
            tick();
        } catch (e) { console.warn('Mic monitor failed:', e); }
    }, []);

    // ── Speech Recognition (continuous false, auto-restart) ──────────────────
    const startListening = useCallback(() => {
        if (isSpeakingRef.current || recRef.current) return;
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SR) {
            console.warn('Speech recognition not supported in this browser. Please use Chrome or Edge.');
            return;
        }

        shouldListenRef.current = true;
        const rec = new SR();
        rec.continuous = true;
        rec.interimResults = true;
        rec.lang = 'en-US';
        recRef.current = rec;

        rec.onstart = () => { if (mountedRef.current) setPhase('listening'); };

        rec.onresult = (event) => {
            if (isSpeakingRef.current) return;
            let finalTranscript = '';
            let interimTranscript = '';
            for (let i = 0; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript;
                } else {
                    interimTranscript += event.results[i][0].transcript;
                }
            }
            const cur = (finalTranscript + interimTranscript).trim();
            if (cur) { transcriptRef.current = cur; setLiveTranscript(cur); }

            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = setTimeout(() => {
                const toSend = transcriptRef.current.trim();
                if (toSend && !isSpeakingRef.current && shouldListenRef.current) {
                    stopListening();
                    setLiveTranscript('');
                    setLastSent(toSend); 
                    setPhase('thinking');
                    sendSignal('ai_speech_input', { text: toSend, call_id: parseInt(callId) });
                    clearTimeout(thinkingTimeoutRef.current);
                    thinkingTimeoutRef.current = setTimeout(() => {
                        if (mountedRef.current && !isSpeakingRef.current && phaseRef.current === 'thinking') { 
                            setPhase('listening'); 
                            shouldListenRef.current = true;
                            startListening(); 
                        }
                    }, 15000);
                }
            }, 1500);
        };

        rec.onerror = (e) => {
            if (e.error === 'aborted') {
                console.log('Speech recognition session stopped/aborted by the application.');
            } else {
                console.error('Speech recognition error event:', e.error);
            }
        };

        rec.onend = () => {
            recRef.current = null;
            if (!mountedRef.current || isSpeakingRef.current || !shouldListenRef.current) return;
            if (callStateRef.current === 'connected') {
                setTimeout(() => {
                    if (mountedRef.current && !isSpeakingRef.current && !recRef.current && shouldListenRef.current) {
                        startListening();
                    }
                }, 200);
            }
        };

        try { rec.start(); } catch { recRef.current = null; }
    }, []);

    const stopListening = useCallback(() => {
        shouldListenRef.current = false;
        clearTimeout(silenceTimerRef.current);
        if (recRef.current) { try { recRef.current.stop(); } catch {} recRef.current = null; }
    }, []);

    useEffect(() => {
        if (callState === 'connected' && aiHandled) {
            startMicMonitor();
            const fallback = setTimeout(() => {
                if (mountedRef.current && !isSpeakingRef.current && !recRef.current) { 
                    setPhase('listening'); 
                    shouldListenRef.current = true;
                    startListening(); 
                }
            }, 5000);
            return () => clearTimeout(fallback);
        }
    }, [callState]);

    const startTimer = () => {
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = setInterval(() => { if (mountedRef.current) setCallDuration(p => p + 1); }, 1000);
    };
    const fmt = s => `${String(Math.floor(s / 60)).padStart(2,'0')}:${String(s % 60).padStart(2,'0')}`;

    const toggleMute = () => {
        const next = !isMuted; setIsMuted(next);
        if (localStreamRef.current) localStreamRef.current.getAudioTracks().forEach(t => { t.enabled = !next; });
    };
    const endCall = async () => {
        callStateRef.current = 'ended';
        try { if (callId) await callsAPI.endCall(parseInt(callId)); } catch {}
        setCallState('ended'); cleanup(); setTimeout(() => navigate('/'), 1500);
    };
    const cleanup = () => {
        clearInterval(timerRef.current);
        clearTimeout(silenceTimerRef.current);
        clearTimeout(restartTimerRef.current);
        clearTimeout(thinkingTimeoutRef.current);
        if (micAnimRef.current) cancelAnimationFrame(micAnimRef.current);
        stopListening();
        window.speechSynthesis?.cancel();
        localStreamRef.current?.getTracks().forEach(t => t.stop());
        peerRef.current?.close();
        if (audioRef.current) audioRef.current.pause();
        clearIncoming();
    };
    const sendText = () => {
        const t = debugText.trim(); if (!t) return;
        setLastSent(t); setPhase('thinking');
        sendSignal('ai_speech_input', { text: t, call_id: parseInt(callId) });
        setDebugText('');
    };

    const phases = {
        idle:      { label: 'Ready',           color: 'text-txt-dim',      dot: 'bg-txt-dim' },
        listening: { label: 'Listening...',    color: 'text-success',      dot: 'bg-success' },
        thinking:  { label: 'AI Thinking...',  color: 'text-yellow-400',   dot: 'bg-yellow-400' },
        speaking:  { label: 'AI Speaking...',  color: 'text-accent-light', dot: 'bg-accent' },
    };
    const ph = phases[phase] || phases.idle;

    return (
        <div className="min-h-screen bg-primary flex flex-col items-center justify-center overflow-hidden relative">
            <audio autoPlay playsInline ref={remoteAudioRef} style={{ display:'none' }} />
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute w-[500px] h-[500px] rounded-full bg-accent/10 blur-[150px] -top-40 -left-40 animate-pulse" />
                <div className="absolute w-[400px] h-[400px] rounded-full bg-success/8 blur-[120px] -bottom-20 -right-20 animate-pulse" />
            </div>

            <div className="relative z-10 flex flex-col items-center px-4 max-w-lg w-full">
                {/* Avatar with animated ring */}
                <div className="relative mb-6">
                    {phase === 'listening' && <div className="absolute inset-0 rounded-full bg-success/25 animate-ping scale-125" />}
                    {phase === 'speaking'  && <div className="absolute inset-0 rounded-full bg-accent/25 animate-pulse scale-110" />}
                    <div className={`relative w-28 h-28 rounded-full flex items-center justify-center text-5xl bg-accent/20 ring-4 transition-all duration-300
                        ${phase === 'listening' ? 'ring-success/50' : phase === 'speaking' ? 'ring-accent/50' : phase === 'thinking' ? 'ring-yellow-400/40' : 'ring-accent/20'}`}>
                        {aiHandled ? '🤖' : '👤'}
                    </div>
                </div>

                <h2 className="text-2xl font-bold text-txt mb-1">
                    {aiHandled ? (calleeInfo?.display_name ? `${calleeInfo.display_name}'s AI` : 'AI Assistant') : (calleeInfo?.display_name || 'Calling...')}
                </h2>
                <div className="flex items-center gap-2 mb-1">
                    <span className={`w-2.5 h-2.5 rounded-full ${ph.dot} ${phase === 'listening' ? 'animate-pulse' : ''}`} />
                    <span className={`text-sm font-semibold ${ph.color}`}>{ph.label}</span>
                </div>
                <p className="text-txt-dim text-sm mb-4 flex items-center gap-2">
                    {callState === 'connected' && <><span className="w-2 h-2 bg-success rounded-full animate-pulse" />{fmt(callDuration)}</>}
                    {callState === 'ringing' && '📞 Ringing...'}
                    {callState === 'ended' && '📵 Call Ended'}
                </p>

                {/* Barge-in hint */}
                {phase === 'speaking' && (
                    <p className="text-xs text-accent-light/60 mb-3 animate-pulse">Just start speaking to interrupt</p>
                )}

                {/* Mic level bars (visible while listening) */}
                {phase === 'listening' && (
                    <div className="flex items-end justify-center gap-0.5 h-8 mb-3">
                        {Array.from({ length: 20 }).map((_, i) => (
                            <div key={i}
                                className={`w-1.5 rounded-full transition-all duration-75 ${micLevel > (i / 20) * 100 ? 'bg-success' : 'bg-success/15'}`}
                                style={{ height: `${16 + i * 1.2}px` }} />
                        ))}
                    </div>
                )}

                {/* AI Responses */}
                {aiResponses.length > 0 && (
                    <div className="w-full mb-4 space-y-2 max-h-48 overflow-y-auto">
                        {aiResponses.slice(-3).map((r, i) => (
                            <div key={i} className="flex items-start gap-2.5 bg-card/60 backdrop-blur border border-border rounded-2xl px-4 py-3">
                                <span className="text-lg shrink-0">🤖</span>
                                <p className="text-txt text-sm leading-relaxed">{r}</p>
                            </div>
                        ))}
                    </div>
                )}

                {liveTranscript && (
                    <div className="w-full mb-3 bg-success/10 border border-success/30 rounded-xl px-4 py-3">
                        <p className="text-success text-sm">🎤 {liveTranscript}<span className="inline-block w-0.5 h-4 bg-success ml-1 animate-pulse" /></p>
                    </div>
                )}
                {!liveTranscript && lastSent && phase === 'thinking' && (
                    <div className="w-full mb-3 bg-accent/10 border border-accent/20 rounded-xl px-4 py-3">
                        <p className="text-accent-light text-sm italic">You: "{lastSent}"</p>
                    </div>
                )}

                {/* Text fallback */}
                {aiHandled && callState === 'connected' && (
                    <div className="w-full mb-6 flex gap-2">
                        <input type="text" value={debugText}
                            onChange={e => setDebugText(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && sendText()}
                            placeholder="Or type your message..."
                            disabled={phase === 'thinking' || phase === 'speaking'}
                            className="flex-1 bg-card/60 backdrop-blur border border-border rounded-xl px-4 py-2.5 text-sm text-txt focus:outline-none focus:border-accent disabled:opacity-50" />
                        <button onClick={sendText} disabled={!debugText.trim()}
                            className="bg-accent hover:bg-accent-light disabled:opacity-40 text-white rounded-xl px-4 py-2 text-sm transition-all">
                            Send
                        </button>
                    </div>
                )}

                {/* Controls */}
                <div className="flex items-center gap-6">
                    <button onClick={toggleMute} className={`flex flex-col items-center gap-1.5 ${isMuted ? 'text-danger' : 'text-txt-dim'}`}>
                        <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${isMuted ? 'bg-danger/20' : 'bg-card border border-border hover:bg-hover'}`}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-6 h-6">
                                {isMuted ? <><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2c0 .51-.06 1-.16 1.47"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></>
                                : <><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></>}
                            </svg>
                        </div>
                        <span className="text-xs">{isMuted ? 'Unmute' : 'Mute'}</span>
                    </button>

                    <button onClick={endCall}>
                        <div className="w-16 h-16 bg-danger rounded-full flex items-center justify-center hover:bg-danger/80 transition-all shadow-[0_0_20px_rgba(225,112,85,0.4)]">
                            <svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7 text-white">
                                <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08a.956.956 0 0 1-.29-.7c0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28a11.27 11.27 0 0 0-2.67-1.85.996.996 0 0 1-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z"/>
                            </svg>
                        </div>
                    </button>

                    <div className="flex flex-col items-center gap-1.5 text-txt-dim">
                        <div className="w-14 h-14 rounded-full flex items-center justify-center bg-card border border-border">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-6 h-6">
                                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                                <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
                            </svg>
                        </div>
                        <span className="text-xs">Speaker</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

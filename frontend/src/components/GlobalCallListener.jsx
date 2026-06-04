import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCall } from '../context/CallContext';

export default function GlobalCallListener() {
    const { incomingCall, sendSignal, clearIncoming } = useCall();
    const navigate = useNavigate();
    const [ringtoneVisible, setRingtoneVisible] = useState(false);

    useEffect(() => {
        if (incomingCall) {
            setRingtoneVisible(true);
            if ('vibrate' in navigator) navigator.vibrate([500, 200, 500]);
        } else {
            setRingtoneVisible(false);
        }
    }, [incomingCall]);

    const handleAccept = () => {
        if (!incomingCall) return;
        const callData = incomingCall;
        clearIncoming();
        navigate(`/call/${callData.caller.id}?callId=${callData.call_id}&aiHandled=false&shouldAccept=true`);
    };

    const handleReject = () => {
        if (!incomingCall) return;
        sendSignal('reject_call', { call_id: incomingCall.call_id });
        clearIncoming();
    };

    if (!ringtoneVisible || !incomingCall) return null;

    return (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[9999] w-[90%] max-w-[400px] animate-slide-down">
            <div className="bg-secondary/95 backdrop-blur-lg border border-border/50 rounded-2xl p-4 flex items-center gap-4 shadow-[0_10px_40px_rgba(0,0,0,0.5)]">
                <div className="w-12 h-12 bg-accent rounded-[14px] flex items-center justify-center font-bold text-xl text-white shrink-0">
                    {incomingCall.caller.display_name[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                    <h4 className="text-accent-light text-sm font-semibold m-0">Incoming {incomingCall.call_type} Call</h4>
                    <p className="text-txt text-base font-bold my-0.5">{incomingCall.caller.display_name}</p>
                    <span className="text-txt-dim text-xs">{incomingCall.caller.email}</span>
                </div>
                <div className="flex gap-3">
                    <button onClick={handleReject}
                        className="w-11 h-11 rounded-full bg-danger text-white flex items-center justify-center cursor-pointer border-none shadow-[0_0_15px_rgba(255,23,68,0.4)] hover:scale-110 transition-transform">
                        <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                            <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08a.956.956 0 0 1-.29-.7c0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28a11.27 11.27 0 0 0-2.67-1.85.996.996 0 0 1-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z" />
                        </svg>
                    </button>
                    <button onClick={handleAccept}
                        className="w-11 h-11 rounded-full bg-success text-white flex items-center justify-center cursor-pointer border-none shadow-[0_0_15px_rgba(0,200,83,0.4)] hover:scale-110 transition-transform">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="20" height="20">
                            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    );
}

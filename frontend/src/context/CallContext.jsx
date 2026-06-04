import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { callsAPI, getToken, getUser } from '../services/api';

const CallContext = createContext(null);

export const useCall = () => useContext(CallContext);

export const CallProvider = ({ children }) => {
    const [incomingCall, setIncomingCall] = useState(null);
    const wsRef = useRef(null);
    const reconnectTimeoutRef = useRef(null);
    const reconnectAttemptRef = useRef(0);
    const subscribersRef = useRef(new Set());
    const signalBufferRef = useRef([]);
    const mountedRef = useRef(true);

    const subscribeToSignals = useCallback((callback) => {
        subscribersRef.current.add(callback);
        signalBufferRef.current.forEach(callback);
        return () => subscribersRef.current.delete(callback);
    }, []);

    const connectSignaling = useCallback(() => {
        const token = getToken();
        if (!token || !mountedRef.current) return;

        // Skip if already connecting or open
        if (wsRef.current) {
            const state = wsRef.current.readyState;
            if (state === WebSocket.OPEN || state === WebSocket.CONNECTING) return;
        }

        const ws = callsAPI.connectSignaling(token);
        wsRef.current = ws;

        ws.onopen = () => {
            if (!mountedRef.current) { ws.close(); return; }
            console.log('✅ Call Signaling Connected');
            reconnectAttemptRef.current = 0;
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'incoming_call') {
                    setIncomingCall(data);
                } else {
                    signalBufferRef.current.push(data);
                    if (signalBufferRef.current.length > 10) signalBufferRef.current.shift();
                    subscribersRef.current.forEach(cb => cb(data));
                }
            } catch (err) {
                console.error('Failed to parse signal:', err);
            }
        };

        ws.onclose = (event) => {
            wsRef.current = null;
            if (!mountedRef.current) return;

            // Exponential backoff reconnection
            const isAuthPage = ['/login', '/register'].includes(window.location.pathname);
            if (getToken() && !isAuthPage && event.code !== 1000) {
                const delay = Math.min(3000 * Math.pow(1.5, reconnectAttemptRef.current), 30000);
                reconnectAttemptRef.current++;
                if (reconnectAttemptRef.current <= 10) {
                    reconnectTimeoutRef.current = setTimeout(connectSignaling, delay);
                }
            }
        };

        ws.onerror = () => {}; // Errors trigger onclose, no separate handling needed
    }, []);

    useEffect(() => {
        mountedRef.current = true;
        const isAuthPage = ['/login', '/register'].includes(window.location.pathname);
        const token = getToken();

        if (token && !isAuthPage) {
            connectSignaling();
        }

        return () => {
            mountedRef.current = false;
            if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
            
            if (wsRef.current) {
                const socket = wsRef.current;
                wsRef.current = null;
                // Detach all handlers to prevent any callbacks after unmount
                socket.onopen = null;
                socket.onmessage = null;
                socket.onclose = null;
                socket.onerror = null;
                if (socket.readyState === WebSocket.OPEN) {
                    socket.close(1000, "Cleanup");
                }
            }
        };
    }, []);

    const sendSignal = useCallback((action, data = {}) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ action, ...data }));
            return true;
        }
        return false;
    }, []);

    const clearIncoming = useCallback(() => {
        setIncomingCall(null);
        signalBufferRef.current = [];
    }, []);

    return (
        <CallContext.Provider value={{
            incomingCall,
            sendSignal,
            clearIncoming,
            subscribeToSignals,
            connectSignaling
        }}>
            {children}
        </CallContext.Provider>
    );
};

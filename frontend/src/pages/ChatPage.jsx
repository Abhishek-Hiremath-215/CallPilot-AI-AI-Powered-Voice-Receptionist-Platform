import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { chatAPI, callsAPI, getUser, getToken } from '../services/api';

export default function ChatPage() {
    const { id: conversationId } = useParams();
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [ws, setWs] = useState(null);
    const [typing, setTyping] = useState(null);
    const [otherUser, setOtherUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const messagesEndRef = useRef(null);
    const user = getUser();
    const navigate = useNavigate();
    const typingTimeoutRef = useRef(null);

    useEffect(() => {
        loadMessages();
        connectWebSocket();
        return () => { if (ws) ws.close(); };
    }, [conversationId]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, typing]);

    const loadMessages = async () => {
        try {
            const msgs = await chatAPI.getMessages(conversationId);
            setMessages(msgs);
            const convos = await chatAPI.getConversations();
            const current = convos.find(c => c.id === parseInt(conversationId));
            if (current?.other_user) setOtherUser(current.other_user);
        } catch (err) {
            console.error('Failed to load messages:', err);
        } finally {
            setLoading(false);
        }
    };

    const connectWebSocket = () => {
        const token = getToken();
        if (!token) return;
        const socket = chatAPI.connectWebSocket(token);
        socket.onopen = () => console.log('🟢 Chat WebSocket connected');
        socket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === 'new_message' && data.message.conversation_id === parseInt(conversationId)) {
                setMessages(prev => {
                    if (prev.find(m => m.id === data.message.id)) return prev;
                    return [...prev, data.message];
                });
                setTyping(null);
            }
            if (data.type === 'typing' && data.conversation_id === parseInt(conversationId)) {
                setTyping(data.user_name);
                if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
                typingTimeoutRef.current = setTimeout(() => setTyping(null), 3000);
            }
        };
        socket.onerror = (err) => console.error('WebSocket error:', err);
        socket.onclose = () => console.log('🔴 Chat WebSocket closed');
        setWs(socket);
    };

    const sendMessage = (e) => {
        e.preventDefault();
        if (!input.trim() || !ws || ws.readyState !== WebSocket.OPEN) return;
        ws.send(JSON.stringify({ action: 'send_message', conversation_id: parseInt(conversationId), content: input.trim() }));
        setInput('');
    };

    const handleInputChange = (e) => {
        setInput(e.target.value);
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ action: 'typing', conversation_id: parseInt(conversationId) }));
        }
    };

    const startCall = async () => {
        if (!otherUser) return;
        try {
            const result = await callsAPI.initiateCall(otherUser.id);
            navigate(`/call/${otherUser.id}?callId=${result.call_id}&aiHandled=${result.ai_handled}`);
        } catch (err) {
            console.error('Failed to initiate call:', err);
        }
    };

    return (
        <div className="flex flex-col h-screen lg:h-[calc(100vh-2rem)] bg-primary overflow-hidden">
            {/* Header */}
            <header className="flex items-center gap-3 px-3 md:px-6 py-3 bg-secondary border-b border-white/5 shrink-0 z-10">
                <button onClick={() => navigate('/')} className="p-2 -ml-2 hover:bg-white/5 rounded-lg text-txt-dim transition-colors">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="20" height="20"><polyline points="15 18 9 12 15 6" /></svg>
                </button>
                <div className="flex items-center gap-2.5 md:gap-3 flex-1 min-w-0">
                    <div className="relative w-9 h-9 md:w-10 md:h-10 bg-accent rounded-full flex items-center justify-center text-white font-bold shrink-0 text-sm md:text-base">
                        {(otherUser?.display_name || '?')[0].toUpperCase()}
                        {otherUser?.is_online && <span className="absolute bottom-0 right-0 w-2.5 h-2.5 md:w-3 md:h-3 bg-success rounded-full border-2 border-secondary" />}
                    </div>
                    <div className="min-w-0">
                        <h3 className="text-txt font-bold text-xs md:text-sm truncate">{otherUser?.display_name || 'Loading...'}</h3>
                        <p className="text-txt-dimmer text-[10px] md:text-xs flex items-center gap-1.5">
                            {otherUser?.ai_enabled && <span className="bg-accent/20 text-accent px-1 rounded-[4px] font-bold text-[8px] md:text-[9px]">🤖 AI Agent</span>}
                            <span className="truncate">{otherUser?.is_online ? 'Online' : 'Offline'}</span>
                        </p>
                    </div>
                </div>
                <button onClick={startCall} className="w-10 h-10 md:w-11 md:h-11 bg-success/10 text-success rounded-xl flex items-center justify-center hover:bg-success hover:text-white transition-all">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="20" height="20">
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                    </svg>
                </button>
            </header>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4 md:space-y-6">
                {loading ? (
                    <div className="flex items-center justify-center h-full text-txt-dim text-sm">Loading chats...</div>
                ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full space-y-4 text-center px-8">
                        <div className="w-16 h-16 bg-accent/10 rounded-3xl flex items-center justify-center text-3xl">👋</div>
                        <div>
                            <p className="text-txt font-bold text-lg">No messages yet</p>
                            <p className="text-txt-dimmer text-sm mt-1">Start your connection with {otherUser?.display_name || 'them'}!</p>
                        </div>
                    </div>
                ) : (
                    messages.map((msg) => (
                        <div key={msg.id} className={`flex ${msg.sender_id === user?.id ? 'justify-end' : 'justify-start'} animate-fade-in`}>
                            <div className={`max-w-[85%] md:max-w-[70%] px-4 py-3 rounded-2xl shadow-sm ${msg.sender_id === user?.id
                                ? 'bg-accent text-white rounded-br-sm'
                                : msg.is_ai_generated
                                    ? 'bg-success/10 text-txt border border-success/20 rounded-bl-sm'
                                    : 'bg-card text-txt border border-white/5 rounded-bl-sm'
                                }`}>
                                {msg.is_ai_generated && <span className="text-[8px] bg-success/20 text-success px-1.5 py-0.5 rounded font-bold mb-1.5 inline-block uppercase tracking-wider">🤖 AI Response</span>}
                                <p className="text-sm leading-relaxed">{msg.content}</p>
                                <span className={`text-[10px] font-medium block mt-1.5 opacity-50 ${msg.sender_id === user?.id ? 'text-right' : 'text-left'}`}>
                                    {new Date(msg.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                        </div>
                    ))
                )}
                {typing && (
                    <div className="flex items-center gap-2 text-txt-dim text-[11px] px-2">
                        <span className="font-semibold italic">{typing} is typing...</span>
                        <div className="flex gap-1">
                            <span className="w-1.5 h-1.5 bg-accent/40 rounded-full animate-bounce [animation-duration:800ms]" />
                            <span className="w-1.5 h-1.5 bg-accent/40 rounded-full animate-bounce [animation-duration:800ms] [animation-delay:200ms]" />
                            <span className="w-1.5 h-1.5 bg-accent/40 rounded-full animate-bounce [animation-duration:800ms] [animation-delay:400ms]" />
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Bar */}
            <form onSubmit={sendMessage} className="px-3 md:px-6 py-4 bg-secondary/80 backdrop-blur-xl border-t border-white/5 shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))]">
                <div className="max-w-4xl mx-auto flex items-center gap-2 md:gap-3">
                    <input type="text" value={input} onChange={handleInputChange} placeholder="Type message..."
                        className="flex-1 px-4 py-3 bg-primary border border-white/5 rounded-xl text-sm text-txt placeholder-txt-dimmer outline-none focus:border-accent/40 shadow-inner transition-all" />
                    <button type="submit" disabled={!input.trim()}
                        className="w-11 h-11 md:w-12 md:h-12 bg-accent text-white rounded-xl flex items-center justify-center hover:scale-105 active:scale-95 transition-all disabled:opacity-20 disabled:scale-100 disabled:grayscale shrink-0 shadow-lg shadow-accent/20">
                        <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20" className="rotate-45 -mt-0.5 -ml-0.5"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" /></svg>
                    </button>
                </div>
            </form>
        </div>
    );
}

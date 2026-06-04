import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { chatAPI, callsAPI, authAPI, getUser, setAuth, clearAuth, getToken } from '../services/api';

export default function Dashboard() {
    const [conversations, setConversations] = useState([]);
    const [allUsers, setAllUsers] = useState([]);
    const [newEmail, setNewEmail] = useState('');
    const [user, setUser] = useState(getUser());
    const [showAddChat, setShowAddChat] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);
    const [aiToggling, setAiToggling] = useState(false);
    const [userSearch, setUserSearch] = useState('');
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        loadConversations();
        loadProfile();
        loadAllUsers();
    }, []);

    const loadConversations = async () => {
        try {
            const data = await chatAPI.getConversations();
            setConversations(data);
        } catch (err) { console.error('Failed to load conversations:', err); }
        finally { setLoading(false); }
    };

    const loadProfile = async () => {
        try {
            const profile = await authAPI.getProfile();
            setUser(profile);
            setAuth(getToken(), profile);
        } catch (err) { console.error('Failed to load profile:', err); }
    };

    const loadAllUsers = async (search = '') => {
        try {
            const users = await authAPI.searchUsers(search);
            setAllUsers(users);
        } catch (err) { console.error('Failed to load users:', err); }
    };

    const handleNewChat = async (e) => {
        e.preventDefault();
        setError('');
        try {
            const conv = await chatAPI.createConversation(newEmail);
            setNewEmail(''); setShowAddChat(false); loadConversations();
            navigate(`/chat/${conv.id}`);
        } catch (err) { setError(err.message); }
    };

    const toggleAI = async () => {
        setAiToggling(true);
        try {
            const updated = await authAPI.updateProfile({ ai_enabled: !user.ai_enabled });
            setUser(updated); setAuth(getToken(), updated);
        } catch (err) { console.error('Failed to toggle AI:', err); }
        finally { setAiToggling(false); }
    };

    const handleLogout = () => { clearAuth(); navigate('/login'); };
    const handleUserSearch = (e) => {
        const val = e.target.value;
        setUserSearch(val); loadAllUsers(val);
    };

    const startChatWithUser = async (email) => {
        try {
            const conv = await chatAPI.createConversation(email);
            loadConversations(); navigate(`/chat/${conv.id}`);
        } catch (err) { console.error('Failed to start chat:', err); }
    };

    const startCallWithUser = async (userObj) => {
        try {
            const resp = await callsAPI.initiateCall(userObj.id);
            navigate(`/call/${userObj.id}?callId=${resp.call_id}&aiHandled=${resp.ai_handled}`);
        } catch (err) { console.error('Failed to start call:', err); }
    };

    return (
        <div className="flex h-screen bg-primary overflow-hidden text-txt">
            {/* Mobile Overlay */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            {/* Sidebar - Precise 280px width, responsive drawer on mobile */}
            <aside className={`
                fixed inset-y-0 left-0 w-72 bg-secondary border-r border-border flex flex-col z-50 transition-transform duration-300 transform
                lg:translate-x-0 lg:static lg:z-auto
                ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
            `}>
                {/* User Info Header */}
                <div className="p-4 flex items-center justify-between border-b border-white/5">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-accent rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-[0_4px_12px_rgba(124,77,255,0.3)]">
                            {(user?.display_name || user?.email || '?')[0].toUpperCase()}
                        </div>
                        <div className="min-w-0">
                            <h3 className="text-txt font-semibold text-sm truncate">{user?.display_name || 'User'}</h3>
                            <p className="text-txt-dimmer text-[10px] truncate">{user?.email}</p>
                        </div>
                    </div>
                    <button onClick={handleLogout} className="text-txt-dimmer hover:text-danger p-2 rounded-lg hover:bg-white/5 transition-all lg:hidden">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                            <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                    </button>
                    <button onClick={handleLogout} className="text-txt-dimmer hover:text-danger p-2 rounded-lg hover:bg-white/5 transition-all hidden lg:block">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
                        </svg>
                    </button>
                </div>

                {/* AI Status Card */}
                <div className="mx-3 mt-5 p-3.5 glass rounded-2xl flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className={`w-2.5 h-2.5 rounded-full ${user?.ai_enabled ? 'bg-success shadow-[0_0_8px_#00e676]' : 'bg-txt-dimmer'}`} />
                        <div>
                            <p className="text-[10px] font-bold text-txt-dim uppercase tracking-widest">AI Status</p>
                            <p className="text-[11px] font-semibold text-txt">{user?.ai_enabled ? 'Active Agent' : 'Disabled'}</p>
                        </div>
                    </div>
                    <button onClick={toggleAI} disabled={aiToggling}
                        className={`relative w-10 h-5.5 rounded-full transition-all ${user?.ai_enabled ? 'bg-accent' : 'bg-white/10'}`}>
                        <span className={`absolute top-0.5 w-4.5 h-4.5 bg-white rounded-full transition-all ${user?.ai_enabled ? 'left-5' : 'left-0.5'}`} />
                    </button>
                </div>

                {/* AI Tools Navigation */}
                <div className="flex gap-2 px-3 mt-2">
                    <button onClick={() => navigate('/ai-settings')} className="flex-1 py-1.5 glass rounded-lg text-[9px] font-bold uppercase tracking-wider text-txt-dim hover:text-white transition-all">Settings</button>
                    <button onClick={() => navigate('/ai-call-data')} className="flex-1 py-1.5 glass rounded-lg text-[9px] font-bold uppercase tracking-wider text-txt-dim hover:text-white transition-all">Report</button>
                </div>

                {/* Chats List */}
                <div className="flex-1 overflow-y-auto mt-6 px-3">
                    <div className="flex items-center justify-between mb-3">
                        <p className="text-[10px] font-bold text-txt-dimmer uppercase tracking-[0.2em]">Live Chats</p>
                        <button onClick={() => setShowAddChat(!showAddChat)} className="text-accent text-xs font-bold hover:scale-110 transition-transform">+</button>
                    </div>

                    {showAddChat && (
                        <form onSubmit={handleNewChat} className="mb-4 animate-fade-in">
                            <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="Friend's email..." autoFocus required
                                className="w-full px-3 py-2 bg-black/20 border border-white/10 rounded-xl text-xs text-txt outline-none focus:border-accent" />
                        </form>
                    )}

                    {conversations.map((conv) => (
                        <div key={conv.id} onClick={() => { navigate(`/chat/${conv.id}`); setIsSidebarOpen(false); }}
                            className="flex items-center gap-3 p-3 rounded-2xl cursor-pointer hover:bg-white/5 transition-all mb-1.5 border border-transparent hover:border-white/5 group">
                            <div className="relative w-9 h-9 bg-accent/10 border border-accent/20 text-accent rounded-full flex items-center justify-center font-bold text-xs shrink-0 group-hover:bg-accent group-hover:text-white transition-all">
                                {(conv.name || '?')[0].toUpperCase()}
                                {conv.other_user?.is_online && <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-success rounded-full border-2 border-secondary" />}
                            </div>
                            <div className="flex-1 min-w-0">
                                <h4 className="text-txt font-semibold text-xs truncate">{conv.name}</h4>
                                <p className="text-txt-dimmer text-[10px] truncate">{conv.last_message?.content || 'No history'}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </aside>

            {/* Main Content Area - Perfect Centering */}
            <main className="flex-1 flex flex-col relative overflow-hidden h-full">
                {/* Mobile Header Bar */}
                <header className="lg:hidden flex items-center justify-between p-4 bg-secondary/50 backdrop-blur-md border-b border-white/5 z-30">
                    <button onClick={() => setIsSidebarOpen(true)} className="p-2 -ml-2 text-txt hover:bg-white/5 rounded-lg transition-all">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="24" height="24">
                            <line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="18" x2="21" y2="18" />
                        </svg>
                    </button>
                    <div className="w-10 h-10 bg-accent rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-[0_4px_12px_rgba(124,77,255,0.3)]">
                        {(user?.display_name || '?')[0].toUpperCase()}
                    </div>
                </header>

                {/* Visual Depth Blobs */}
                <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-accent/5 blur-[150px] rounded-full pointer-events-none" />
                <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-success/3 blur-[120px] rounded-full pointer-events-none" />

                <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-8 overflow-y-auto z-10">
                    <div className="w-full max-w-4xl flex flex-col items-center text-center animate-fade-in">
                        <div className="mb-6 md:mb-8 p-3 md:p-4 glass rounded-[20px] md:rounded-3xl inline-block shadow-2xl">
                            <h1 className="text-2xl md:text-5xl font-bold text-txt tracking-tight px-2">Welcome, {user?.display_name || 'User'}! 👋</h1>
                        </div>
                        <p className="text-txt-dim text-sm md:text-lg mb-8 md:mb-12 max-w-lg leading-relaxed px-4">Your CallPilot AI Voice Agent is ready. Manage settings, monitor call logs, and review collected customer data.</p>

                        {/* Responsive Stats Grid */}
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-8 mb-8 md:mb-12 w-full px-4 max-w-2xl mx-auto">
                            {[
                                { val: conversations.length, label: 'Active Chats', color: 'accent', icon: '💬' },
                                { val: user?.ai_enabled ? 'ON' : 'OFF', label: 'AI Agent', color: 'success', icon: '🤖' },
                                { val: 'Audio', label: 'Call Ready', color: 'warning', icon: '📞' }
                            ].map((s, i) => (
                                <div key={i} className={`
                                    glass rounded-2xl md:rounded-[40px] p-4 md:p-6 flex flex-col items-center justify-center group hover:scale-105 transition-all duration-500 shadow-2xl relative overflow-hidden cursor-default
                                    ${i === 2 ? 'col-span-2 md:col-span-1 h-32 md:h-44' : 'h-32 md:h-44'}
                                `}>
                                    <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                    <span className="text-xl md:text-3xl mb-1 md:mb-3">{s.icon}</span>
                                    <h3 className="text-lg md:text-2xl font-bold text-txt mb-0.5">{s.val}</h3>
                                    <p className="text-[10px] font-bold text-txt-dim uppercase tracking-widest md:tracking-[0.2em]">{s.label}</p>
                                </div>
                            ))}
                        </div>

                        <div className="flex gap-4 px-4 w-full md:w-auto">
                            <button onClick={() => setShowAddChat(true)} className="flex-1 md:flex-none px-6 md:px-12 py-3.5 md:py-4.5 bg-accent text-white rounded-xl md:rounded-2xl font-bold shadow-[0_12px_40px_rgba(124,77,255,0.4)] hover:scale-105 hover:bg-accent-light transition-all text-sm md:text-base">
                                💬 New Conversation
                            </button>
                        </div>

                        {/* Quick Directory - Responsive Hidden On Small, Scrollable Grid */}
                        <div className="mt-16 md:mt-20 w-full mb-8">
                            <div className="flex flex-col md:flex-row items-center justify-between mb-6 px-4 gap-4">
                                <h2 className="text-xs font-bold text-txt-dim uppercase tracking-widest self-start md:self-auto">Agent Testing Directory</h2>
                                <div className="relative w-full md:w-64">
                                    <input type="text" placeholder="Find users..." value={userSearch} onChange={handleUserSearch}
                                        className="w-full pl-9 pr-4 py-2.5 bg-white/5 border border-white/5 rounded-xl text-xs text-txt outline-none focus:border-accent transition-all" />
                                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[10px] opacity-40">🔍</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 px-4">
                                {(allUsers.length > 0 ? allUsers : []).slice(0, 6).map((u) => (
                                    <div key={u.id} className="glass p-3.5 rounded-2xl flex items-center gap-3 hover:border-accent/40 transition-all group">
                                        <div className="w-9 h-9 bg-accent/20 rounded-xl flex items-center justify-center text-accent font-bold group-hover:bg-accent group-hover:text-white transition-all text-xs">
                                            {(u.display_name || u.email)[0].toUpperCase()}
                                        </div>
                                        <div className="flex-1 min-w-0 text-left">
                                            <h4 className="text-txt font-semibold text-xs truncate">{u.display_name}</h4>
                                            <p className="text-txt-dimmer text-[9px] truncate">{u.email}</p>
                                        </div>
                                        <div className="flex gap-1.5">
                                            <button onClick={() => startChatWithUser(u.email)} className="w-8 h-8 bg-white/5 rounded-lg flex items-center justify-center hover:bg-accent text-[11px] transition-all">💬</button>
                                            <button onClick={() => startCallWithUser(u)} className="w-8 h-8 bg-white/5 rounded-lg flex items-center justify-center hover:bg-success text-[11px] transition-all">📞</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}

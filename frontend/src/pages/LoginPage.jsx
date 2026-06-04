import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authAPI, setAuth, isDemoMode } from '../services/api';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const data = await authAPI.login(email, password);
            setAuth(data.access_token, data.user);
            navigate('/');
        } catch (err) {
            setError(err.message || 'Login failed');
        } finally {
            setLoading(false);
        }
    };
    return (
        <div className="h-screen bg-primary flex flex-col items-center py-12 px-4 relative overflow-x-hidden overflow-y-auto">
            {/* Background Orbs */}
            <div className="absolute top-1/4 -left-20 w-80 h-80 bg-accent/20 blur-[100px] rounded-full" />
            <div className="absolute bottom-1/4 -right-20 w-80 h-80 bg-success/10 blur-[100px] rounded-full" />

            <div className="w-full max-w-md animate-fade-in relative z-10 my-auto">
                <div className="glass rounded-[32px] p-8 md:p-10 shadow-2xl">
                    <div className="text-center mb-10">
                        <div className="w-16 h-16 bg-accent rounded-2xl flex items-center justify-center text-white text-3xl font-bold mx-auto mb-6 shadow-lg shadow-accent/20">
                            📞
                        </div>
                        <h1 className="text-3xl font-bold text-txt tracking-tight">CallPilot AI</h1>
                        <p className="text-txt-dim mt-2">AI-Powered Voice Receptionist Platform</p>
                    </div>

                    {isDemoMode() && (
                        <div className="mb-6 p-4 bg-accent/10 border border-accent/20 rounded-2xl text-txt text-xs leading-relaxed space-y-2 animate-fade-in text-left">
                            <div className="flex items-center gap-2 font-bold text-accent">
                                <span>🚀 Standalone Demo Active</span>
                            </div>
                            <p className="text-txt-dimmer text-[11px]">
                                This application runs completely inside your browser using client-side mock APIs and voice/chat simulation. No local backend is required!
                            </p>
                            <ul className="list-disc pl-4 space-y-1 text-txt-dimmer text-[10px]">
                                <li>Use <strong>Quick Demo Login</strong> below to enter.</li>
                                <li>Simulate real-time voice calls using native browser speech.</li>
                                <li>View logged voice tickets in the report section.</li>
                            </ul>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label className="block text-xs font-bold text-txt-dim uppercase tracking-widest mb-2 ml-1">Email Address</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full px-5 py-4 bg-primary/50 border border-white/5 rounded-2xl text-txt focus:border-accent/50 outline-none transition-all"
                                placeholder="name@example.com"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-txt-dim uppercase tracking-widest mb-2 ml-1">Password</label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full px-5 py-4 bg-primary/50 border border-white/5 rounded-2xl text-txt focus:border-accent/50 outline-none transition-all"
                                placeholder="••••••••"
                                required
                            />
                        </div>

                        {error && (
                            <div className="p-3 bg-danger/10 border border-danger/20 rounded-xl text-danger text-xs text-center animate-shake">
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-4 bg-accent text-white rounded-2xl font-bold shadow-lg shadow-accent/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:scale-100"
                        >
                            {loading ? 'Signing in...' : 'Sign In'}
                        </button>
                    </form>

                    {/* Quick Demo Login */}
                    <div className="mt-8 border-t border-white/5 pt-6">
                        <span className="block text-xs font-bold text-txt-dim uppercase tracking-widest text-center mb-4">Quick Demo Login</span>
                        <div className="flex gap-4">
                            <button
                                type="button"
                                onClick={() => { setEmail('admin@example.com'); setPassword('admin123'); }}
                                className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-txt text-xs font-semibold rounded-xl border border-white/10 transition-all text-center"
                            >
                                Admin Account
                            </button>
                            <button
                                type="button"
                                onClick={() => { setEmail('callee@example.com'); setPassword('admin123'); }}
                                className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-txt text-xs font-semibold rounded-xl border border-white/10 transition-all text-center"
                            >
                                Callee (Alex)
                            </button>
                        </div>
                    </div>

                    <p className="text-center text-txt-dim mt-8 text-sm">
                        Don't have an account?{' '}
                        <Link to="/register" className="text-accent font-bold hover:underline">Create one</Link>
                    </p>
                </div>
            </div>

            {/* Subtle Mode Toggle */}
            <div 
                className="absolute bottom-4 right-4 z-20 text-[11px] text-txt-dimmer flex items-center gap-1.5 cursor-pointer hover:text-txt transition-all select-none"
                onClick={() => {
                    const manualMode = localStorage.getItem('demo_mode');
                    const host = window.location.hostname;
                    const currentIsDemo = manualMode === null ? (host.includes('netlify.app') || host.includes('vercel.app') || host.includes('github.io')) : manualMode === 'true';
                    localStorage.setItem('demo_mode', currentIsDemo ? 'false' : 'true');
                    window.location.reload();
                }}
            >
                <span>⚙️ Mode: <strong>{(() => {
                    const manualMode = localStorage.getItem('demo_mode');
                    const host = window.location.hostname;
                    const currentIsDemo = manualMode === null ? (host.includes('netlify.app') || host.includes('vercel.app') || host.includes('github.io')) : manualMode === 'true';
                    return currentIsDemo ? 'Demo (Mock API)' : 'Local Server';
                })()}</strong></span>
            </div>
        </div>
    );
}

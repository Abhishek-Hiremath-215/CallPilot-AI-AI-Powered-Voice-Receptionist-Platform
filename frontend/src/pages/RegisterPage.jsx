import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authAPI, setAuth } from '../services/api';

export default function RegisterPage() {
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        display_name: '',
        is_admin: false
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            // Remove is_admin from the payload as the backend doesn't expect it
            const { is_admin, ...payload } = formData;
            const data = await authAPI.register(payload);
            setAuth(data.access_token, data.user);
            navigate('/');
        } catch (err) {
            setError(err.message || 'Registration failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="h-screen bg-primary flex flex-col items-center py-12 px-4 relative overflow-x-hidden overflow-y-auto">
            {/* Background Orbs */}
            <div className="absolute top-1/4 -right-20 w-80 h-80 bg-accent/20 blur-[100px] rounded-full" />
            <div className="absolute bottom-1/4 -left-20 w-80 h-80 bg-warning/10 blur-[100px] rounded-full" />

            <div className="w-full max-w-md animate-fade-in relative z-10 my-auto">
                <div className="glass rounded-[32px] p-8 md:p-10 shadow-2xl">
                    <div className="text-center mb-8">
                        <div className="w-16 h-16 bg-accent rounded-2xl flex items-center justify-center text-white text-3xl font-bold mx-auto mb-6 shadow-lg shadow-accent/20">
                            A
                        </div>
                        <h1 className="text-3xl font-bold text-txt tracking-tight">Create Account</h1>
                        <p className="text-txt-dim mt-2">Join our unique AI community</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div>
                            <label className="block text-xs font-bold text-txt-dim uppercase tracking-widest mb-2 ml-1">Display Name</label>
                            <input
                                type="text"
                                value={formData.display_name}
                                onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                                className="w-full px-5 py-3.5 bg-primary/50 border border-white/5 rounded-2xl text-txt focus:border-accent/50 outline-none transition-all"
                                placeholder="Your full name"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-txt-dim uppercase tracking-widest mb-2 ml-1">Email Address</label>
                            <input
                                type="email"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                className="w-full px-5 py-3.5 bg-primary/50 border border-white/5 rounded-2xl text-txt focus:border-accent/50 outline-none transition-all"
                                placeholder="name@example.com"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-txt-dim uppercase tracking-widest mb-2 ml-1">Password</label>
                            <input
                                type="password"
                                value={formData.password}
                                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                className="w-full px-5 py-3.5 bg-primary/50 border border-white/5 rounded-2xl text-txt focus:border-accent/50 outline-none transition-all"
                                placeholder="••••••••"
                                required
                            />
                        </div>

                        {error && (
                            <div className="p-3 bg-danger/10 border border-danger/20 rounded-xl text-danger text-xs text-center">
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-4 bg-accent text-white rounded-2xl font-bold shadow-lg shadow-accent/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:scale-100 mt-4"
                        >
                            {loading ? 'Creating Account...' : 'Create Account'}
                        </button>
                    </form>

                    <p className="text-center text-txt-dim mt-8 text-sm">
                        Already have an account?{' '}
                        <Link to="/login" className="text-accent font-bold hover:underline">Sign In</Link>
                    </p>
                </div>
            </div>
        </div>
    );
}

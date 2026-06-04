import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminAPI, getUser } from '../services/api';

export default function AdminPanel() {
    const [stats, setStats] = useState(null);
    const [users, setUsers] = useState([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();
    const currentUser = getUser();

    useEffect(() => {
        if (!currentUser?.is_admin) { navigate('/'); return; }
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [statsData, usersData] = await Promise.all([adminAPI.getStats(), adminAPI.getUsers()]);
            setStats(statsData);
            setUsers(usersData.users);
        } catch (err) { console.error('Failed to load admin data:', err); }
        finally { setLoading(false); }
    };

    const handleSearch = async () => {
        try { const data = await adminAPI.getUsers(search); setUsers(data.users); }
        catch (err) { console.error('Search failed:', err); }
    };

    const toggleActive = async (userId, currentActive) => {
        try { await adminAPI.updateUser(userId, { is_active: !currentActive }); loadData(); }
        catch (err) { console.error('Update failed:', err); }
    };

    const toggleAdmin = async (userId, currentAdmin) => {
        try { await adminAPI.updateUser(userId, { is_admin: !currentAdmin }); loadData(); }
        catch (err) { console.error('Update failed:', err); }
    };

    const deleteUser = async (userId, email) => {
        if (!window.confirm(`Delete ${email}? This cannot be undone.`)) return;
        try { await adminAPI.deleteUser(userId); loadData(); }
        catch (err) { console.error('Delete failed:', err); }
    };

    if (loading) return (
        <div className="min-h-screen bg-primary flex items-center justify-center">
            <div className="text-center"><div className="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin mx-auto mb-3" /><p className="text-txt-dim">Loading admin panel...</p></div>
        </div>
    );

    return (
        <div className="min-h-screen h-screen bg-primary overflow-y-auto">
            <div className="max-w-6xl mx-auto p-6">
                {/* Header */}
                <header className="mb-8">
                    <button onClick={() => navigate('/')} className="flex items-center gap-2 text-txt-dim hover:text-accent transition-colors text-sm mb-3">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20"><polyline points="15 18 9 12 15 6" /></svg>
                        Back
                    </button>
                    <h1 className="text-2xl font-bold text-txt">👑 Admin Panel</h1>
                    <p className="text-txt-dim text-sm mt-1">Manage users and monitor platform activity</p>
                </header>

                {/* Stats */}
                {stats && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
                        {[
                            { v: stats.total_users, l: 'Total Users' },
                            { v: stats.active_users, l: 'Active' },
                            { v: stats.ai_enabled_users, l: 'AI Enabled', accent: true },
                            { v: stats.total_messages, l: 'Messages' },
                            { v: stats.ai_messages, l: 'AI Messages' },
                            { v: stats.total_calls, l: 'Calls' },
                        ].map((s, i) => (
                            <div key={i} className={`bg-card border rounded-2xl p-4 text-center ${s.accent ? 'border-accent/30' : 'border-border'}`}>
                                <div className={`text-2xl font-bold ${s.accent ? 'text-accent' : 'text-txt'}`}>{s.v}</div>
                                <div className="text-xs text-txt-dim mt-1">{s.l}</div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Search */}
                <div className="flex gap-3 mb-6">
                    <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        placeholder="Search users by name or email..."
                        className="flex-1 px-4 py-3 bg-card border border-border rounded-xl text-txt placeholder-txt-dimmer focus:border-accent focus:outline-none transition-colors" />
                    <button onClick={handleSearch} className="px-6 py-3 bg-accent text-white rounded-xl font-medium hover:bg-accent-light transition-colors">Search</button>
                </div>

                {/* Table */}
                <div className="bg-card border border-border rounded-2xl overflow-hidden overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-border">
                                {['User', 'Email', 'Status', 'AI', 'Role', 'Msgs', 'Calls', 'Actions'].map(h => (
                                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-txt-dim uppercase tracking-wide">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {users.map((u) => (
                                <tr key={u.id} className={`border-b border-border/50 hover:bg-hover transition-colors ${!u.is_active ? 'opacity-50' : ''}`}>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center text-white font-bold text-xs shrink-0">
                                                {(u.display_name || u.email)[0].toUpperCase()}
                                            </div>
                                            <span className="text-txt">{u.display_name || '-'}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-txt-dim">{u.email}</td>
                                    <td className="px-4 py-3">
                                        <span className={`px-2 py-0.5 rounded-md text-xs font-semibold ${u.is_active ? 'bg-success/20 text-success' : 'bg-danger/20 text-danger'}`}>
                                            {u.is_active ? 'Active' : 'Inactive'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`px-2 py-0.5 rounded-md text-xs font-semibold ${u.ai_enabled ? 'bg-accent/20 text-accent' : 'bg-hover text-txt-dimmer'}`}>
                                            {u.ai_enabled ? '🤖 ON' : 'OFF'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`px-2 py-0.5 rounded-md text-xs font-semibold ${u.is_admin ? 'bg-warning/20 text-warning' : 'bg-hover text-txt-dimmer'}`}>
                                            {u.is_admin ? '👑 Admin' : 'User'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-txt-dim">{u.message_count}</td>
                                    <td className="px-4 py-3 text-txt-dim">{u.call_count}</td>
                                    <td className="px-4 py-3">
                                        <div className="flex gap-1">
                                            <button onClick={() => toggleActive(u.id, u.is_active)} title={u.is_active ? 'Deactivate' : 'Activate'}
                                                className="w-8 h-8 bg-hover rounded-lg flex items-center justify-center hover:bg-card transition-colors text-sm">
                                                {u.is_active ? '🚫' : '✅'}
                                            </button>
                                            <button onClick={() => toggleAdmin(u.id, u.is_admin)} title={u.is_admin ? 'Remove Admin' : 'Make Admin'}
                                                className="w-8 h-8 bg-hover rounded-lg flex items-center justify-center hover:bg-card transition-colors text-sm">
                                                {u.is_admin ? '👤' : '👑'}
                                            </button>
                                            <button onClick={() => deleteUser(u.id, u.email)} title="Delete User"
                                                className="w-8 h-8 bg-hover rounded-lg flex items-center justify-center hover:bg-danger/20 transition-colors text-sm">
                                                🗑️
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

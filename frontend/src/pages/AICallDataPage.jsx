import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { callsAPI } from '../services/api';

export default function AICallDataPage() {
    const navigate = useNavigate();
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');
    const [search, setSearch] = useState('');
    const [expandedId, setExpandedId] = useState(null);
    const [stats, setStats] = useState({ total: 0, unread: 0, urgent: 0 });

    useEffect(() => { loadData(); }, [filter]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [items, counts] = await Promise.all([callsAPI.getCollectedData(filter, search), callsAPI.getUnreadCount()]);
            setData(items);
            setStats({ total: items.length, unread: counts.unread, urgent: counts.urgent });
        } catch (err) { console.error('Failed to load call data:', err); }
        finally { setLoading(false); }
    };

    const handleSearch = (e) => { e.preventDefault(); loadData(); };

    const markAsRead = async (id) => {
        try { await callsAPI.markDataRead(id); setData(prev => prev.map(d => d.id === id ? { ...d, is_read: true } : d)); setStats(prev => ({ ...prev, unread: Math.max(0, prev.unread - 1) })); }
        catch (err) { console.error('Failed to mark as read:', err); }
    };

    const toggleExpand = (item) => {
        if (expandedId === item.id) { setExpandedId(null); }
        else { setExpandedId(item.id); if (!item.is_read) markAsRead(item.id); }
    };

    const exportCSV = () => {
        const headers = ['Caller Name', 'Phone', 'Need', 'Urgency', 'Sentiment', 'Summary', 'Date'];
        const rows = data.map(d => [d.caller_name || 'Unknown', d.caller_phone || 'N/A', (d.caller_need || '').replace(/,/g, ';'), d.urgency, d.sentiment, (d.summary || '').replace(/,/g, ';').replace(/\n/g, ' '), d.created_at]);
        const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
        a.download = `ai-call-data-${new Date().toISOString().split('T')[0]}.csv`; a.click();
    };

    const getUrgencyBadge = (u) => {
        if (u === 'high') return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-danger/20 text-danger">🔴 Urgent</span>;
        if (u === 'medium') return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-warning/20 text-warning">🟡 Medium</span>;
        return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-success/15 text-success">🟢 Low</span>;
    };

    const getSentimentIcon = (s) => s === 'positive' ? '😊' : s === 'negative' ? '😠' : '😐';

    const parseTranscript = (raw) => {
        if (!raw) return [];
        try { const p = JSON.parse(raw); return Array.isArray(p) ? p : [p]; }
        catch { return [raw]; }
    };

    return (
        <div className="min-h-screen h-screen bg-primary overflow-y-auto">
            <div className="max-w-4xl mx-auto p-5">
                {/* Header */}
                <div className="mb-5">
                    <div className="flex items-center justify-between">
                        <button onClick={() => navigate('/')} className="px-3 py-1.5 border border-border text-txt-dim rounded-lg text-sm hover:border-accent hover:text-accent transition-colors">← Back</button>
                        <button onClick={() => loadData()} className="px-3 py-1.5 bg-card border border-border text-txt-dim rounded-lg text-sm hover:border-accent hover:text-accent transition-all flex items-center gap-1.5">🔄 Refresh</button>
                    </div>
                    <h1 className="text-2xl font-bold text-txt mt-2">📊 AI Call Data</h1>
                    <p className="text-txt-dim text-sm">Review information collected by your AI assistant</p>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="bg-card border border-border rounded-2xl p-4 text-center">
                        <span className="block text-3xl font-bold text-txt">{stats.total}</span>
                        <span className="text-xs text-txt-dim">Total Calls</span>
                    </div>
                    <div className="bg-card border border-border rounded-2xl p-4 text-center">
                        <span className="block text-3xl font-bold text-accent">{stats.unread}</span>
                        <span className="text-xs text-txt-dim">Unread</span>
                    </div>
                    <div className="bg-card border border-border rounded-2xl p-4 text-center">
                        <span className="block text-3xl font-bold text-danger">{stats.urgent}</span>
                        <span className="text-xs text-txt-dim">Urgent</span>
                    </div>
                </div>

                {/* Toolbar */}
                <div className="flex items-center gap-2.5 mb-4 flex-wrap">
                    <div className="flex gap-2">
                        {[{ key: 'all', label: '📋 All' }, { key: 'unread', label: '🔵 Unread' }, { key: 'urgent', label: '🔴 Urgent' }].map(f => (
                            <button key={f.key} onClick={() => setFilter(f.key)}
                                className={`px-4 py-2 rounded-full text-sm transition-all ${filter === f.key ? 'bg-accent text-white' : 'bg-primary border border-border text-txt-dim'}`}>
                                {f.label}
                            </button>
                        ))}
                    </div>
                    <form onSubmit={handleSearch} className="flex-1 min-w-[180px]">
                        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Search transcripts..."
                            className="w-full px-3 py-2 bg-card border border-border rounded-lg text-txt text-sm placeholder-txt-dimmer focus:border-accent focus:outline-none" />
                    </form>
                    <button onClick={exportCSV} title="Export CSV" className="px-4 py-2 bg-success text-white rounded-lg text-sm font-medium hover:opacity-85 transition-opacity">📥 Export</button>
                </div>

                {/* Cards */}
                {loading ? (
                    <div className="text-center py-16 text-txt-dim">Loading call data...</div>
                ) : data.length === 0 ? (
                    <div className="text-center py-16">
                        <div className="text-5xl mb-3">📭</div>
                        <p className="text-txt-dim">No call data yet. Your AI will collect information when it handles calls.</p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-2.5">
                        {data.map(item => (
                            <div key={item.id} onClick={() => toggleExpand(item)}
                                className={`bg-card border rounded-2xl p-4 cursor-pointer transition-all duration-300 hover:border-accent-light
                                    ${!item.is_read ? 'border-l-4 border-l-accent border-t border-r border-b border-border' : 'border-border'}`}>
                                <div className="flex gap-3.5 items-start">
                                    <div className="relative shrink-0">
                                        <div className="w-11 h-11 bg-accent rounded-full flex items-center justify-center text-white font-bold text-lg">
                                            {item.caller_name?.[0]?.toUpperCase() || '?'}
                                        </div>
                                        {!item.is_read && <div className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-accent rounded-full border-2 border-card" />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap mb-1">
                                            <span className="font-semibold text-txt">{item.caller_name || 'Unknown Caller'}</span>
                                            {getUrgencyBadge(item.urgency)}
                                            <span className="text-lg">{getSentimentIcon(item.sentiment)}</span>
                                        </div>
                                        <p className="text-txt-dim text-sm truncate">{item.caller_need || 'No details captured'}</p>
                                        <span className="text-xs text-txt-dimmer">{new Date(item.created_at).toLocaleString()}</span>
                                    </div>
                                </div>

                                {expandedId === item.id && (
                                    <div className="mt-4 pt-4 border-t border-border">
                                        <div className="grid grid-cols-2 gap-4 mb-4 bg-primary p-4 rounded-lg">
                                            <div><span className="text-[11px] text-txt-dimmer uppercase tracking-wide">📞 Caller Phone</span><div className="text-txt font-medium mt-1">{item.caller_phone || 'Not provided'}</div></div>
                                            <div><span className="text-[11px] text-txt-dimmer uppercase tracking-wide">👤 Caller Name</span><div className="text-txt font-medium mt-1">{item.caller_name || 'Unknown'}</div></div>
                                        </div>
                                        {item.summary && (
                                            <div className="mb-4">
                                                <h4 className="text-sm font-semibold text-accent-light mb-2">📝 Full Summary</h4>
                                                <p className="text-txt-dim text-sm leading-relaxed">{item.summary}</p>
                                            </div>
                                        )}
                                        <div>
                                            <h4 className="text-sm font-semibold text-accent-light mb-2">💬 Full Transcript</h4>
                                            <div className="flex flex-col gap-1.5 max-h-[300px] overflow-y-auto p-2.5 bg-primary rounded-lg">
                                                {parseTranscript(item.full_transcript).map((line, i) => (
                                                    <div key={i} className={`px-3 py-2 rounded-lg text-sm leading-snug ${line.startsWith('AI') ? 'bg-accent/10 text-accent-light self-start' : 'bg-success/10 text-success self-end'
                                                        }`}>{line}</div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

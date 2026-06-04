import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authAPI, callsAPI, getUser, setAuth, getToken } from '../services/api';

export default function AISettingsPage() {
    const navigate = useNavigate();
    const [user, setUser] = useState(getUser());
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    const [aiEnabled, setAiEnabled] = useState(false);
    const [voiceModels, setVoiceModels] = useState([]);
    const [selectedVoice, setSelectedVoice] = useState('en_US-ryan-medium');
    const [voiceGender, setVoiceGender] = useState('male');
    const [genderFilter, setGenderFilter] = useState('all');
    const [voiceSpeed, setVoiceSpeed] = useState('1.0');
    const [greetingName, setGreetingName] = useState('');
    const [businessPrompt, setBusinessPrompt] = useState('');
    const [collectData, setCollectData] = useState(true);
    const [previewLoading, setPreviewLoading] = useState(null);
    const [previewAudio, setPreviewAudio] = useState(null);

    useEffect(() => { loadSettings(); }, []);

    const loadSettings = async () => {
        try {
            const [profile, models] = await Promise.all([authAPI.getProfile(), callsAPI.getVoiceModels()]);
            setUser(profile);
            setAiEnabled(profile.ai_enabled || false);
            setSelectedVoice(profile.ai_voice_model || 'en_US-ryan-medium');
            setVoiceGender(profile.ai_voice_gender || 'male');
            setVoiceSpeed(profile.ai_voice_speed || '1.0');
            setGreetingName(profile.ai_greeting_name || '');
            setBusinessPrompt(profile.ai_business_prompt || '');
            setCollectData(profile.ai_collect_data !== false);
            setVoiceModels(models);
        } catch (err) { console.error('Failed to load settings:', err); }
        finally { setLoading(false); }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const updated = await authAPI.updateProfile({
                ai_enabled: aiEnabled, ai_voice_model: selectedVoice, ai_voice_gender: voiceGender,
                ai_voice_speed: voiceSpeed, ai_greeting_name: greetingName || null,
                ai_business_prompt: businessPrompt || null, ai_collect_data: collectData,
            });
            setUser(updated);
            setAuth(getToken(), updated);
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        } catch (err) { console.error('Save failed:', err); }
        finally { setSaving(false); }
    };

    const playPreview = async (modelId) => {
        setPreviewLoading(modelId);
        try {
            if (previewAudio) { previewAudio.pause(); setPreviewAudio(null); }
            const data = await callsAPI.getVoicePreview(modelId);
            if (data.audio_base64) {
                const byteChars = atob(data.audio_base64);
                const byteNums = new Array(byteChars.length);
                for (let i = 0; i < byteChars.length; i++) byteNums[i] = byteChars.charCodeAt(i);
                const blob = new Blob([new Uint8Array(byteNums)], { type: 'audio/wav' });
                const audio = new Audio(URL.createObjectURL(blob));
                setPreviewAudio(audio);
                audio.play();
            }
        } catch (err) { console.error('Preview failed:', err); }
        finally { setPreviewLoading(null); }
    };

    const filteredModels = genderFilter === 'all' ? voiceModels : voiceModels.filter(m => m.gender === genderFilter);
    const getQualityColor = (q) => q === 'High' ? 'bg-success' : q === 'Medium' ? 'bg-warning' : 'bg-txt-dimmer';

    if (loading) return <div className="min-h-screen bg-primary flex items-center justify-center text-txt-dim">Loading settings...</div>;

    return (
        <div className="min-h-screen h-screen bg-primary overflow-y-auto">
            <div className="max-w-3xl mx-auto p-5">
                {/* Header */}
                <div className="mb-6">
                    <button onClick={() => navigate('/')} className="px-3 py-1.5 border border-border text-txt-dim rounded-lg text-sm hover:border-accent hover:text-accent transition-colors">← Back</button>
                    <h1 className="text-2xl font-bold text-txt mt-2">⚙️ AI Call Assistant Settings</h1>
                    <p className="text-txt-dim text-sm">Configure how your AI handles calls on your behalf</p>
                </div>

                {/* AI Toggle */}
                <div className="bg-card border border-border rounded-2xl p-5 mb-4">
                    <div className="flex items-center justify-between gap-4">
                        <div>
                            <h3 className="text-lg font-semibold text-txt">🤖 AI Auto-Response</h3>
                            <p className="text-txt-dim text-xs mt-1">When enabled, your AI assistant will answer calls for you</p>
                        </div>
                        <label className="relative w-[52px] h-7 shrink-0 cursor-pointer">
                            <input type="checkbox" checked={aiEnabled} onChange={e => setAiEnabled(e.target.checked)} className="sr-only peer" />
                            <div className="w-full h-full bg-hover peer-checked:bg-accent rounded-full transition-colors" />
                            <div className="absolute top-[3px] left-[3px] w-[22px] h-[22px] bg-white rounded-full transition-transform peer-checked:translate-x-6" />
                        </label>
                    </div>
                </div>

                {/* Greeting Name */}
                <div className="bg-card border border-border rounded-2xl p-5 mb-4">
                    <h3 className="text-lg font-semibold text-txt">👤 Assistant Identity</h3>
                    <p className="text-txt-dim text-xs mt-1 mb-3">How should the AI introduce itself?</p>
                    <input type="text" value={greetingName} onChange={e => setGreetingName(e.target.value)} placeholder="Your name or business name"
                        className="w-full px-4 py-3 bg-primary border border-border rounded-lg text-txt placeholder-txt-dimmer focus:border-accent focus:outline-none transition-colors" />
                </div>

                {/* Voice Lab */}
                <div className="bg-card border border-border rounded-2xl p-5 mb-4">
                    <h3 className="text-lg font-semibold text-txt">🎙️ Voice Lab</h3>
                    <p className="text-txt-dim text-xs mt-1 mb-4">Choose the voice your AI will use during calls</p>

                    <div className="flex gap-2 mb-4">
                        {['all', 'male', 'female'].map(g => (
                            <button key={g} onClick={() => setGenderFilter(g)}
                                className={`px-4 py-2 rounded-full text-sm transition-all ${genderFilter === g ? 'bg-accent text-white border-accent' : 'bg-primary border border-border text-txt-dim hover:border-accent-light'}`}>
                                {g === 'all' ? '🎵 All' : g === 'male' ? '👨 Male' : '👩 Female'}
                            </button>
                        ))}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-5">
                        {filteredModels.map(model => (
                            <div key={model.id} onClick={() => model.available && setSelectedVoice(model.id)}
                                className={`relative bg-primary border-2 rounded-2xl p-4 cursor-pointer transition-all duration-300
                                    ${selectedVoice === model.id ? 'border-accent shadow-[0_0_20px_var(--color-accent-glow)]' : 'border-border hover:border-accent-light'}
                                    ${!model.available ? 'opacity-40 pointer-events-none' : ''}`}>
                                <div className="text-2xl mb-2">{model.gender === 'male' ? '👨' : model.gender === 'female' ? '👩' : '🎭'}</div>
                                <div className="flex items-center gap-2 mb-2.5">
                                    <span className="font-semibold text-txt">{model.name}</span>
                                    <span className={`${getQualityColor(model.quality)} px-2 py-0.5 rounded-lg text-[10px] font-semibold text-white`}>{model.quality}</span>
                                </div>
                                <button onClick={(e) => { e.stopPropagation(); playPreview(model.id); }} disabled={previewLoading === model.id || !model.available}
                                    className="w-full py-2 bg-hover border border-border rounded-lg text-txt text-xs hover:bg-accent hover:border-accent transition-all disabled:opacity-50">
                                    {previewLoading === model.id ? '⏳' : '▶️'} Preview
                                </button>
                                {selectedVoice === model.id && <div className="absolute top-2 right-2 bg-accent text-white px-2 py-0.5 rounded-lg text-[10px] font-semibold">✓ Selected</div>}
                            </div>
                        ))}
                    </div>

                    {/* Speed */}
                    <div className="mt-2">
                        <label className="text-sm text-txt-dim">🎚️ Speaking Speed: <strong className="text-txt">{voiceSpeed}x</strong></label>
                        <input type="range" min="0.8" max="1.5" step="0.1" value={voiceSpeed} onChange={e => setVoiceSpeed(e.target.value)}
                            className="w-full mt-2 accent-accent" />
                        <div className="flex justify-between text-xs text-txt-dimmer"><span>Slow</span><span>Normal</span><span>Fast</span></div>
                    </div>
                </div>

                {/* Business Prompt */}
                <div className="bg-card border border-border rounded-2xl p-5 mb-4">
                    <h3 className="text-lg font-semibold text-txt">📝 AI Instructions</h3>
                    <p className="text-txt-dim text-xs mt-1 mb-3">Tell your AI what to say and ask callers. This is the most important setting!</p>
                    <div className="bg-accent/10 border border-accent/30 rounded-lg px-3 py-2.5 text-sm text-accent-light mb-3">
                        💡 <strong>Tip:</strong> Describe your work, what questions to ask callers, what info to collect, and how to handle common requests.
                    </div>
                    <textarea rows={8} value={businessPrompt} onChange={e => setBusinessPrompt(e.target.value)}
                        placeholder={`Example: I am a software developer. I build websites, apps, and AI automation systems.\n\nWhen someone calls:\n1. Tell them I'm not available right now\n2. Ask what type of software they're looking for\n3. Ask about their timeline and budget\n4. Collect their name and phone number\n5. Tell them I'll get back to them soon`}
                        className="w-full px-4 py-3 bg-primary border border-border rounded-lg text-txt placeholder-txt-dimmer text-sm leading-relaxed resize-y min-h-[150px] focus:border-accent focus:outline-none transition-colors" />
                    <div className="text-right text-xs text-txt-dimmer mt-1">{businessPrompt.length} characters</div>
                </div>

                {/* Behavior */}
                <div className="bg-card border border-border rounded-2xl p-5 mb-4">
                    <h3 className="text-lg font-semibold text-txt mb-3">⚙️ Behavior</h3>
                    <div className="flex items-center justify-between gap-4">
                        <div>
                            <strong className="text-sm text-txt">📊 Collect Caller Information</strong>
                            <p className="text-txt-dim text-xs mt-0.5">AI will gather caller's name, need, and urgency after each call</p>
                        </div>
                        <label className="relative w-[52px] h-7 shrink-0 cursor-pointer">
                            <input type="checkbox" checked={collectData} onChange={e => setCollectData(e.target.checked)} className="sr-only peer" />
                            <div className="w-full h-full bg-hover peer-checked:bg-accent rounded-full transition-colors" />
                            <div className="absolute top-[3px] left-[3px] w-[22px] h-[22px] bg-white rounded-full transition-transform peer-checked:translate-x-6" />
                        </label>
                    </div>
                </div>

                {/* Save */}
                <div className="text-center py-5">
                    <button onClick={handleSave} disabled={saving}
                        className="px-10 py-3.5 bg-accent text-white rounded-2xl font-semibold text-base hover:bg-accent-light hover:-translate-y-0.5 hover:shadow-[0_6px_20px_var(--color-accent-glow)] transition-all duration-300 disabled:opacity-60 disabled:translate-y-0 disabled:cursor-not-allowed">
                        {saving ? '⏳ Saving...' : saved ? '✅ Saved!' : '💾 Save Settings'}
                    </button>
                </div>
            </div>
        </div>
    );
}

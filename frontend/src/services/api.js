// Auto-detect backend URL based on how the frontend is served
const currentHost = window.location.hostname;
const currentPort = window.location.port;
const currentProtocol = window.location.protocol;

// If served from FastAPI (port 8000) or ngrok, use same origin
const isServedFromBackend = currentPort === '8000' || (!currentPort && currentHost !== 'localhost');
const isLocal = currentHost === 'localhost' || currentHost === '127.0.0.1';

let API_BASE, WS_BASE;
if (isServedFromBackend || !isLocal) {
  // Same origin (served from FastAPI or ngrok)
  API_BASE = `${currentProtocol}//${window.location.host}`;
  WS_BASE = `${currentProtocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`;
} else {
  // Dev mode: frontend on 5173, backend on 8000
  API_BASE = 'http://localhost:8000';
  WS_BASE = 'ws://localhost:8000';
}

// ========== DEMO MODE MOCK DATABASE & INTERCEPTOR ==========
export const isDemoMode = () => {
  const host = window.location.hostname;
  const isStaticHost = host.includes('netlify.app') || host.includes('vercel.app') || host.includes('github.io');
  const manualMode = localStorage.getItem('demo_mode');
  if (manualMode === null) {
    return isStaticHost; // default to true on Netlify/Vercel
  }
  return manualMode === 'true';
};

const initMockDB = () => {
  if (!localStorage.getItem('mock_db_initialized')) {
    const defaultUsers = [
      { id: 1, email: "admin@admin.com", display_name: "Admin", is_admin: true, is_active: true, ai_enabled: true, ai_voice_model: "en_US-ryan-medium", ai_collect_data: true, ai_greeting_name: "Admin Support" },
      { id: 9, email: "abhi@gmail.com", display_name: "Abhi", is_admin: false, is_active: true, ai_enabled: true, ai_voice_model: "en_US-ryan-medium", ai_collect_data: true, ai_greeting_name: "Abhi's Desk" },
      { id: 4, email: "dhiraj@gmail.com", display_name: "Dhiraj", is_admin: false, is_active: true, ai_enabled: true, ai_voice_model: "en_US-lessac-medium", ai_collect_data: true, ai_greeting_name: "Dhiraj's Assistant" },
      { id: 3, email: "abhishekhiremath215@gmail.com", display_name: "Abhishek", is_admin: false, is_active: true, ai_enabled: true, ai_voice_model: "en_US-ryan-medium", ai_collect_data: true, ai_greeting_name: "Abhishek support" }
    ];
    
    const defaultCollectedData = [
      {
        id: 1,
        call_id: 101,
        owner_id: 1,
        caller_name: "Alice Cooper",
        caller_phone: "987-654-3210",
        caller_need: "Emergency plumbing service due to a leaking sink",
        urgency: "high",
        sentiment: "positive",
        summary: "Alice called requesting immediate emergency plumbing because her kitchen sink was leaking heavily. The agent logged her request and assured her a plumber would call back shortly.",
        full_transcript: JSON.stringify([
          "AI: Hello! Thank you for calling Admin Support. How can I assist you today?",
          "Caller: Hi, my name is Alice Cooper. I have a leak under my kitchen sink and need someone to fix it today please.",
          "AI: I understand, Alice. Can I have your phone number to coordinate the plumber?",
          "Caller: Yes, it is 987-654-3210.",
          "AI: Thank you. I have logged your request for emergency plumbing, and someone will follow up shortly."
        ]),
        is_read: false,
        created_at: new Date(Date.now() - 3600000).toISOString()
      },
      {
        id: 2,
        call_id: 102,
        owner_id: 1,
        caller_name: "John Doe",
        caller_phone: "555-123-4567",
        caller_need: "Inquiry about pricing plans and monthly subscriptions",
        urgency: "medium",
        sentiment: "neutral",
        summary: "John called asking about the cost of monthly subscriptions and standard business support features. He left his contact number for a sales follow-up.",
        full_transcript: JSON.stringify([
          "AI: Hello! Thank you for calling Admin Support. How can I assist you today?",
          "Caller: Yes, I want to know about your product's pricing plans for a small team.",
          "AI: Sure. I can have a representative email or call you with a custom quote. What's your number?",
          "Caller: 555-123-4567. My name is John Doe.",
          "AI: Perfect, John. I have logged your request and a sales agent will reach out shortly."
        ]),
        is_read: true,
        created_at: new Date(Date.now() - 7200000).toISOString()
      }
    ];

    const defaultCallHistory = [
      { id: 101, caller_id: 2, callee_id: 1, call_type: "audio", status: "ended", ai_handled: true, started_at: new Date(Date.now() - 3600000).toISOString(), ended_at: new Date(Date.now() - 3540000).toISOString() },
      { id: 102, caller_id: 3, callee_id: 1, call_type: "audio", status: "ended", ai_handled: true, started_at: new Date(Date.now() - 7200000).toISOString(), ended_at: new Date(Date.now() - 7150000).toISOString() }
    ];

    localStorage.setItem('mock_users', JSON.stringify(defaultUsers));
    localStorage.setItem('mock_collected_data', JSON.stringify(defaultCollectedData));
    localStorage.setItem('mock_call_history', JSON.stringify(defaultCallHistory));
    localStorage.setItem('mock_db_initialized', 'true');
  }
};

let activeMockWS = null;

function parseSpeechDetails(text) {
  const t = text.toLowerCase();
  
  // Extract name: e.g. "my name is X", "i am Y", "this is Z"
  const nameRegex = /(?:my name is|i am|this is)\s+([a-zA-Z\s]{2,20})/i;
  const nameMatch = text.match(nameRegex);
  if (nameMatch) {
    const name = nameMatch[1].trim();
    localStorage.setItem('mock_captured_name', name);
  }

  // Extract phone: look for digits
  const phoneRegex = /(\d[\d\s-]{7,15})/i;
  const phoneMatch = text.match(phoneRegex);
  if (phoneMatch) {
    const phone = phoneMatch[1].trim();
    localStorage.setItem('mock_captured_phone', phone);
  }

  // Extract need: try to grab keywords or the rest of the sentence
  if (t.includes('sink') || t.includes('leak') || t.includes('plumb')) {
    localStorage.setItem('mock_captured_need', 'Emergency plumbing service for a leaking sink');
  } else if (t.includes('website') || t.includes('app') || t.includes('software')) {
    localStorage.setItem('mock_captured_need', 'Software development and landing page query');
  } else if (t.includes('price') || t.includes('cost') || t.includes('pricing')) {
    localStorage.setItem('mock_captured_need', 'Pricing plan and business model inquiry');
  } else {
    // default/fallback
    const currentNeed = localStorage.getItem('mock_captured_need');
    if (!currentNeed) {
      localStorage.setItem('mock_captured_need', text);
    }
  }
}

function getMockAIReply(text) {
  const t = text.toLowerCase();
  const name = localStorage.getItem('mock_captured_name');
  const phone = localStorage.getItem('mock_captured_phone');
  const need = localStorage.getItem('mock_captured_need');

  if (t.includes('hello') || t.includes('hi ')) {
    return "Hi there! I'm ready to assist you. Could you please provide your name and the details of your inquiry?";
  }

  if (t.includes('price') || t.includes('cost') || t.includes('subscription')) {
    return "Our plans start at forty-nine dollars a month for the basic tier. I've noted that you are interested in pricing, and a representative will follow up with full details.";
  }

  if (!name) {
    return "Thank you for describing that. To help us route your request, could you please tell me your name?";
  }

  if (!phone) {
    return `Nice to meet you, ${name}. Could you please provide your contact phone number so our support team can reach back to you?`;
  }

  return `Got it, ${name}. I have logged your request for ${need ? need.toLowerCase() : 'support assistance'} and registered your phone number as ${phone}. A representative will contact you shortly. Is there anything else?`;
}

class MockWebSocket {
  constructor(url) {
    this.url = url;
    this.readyState = 0; // CONNECTING
    activeMockWS = this;
    setTimeout(() => {
      this.readyState = 1; // OPEN
      if (this.onopen) this.onopen();
    }, 100);
  }

  send(dataStr) {
    const data = JSON.parse(dataStr);
    console.log('[MOCK WS] Received action:', data.action, data);
    
    if (data.action === 'ai_speech_input') {
      const text = data.text;
      const callId = data.call_id;
      
      // Append user speech to mock transcript
      const transcript = JSON.parse(localStorage.getItem('active_call_transcript') || '[]');
      transcript.push(`User: ${text}`);
      localStorage.setItem('active_call_transcript', JSON.stringify(transcript));

      // Parse user name, phone, need dynamically to save it when call ends
      parseSpeechDetails(text);

      // Trigger "AI thinking..." state change on frontend
      setTimeout(() => {
        // AI response text generation
        const replyText = getMockAIReply(text);
        
        // Append AI response to mock transcript
        const updatedTranscript = JSON.parse(localStorage.getItem('active_call_transcript') || '[]');
        updatedTranscript.push(`AI: ${replyText}`);
        localStorage.setItem('active_call_transcript', JSON.stringify(updatedTranscript));

        if (this.readyState === 1) {
          this.triggerMessage({
            type: 'ai_voice_response',
            call_id: callId,
            text: replyText,
            audio_available: false
          });
        }
      }, 1500);
    }
  }

  close() {
    this.readyState = 3; // CLOSED
    activeMockWS = null;
    if (this.onclose) this.onclose({ code: 1000, reason: "Normal closure" });
  }

  triggerMessage(payload) {
    if (this.onmessage) {
      this.onmessage({
        data: JSON.stringify(payload)
      });
    }
  }
}

const handleMockRequest = async (url, options = {}) => {
  initMockDB();
  const method = (options.method || 'GET').toUpperCase();
  // Strip origin and query params to get route path
  let path = url.replace(API_BASE, '').split('?')[0];
  if (path.startsWith('http://') || path.startsWith('https://')) {
    path = '/' + path.split('/').slice(3).join('/').split('?')[0];
  }
  
  // Helper to read database
  const getUsers = () => JSON.parse(localStorage.getItem('mock_users') || '[]');
  const getCollectedData = () => JSON.parse(localStorage.getItem('mock_collected_data') || '[]');
  const getCallHistory = () => JSON.parse(localStorage.getItem('mock_call_history') || '[]');
  
  // Helpers to write database
  const saveUsers = (data) => localStorage.setItem('mock_users', JSON.stringify(data));
  const saveCollectedData = (data) => localStorage.setItem('mock_collected_data', JSON.stringify(data));
  const saveCallHistory = (data) => localStorage.setItem('mock_call_history', JSON.stringify(data));

  const currentUser = getUser() || getUsers()[0];

  // Helper response wrapper
  const jsonResponse = (data, status = 200) => {
    return new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json' }
    });
  };

  console.log(`[MOCK API] ${method} ${path}`, options.body ? JSON.parse(options.body) : '');

  // ROUTING
  // 1. Auth Login
  if (path === '/api/auth/login' && method === 'POST') {
    const { email } = JSON.parse(options.body || '{}');
    const users = getUsers();
    let u = users.find(x => x.email === email);
    if (!u) {
      u = { id: 1, email, display_name: email.split('@')[0], is_admin: true, is_active: true, ai_enabled: true, ai_voice_model: "en_US-ryan-medium", ai_collect_data: true, ai_greeting_name: "Support Agent" };
      users.push(u);
      saveUsers(users);
    }
    setAuth("mock-jwt-token-12345", u);
    return jsonResponse({ access_token: "mock-jwt-token-12345", token_type: "bearer", user: u });
  }

  // 2. Auth Register
  if (path === '/api/auth/register' && method === 'POST') {
    const { email, display_name } = JSON.parse(options.body || '{}');
    const users = getUsers();
    const newUser = { id: users.length + 1, email, display_name, is_admin: false, is_active: true, ai_enabled: true, ai_voice_model: "en_US-ryan-medium", ai_collect_data: true, ai_greeting_name: "Support Desk" };
    users.push(newUser);
    saveUsers(users);
    return jsonResponse(newUser);
  }

  // 3. Auth Me
  if (path === '/api/auth/me') {
    if (method === 'GET') {
      return jsonResponse(currentUser);
    }
    if (method === 'PUT') {
      const body = JSON.parse(options.body || '{}');
      const users = getUsers();
      const idx = users.findIndex(x => x.id === currentUser.id);
      if (idx !== -1) {
        users[idx] = { ...users[idx], ...body };
        saveUsers(users);
        setAuth(getToken(), users[idx]);
        return jsonResponse(users[idx]);
      }
      return jsonResponse(currentUser);
    }
  }

  // 4. Search Users
  if (path === '/api/auth/users' && method === 'GET') {
    const users = getUsers();
    return jsonResponse(users);
  }

  // 5. Initiate Call
  if (path === '/api/calls/initiate' && method === 'POST') {
    const { callee_id } = JSON.parse(options.body || '{}');
    const users = getUsers();
    const callee = users.find(x => x.id === parseInt(callee_id));
    const callId = Math.floor(Math.random() * 1000) + 100;
    
    const callLog = {
      id: callId,
      caller_id: currentUser.id,
      callee_id: callee_id,
      call_type: 'audio',
      status: 'active',
      ai_handled: callee ? callee.ai_enabled : true,
      started_at: new Date().toISOString()
    };
    
    const history = getCallHistory();
    history.push(callLog);
    saveCallHistory(history);

    localStorage.setItem('active_call_id', callId.toString());
    localStorage.setItem('active_call_callee_id', callee_id.toString());
    localStorage.setItem('active_call_transcript', JSON.stringify([]));

    // WS Greeting Simulation
    setTimeout(() => {
      if (activeMockWS && activeMockWS.readyState === 1) {
        const greetingName = callee?.ai_greeting_name || callee?.display_name || "the support representative";
        const greetingText = `Hello! Thank you for calling ${greetingName}. How can I assist you today?`;
        
        const transcript = JSON.parse(localStorage.getItem('active_call_transcript') || '[]');
        transcript.push(`AI: ${greetingText}`);
        localStorage.setItem('active_call_transcript', JSON.stringify(transcript));

        activeMockWS.triggerMessage({
          type: 'ai_voice_response',
          call_id: callId,
          text: greetingText,
          audio_available: false
        });
      }
    }, 1200);

    return jsonResponse({
      call_id: callId,
      status: 'ai_connected',
      ai_handled: true,
      callee: callee || { id: callee_id, display_name: "AI Agent" }
    });
  }

  // 6. End Call
  if (path === '/api/calls/end' && method === 'POST') {
    const { call_id } = JSON.parse(options.body || '{}');
    const history = getCallHistory();
    const idx = history.findIndex(x => x.id === parseInt(call_id));
    if (idx !== -1) {
      history[idx].ended_at = new Date().toISOString();
      history[idx].status = 'ended';
      saveCallHistory(history);
    }

    const transcript = JSON.parse(localStorage.getItem('active_call_transcript') || '[]');
    const callerName = localStorage.getItem('mock_captured_name') || 'Alice Cooper';
    const callerPhone = localStorage.getItem('mock_captured_phone') || '987-654-3210';
    const callerNeed = localStorage.getItem('mock_captured_need') || 'Emergency plumbing service due to a leaking sink';
    const calleeId = parseInt(localStorage.getItem('active_call_callee_id') || '9');

    const collected = getCollectedData();
    const newRecord = {
      id: collected.length + 1,
      call_id: parseInt(call_id),
      owner_id: calleeId,
      caller_id: currentUser.id,
      caller_name: callerName,
      caller_phone: callerPhone,
      caller_need: callerNeed,
      urgency: callerNeed.toLowerCase().includes('leak') || callerNeed.toLowerCase().includes('urgent') ? 'high' : 'medium',
      sentiment: 'positive',
      summary: `${callerName} called regarding their need for ${callerNeed.toLowerCase()}. They provided the contact phone number ${callerPhone}. The AI logged the request and confirmed support follow-up.`,
      full_transcript: JSON.stringify(transcript),
      is_read: false,
      created_at: new Date().toISOString()
    };

    collected.push(newRecord);
    saveCollectedData(collected);

    localStorage.removeItem('active_call_id');
    localStorage.removeItem('active_call_callee_id');
    localStorage.removeItem('active_call_transcript');
    localStorage.removeItem('mock_captured_name');
    localStorage.removeItem('mock_captured_phone');
    localStorage.removeItem('mock_captured_need');

    return jsonResponse({ status: 'ended', call_id: parseInt(call_id) });
  }

  // 7. Call History
  if (path === '/api/calls/history' && method === 'GET') {
    const history = getCallHistory();
    const users = getUsers();
    return jsonResponse(history.map(h => {
      const otherUser = users.find(u => u.id === (h.caller_id === currentUser.id ? h.callee_id : h.caller_id));
      return {
        ...h,
        other_user: otherUser ? { id: otherUser.id, display_name: otherUser.display_name } : null,
        is_outgoing: h.caller_id === currentUser.id
      };
    }));
  }

  // 8. Collected Data
  if (path === '/api/calls/collected-data' && method === 'GET') {
    const collected = getCollectedData();
    return jsonResponse(collected.filter(c => c.owner_id === currentUser.id));
  }

  // 9. Mark Data Read
  if (path.startsWith('/api/calls/collected-data/') && path.endsWith('/read') && method === 'PUT') {
    const segments = path.split('/');
    const dataId = parseInt(segments[segments.length - 2]);
    const collected = getCollectedData();
    const idx = collected.findIndex(c => c.id === dataId);
    if (idx !== -1) {
      collected[idx].is_read = true;
      saveCollectedData(collected);
    }
    return jsonResponse({ status: "read", id: dataId });
  }

  // 10. Collected Data Unread Count
  if (path === '/api/calls/collected-data/unread-count' && method === 'GET') {
    const collected = getCollectedData().filter(c => c.owner_id === currentUser.id);
    const unread = collected.filter(c => !c.is_read).length;
    const urgent = collected.filter(c => !c.is_read && c.urgency === 'high').length;
    return jsonResponse({ unread, urgent });
  }

  // 11. Voice Models
  if (path === '/api/calls/voice-models' && method === 'GET') {
    const models = [
      { id: "en_US-ryan-low", name: "Ryan", gender: "male", quality: "Low", available: true },
      { id: "en_US-ryan-medium", name: "Ryan", gender: "male", quality: "Medium", available: true },
      { id: "en_US-ryan-high", name: "Ryan", gender: "male", quality: "High", available: true },
      { id: "en_US-amy-medium", name: "Amy", gender: "female", quality: "Medium", available: true },
      { id: "en_US-lessac-medium", name: "Lessac", gender: "female", quality: "Medium", available: true }
    ];
    return jsonResponse(models);
  }

  // 12. Admin Stats
  if (path === '/api/admin/stats' && method === 'GET') {
    const users = getUsers();
    const history = getCallHistory();
    const collected = getCollectedData();
    return jsonResponse({
      total_users: users.length,
      total_calls: history.length,
      ai_calls: history.filter(h => h.ai_handled).length,
      collected_data: collected.length
    });
  }

  return jsonResponse({ detail: "Endpoint mocked successfully" });
};

// Globally hook window.fetch for Demo Mode interception
const originalFetch = window.fetch;
window.fetch = async (url, options = {}) => {
  if (isDemoMode() && (typeof url === 'string' && (url.includes('/api/') || url.startsWith('/api/')))) {
    return handleMockRequest(url, options);
  }
  return originalFetch(url, options);
};

// ========== AUTH HELPERS ==========
export const getToken = () => {
  const token = localStorage.getItem('auth_token');
  return token === 'undefined' ? null : token;
};
export const getUser = () => {
  const u = localStorage.getItem('auth_user');
  if (!u || u === 'undefined') return null;
  try {
    return JSON.parse(u);
  } catch (e) {
    return null;
  }
};
export const setAuth = (token, user) => {
  if (token && token !== 'undefined') {
    localStorage.setItem('auth_token', token);
  } else {
    localStorage.removeItem('auth_token');
  }
  
  if (user && user !== 'undefined') {
    localStorage.setItem('auth_user', JSON.stringify(user));
  } else {
    localStorage.removeItem('auth_user');
  }
};
export const clearAuth = () => {
  localStorage.removeItem('auth_token');
  localStorage.removeItem('auth_user');
};
export const isLoggedIn = () => !!getToken();
export const isAdmin = () => getUser()?.is_admin === true;

// ========== FETCH WITH AUTH ==========
const authFetch = async (url, options = {}) => {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const res = await fetch(`${API_BASE}${url}`, { ...options, headers });

  if (res.status === 401) {
    clearAuth();
    window.location.href = '/login';
    throw new Error('Session expired');
  }

  return res;
};

// ========== AUTH API ==========
export const authAPI = {
  register: async ({ email, password, display_name }) => {
    const res = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, display_name }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Registration failed');
    }
    return res.json();
  },

  login: async (email, password) => {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Login failed');
    }
    return res.json();
  },

  getProfile: async () => {
    const res = await authFetch('/api/auth/me');
    return res.json();
  },

  updateProfile: async (data) => {
    const res = await authFetch('/api/auth/me', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return res.json();
  },

  searchUsers: async (search = '') => {
    const url = search ? `/api/auth/users?search=${encodeURIComponent(search)}` : '/api/auth/users';
    const res = await authFetch(url);
    return res.json();
  },
};

// ========== CHAT API ==========
export const chatAPI = {
  getConversations: async () => {
    const res = await authFetch('/api/chat/conversations');
    return res.json();
  },

  createConversation: async (email) => {
    const res = await authFetch('/api/chat/conversations', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Failed to create conversation');
    }
    return res.json();
  },

  getMessages: async (conversationId, limit = 50) => {
    const res = await authFetch(`/api/chat/conversations/${conversationId}/messages?limit=${limit}`);
    return res.json();
  },

  connectWebSocket: (token) => {
    const ws = new WebSocket(`${WS_BASE}/api/chat/ws/${token}`);
    return ws;
  },
};

// ========== CALLS API ==========
export const callsAPI = {
  initiateCall: async (calleeId) => {
    const res = await authFetch('/api/calls/initiate', {
      method: 'POST',
      body: JSON.stringify({ callee_id: calleeId, call_type: 'audio' }),
    });
    return res.json();
  },

  endCall: async (callId) => {
    const res = await authFetch('/api/calls/end', {
      method: 'POST',
      body: JSON.stringify({ call_id: callId }),
    });
    return res.json();
  },

  getHistory: async () => {
    const res = await authFetch('/api/calls/history');
    return res.json();
  },

  connectSignaling: (token) => {
    if (isDemoMode()) {
      return new MockWebSocket(`${WS_BASE}/api/calls/ws/${token}`);
    }
    const ws = new WebSocket(`${WS_BASE}/api/calls/ws/${token}`);
    return ws;
  },

  getVoiceModels: async () => {
    const res = await authFetch('/api/calls/voice-models');
    return res.json();
  },

  getVoicePreview: async (modelId) => {
    const res = await authFetch(`/api/calls/voice-preview/${modelId}`);
    if (!res.ok) throw new Error('Preview generation failed');
    return res.json();
  },

  getCollectedData: async (filter = 'all', search = '') => {
    const params = new URLSearchParams({ filter });
    if (search) params.append('search', search);
    const res = await authFetch(`/api/calls/collected-data?${params}`);
    return res.json();
  },

  markDataRead: async (dataId) => {
    const res = await authFetch(`/api/calls/collected-data/${dataId}/read`, { method: 'PUT' });
    return res.json();
  },

  getUnreadCount: async () => {
    const res = await authFetch('/api/calls/collected-data/unread-count');
    return res.json();
  },
};

// ========== ADMIN API ==========
export const adminAPI = {
  getStats: async () => {
    const res = await authFetch('/api/admin/stats');
    return res.json();
  },

  getUsers: async (search = '') => {
    const url = search ? `/api/admin/users?search=${encodeURIComponent(search)}` : '/api/admin/users';
    const res = await authFetch(url);
    return res.json();
  },

  updateUser: async (userId, data) => {
    const res = await authFetch(`/api/admin/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return res.json();
  },

  deleteUser: async (userId) => {
    const res = await authFetch(`/api/admin/users/${userId}`, {
      method: 'DELETE',
    });
    return res.json();
  },
};

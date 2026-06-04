import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { isLoggedIn, isAdmin } from './services/api';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import Dashboard from './pages/Dashboard';
import ChatPage from './pages/ChatPage';
import CallPage from './pages/CallPage';
import AdminPanel from './pages/AdminPanel';
import AISettingsPage from './pages/AISettingsPage';
import AICallDataPage from './pages/AICallDataPage';
import GlobalCallListener from './components/GlobalCallListener';
import ErrorBoundary from './components/ErrorBoundary';
import { CallProvider } from './context/CallContext';

function ProtectedRoute({ children }) {
  if (!isLoggedIn()) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

function App() {
  return (
    <ErrorBoundary>
    <BrowserRouter>
      <CallProvider>
        <GlobalCallListener />

        <Routes>

          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/chat/:id"
            element={
              <ProtectedRoute>
                <ChatPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/call/:userId"
            element={
              <ProtectedRoute>
                <CallPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <AdminPanel />
              </ProtectedRoute>
            }
          />
          <Route
            path="/ai-settings"
            element={
              <ProtectedRoute>
                <AISettingsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/ai-call-data"
            element={
              <ProtectedRoute>
                <AICallDataPage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </CallProvider>
    </BrowserRouter>
    </ErrorBoundary>
  );
}


export default App;

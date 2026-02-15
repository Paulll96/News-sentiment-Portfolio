import { useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import Sidebar from './components/Sidebar';
import SentimentTicker from './components/SentimentTicker';
import AuthModal from './components/AuthModal';
import Dashboard from './pages/Dashboard';
import Sentiment from './pages/Sentiment';
import Portfolio from './pages/Portfolio';
import Backtest from './pages/Backtest';
import News from './pages/News';

function AppShell() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const { user } = useAuth();

  return (
    <div className="app-layout">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(c => !c)}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <div className={`main-area${sidebarCollapsed ? ' sidebar-collapsed' : ''}`}>
        <SentimentTicker />

        {/* Top bar with auth & mobile menu */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 24px',
          borderBottom: '1px solid var(--border-color)',
          background: 'rgba(6, 9, 15, 0.8)',
          backdropFilter: 'blur(12px)',
          position: 'sticky',
          top: 0,
          zIndex: 40
        }}>
          {/* Mobile Menu Button - visible via CSS only on small screens */}
          <button
            className="mobile-menu-btn"
            onClick={() => setMobileOpen(true)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              display: 'none', /* Hidden by default, shown via media query in index.css if desired, or inline here */
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
          </button>

          {/* Spacer to push auth to right if menu is hidden */}
          <div style={{ flex: 1 }}></div>

          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            {user ? (
              <span style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="user-avatar-sm">{user.name ? user.name[0] : 'U'}</span>
                <span className="desktop-only">{user.name || user.email}</span>
              </span>
            ) : (
              <>
                <button className="btn btn-ghost" onClick={() => setAuthOpen(true)}>Login</button>
                <button className="btn btn-primary" onClick={() => setAuthOpen(true)}>Sign Up</button>
              </>
            )}
          </div>
        </div>

        <div className="page-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/sentiment" element={<Sentiment />} />
            <Route path="/portfolio" element={<Portfolio />} />
            <Route path="/backtest" element={<Backtest />} />
            <Route path="/news" element={<News />} />
          </Routes>
        </div>
      </div>

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <AppShell />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

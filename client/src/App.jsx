import { useState, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import SentimentTicker from './components/SentimentTicker';
import AuthModal from './components/AuthModal';
import ErrorBoundary from './components/ErrorBoundary';
import Dashboard from './pages/Dashboard';
import Sentiment from './pages/Sentiment';
import Portfolio from './pages/Portfolio';
import Backtest from './pages/Backtest';
import News from './pages/News';
import Settings from './pages/Settings';
import StockDetail from './pages/StockDetail';
import NotificationBell from './components/NotificationBell';
import SearchBar from './components/SearchBar';
import ThemeToggle from './components/ThemeToggle';
import Waves from './components/ReactBits/Waves';
import StaggeredMenu from './components/ReactBits/StaggeredMenu';
import NotFound from './pages/NotFound';

const Landing = lazy(() => import('./pages/Landing'));

const menuItems = [
  { label: 'Dashboard', ariaLabel: 'Go to Dashboard', link: '/' },
  { label: 'Sentiment', ariaLabel: 'Go to Sentiment', link: '/sentiment' },
  { label: 'Portfolio', ariaLabel: 'Go to Portfolio', link: '/portfolio' },
  { label: 'Backtest', ariaLabel: 'Go to Backtest', link: '/backtest' },
  { label: 'News', ariaLabel: 'Go to News', link: '/news' },
  { label: 'Settings', ariaLabel: 'Go to Settings', link: '/settings' },
];

const socialItems = [
  { label: 'GitHub', link: 'https://github.com/Paulll96' },
];

function AppShell() {
  const [authOpen, setAuthOpen] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleMenuItemClick = (item) => {
    navigate(item.link);
  };

  return (
    <div className="app-layout" style={{ position: 'relative' }}>
      <Waves
        lineColor="rgba(255, 255, 255, 0.05)"
        backgroundColor="transparent"
        waveSpeedX={0.02}
        waveSpeedY={0.01}
        waveAmpX={40}
        waveAmpY={20}
        friction={0.9}
        tension={0.01}
        maxCursorMove={120}
        xGap={12}
        yGap={36}
      />

      {/* StaggeredMenu — Fixed overlay navigation (slides from left) */}
      <StaggeredMenu
        position="left"
        items={menuItems}
        socialItems={socialItems}
        displaySocials={true}
        displayItemNumbering={true}
        menuButtonColor="#94a3b8"
        openMenuButtonColor="#fff"
        changeMenuColorOnOpen={true}
        colors={['#0a0d14', '#0f1117', '#161b26']}
        accentColor="#22d3a7"
        isFixed={true}
        onItemClick={handleMenuItemClick}
        className="app-staggered-menu"
      />

      <div className="main-area no-sidebar">
        <SentimentTicker />

        {/* Top bar */}
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
          zIndex: 30
        }}>
          {/* Logo + brand — positioned after the fixed menu toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginLeft: 80 }}>
            <div style={{
              width: 32, height: 32,
              background: 'linear-gradient(135deg, #3b82f6, #a78bfa)',
              borderRadius: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16
            }}>📊</div>
            <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.2px' }}>
              SentinelQuant
            </span>
          </div>

          <SearchBar />

          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            {user ? (
              <>
                <ThemeToggle />
                <NotificationBell />
                <span style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="user-avatar-sm">{user.name ? user.name[0] : 'U'}</span>
                  <span className="desktop-only">{user.name || user.email}</span>
                </span>
              </>
            ) : (
              <>
                <button className="btn btn-ghost" onClick={() => setAuthOpen(true)}>Login</button>
                <button className="btn btn-primary" onClick={() => setAuthOpen(true)}>Sign Up</button>
              </>
            )}
          </div>
        </div>

        <div className="page-content">
          <ErrorBoundary>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/sentiment" element={<Sentiment />} />
              <Route path="/portfolio" element={<Portfolio />} />
              <Route path="/backtest" element={<Backtest />} />
              <Route path="/news" element={<News />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/stock/:symbol" element={<StockDetail />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </ErrorBoundary>
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
          <Routes>
            {/* Landing page — standalone, no app chrome */}
            <Route path="/landing" element={
              <Suspense fallback={<div style={{ background: '#06090f', height: '100vh' }} />}>
                <Landing />
              </Suspense>
            } />
            {/* All app routes — with top bar + StaggeredMenu */}
            <Route path="/*" element={<AppShell />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

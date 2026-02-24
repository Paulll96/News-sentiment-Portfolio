import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
    LayoutDashboard, Activity, Briefcase, TrendingUp,
    Newspaper, PanelLeftClose, PanelLeft, LogOut, User, X, Settings
} from 'lucide-react';
import DecryptedText from './ReactBits/DecryptedText';

const navItems = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/sentiment', icon: Activity, label: 'Sentiment' },
    { to: '/portfolio', icon: Briefcase, label: 'Portfolio' },
    { to: '/backtest', icon: TrendingUp, label: 'Backtest' },
    { to: '/news', icon: Newspaper, label: 'News' },
    { to: '/settings', icon: Settings, label: 'Settings' },
];

export default function Sidebar({ collapsed, onToggle, mobileOpen, onCloseMobile }) {
    const { user, logout } = useAuth();

    return (
        <>
            <div
                className={`sidebar-overlay ${mobileOpen ? 'open' : ''}`}
                onClick={onCloseMobile}
            />
            <aside className={`sidebar${collapsed ? ' collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
                <div className="sidebar-header">
                    <div className="sidebar-brand">
                        <div className="logo-icon">📊</div>
                        {!collapsed && (
                            <DecryptedText
                                text="SentinelQuant"
                                speed={40}
                                maxIterations={15}
                                characters="ABCD1234!@#$"
                                className="brand-text"
                                parentClassName="brand-text-container"
                                encryptedClassName="opacity-50"
                                animateOn="hover"
                            />
                        )}
                    </div>

                    {/* Desktop Toggle */}
                    <button className="sidebar-toggle desktop-only" onClick={onToggle} aria-label="Toggle sidebar">
                        {collapsed ? <PanelLeft size={18} /> : <PanelLeftClose size={18} />}
                    </button>

                    {/* Mobile Close */}
                    <button className="sidebar-toggle mobile-only" onClick={onCloseMobile} aria-label="Close menu">
                        <X size={20} />
                    </button>
                </div>

                <nav className="sidebar-nav">
                    {navItems.map(item => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            end={item.to === '/'}
                            onClick={onCloseMobile} // Auto-close on mobile nav
                            className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
                        >
                            <item.icon className="link-icon" size={20} />
                            <span className="link-label">{item.label}</span>
                        </NavLink>
                    ))}
                </nav>

                <div className="sidebar-footer">
                    {user ? (
                        <div className="sidebar-user" style={{ cursor: 'pointer' }} onClick={logout}>
                            <div className="user-avatar">
                                {user.name ? user.name[0].toUpperCase() : <User size={14} />}
                            </div>
                            <div className="user-info">
                                <div className="user-name">{user.name || user.email}</div>
                                <div className="user-role" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <LogOut size={10} /> Sign out
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="sidebar-user">
                            <div className="user-avatar">?</div>
                            <div className="user-info">
                                <div className="user-name">Guest</div>
                                <div className="user-role">Not logged in</div>
                            </div>
                        </div>
                    )}
                </div>
            </aside>
        </>
    );
}

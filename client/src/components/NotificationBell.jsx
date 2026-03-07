import { useState, useEffect, useRef } from 'react';
import { Bell } from 'lucide-react';
import { apiRequest } from '../utils/api';
import { useAuth } from '../context/AuthContext';

export default function NotificationBell() {
    const { user } = useAuth();
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [open, setOpen] = useState(false);
    const panelRef = useRef(null);

    useEffect(() => {
        if (!user) return;
        fetchNotifications();
        // Poll every 60 seconds
        const interval = setInterval(fetchNotifications, 60000);
        return () => clearInterval(interval);
    }, [user]);

    // Close panel on outside click
    useEffect(() => {
        const handler = (e) => {
            if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const fetchNotifications = async () => {
        try {
            const data = await apiRequest('/notifications?limit=15');
            setNotifications(data.notifications || []);
            setUnreadCount(data.unreadCount || 0);
        } catch {
            // Silently fail — bell just shows 0
        }
    };

    const markAllRead = async () => {
        try {
            await apiRequest('/notifications/read-all', { method: 'POST' });
            setUnreadCount(0);
            setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        } catch { /* ignore */ }
    };

    const markRead = async (id) => {
        try {
            await apiRequest(`/notifications/${id}/read`, { method: 'PATCH' });
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch { /* ignore */ }
    };

    if (!user) return null;

    const typeIcon = {
        sentiment_drop: '📉',
        sentiment_surge: '📈',
        rebalance_suggested: '🔄',
        scrape_complete: '🗞️',
        system: '⚙️',
    };

    return (
        <div ref={panelRef} style={{ position: 'relative' }}>
            <button
                onClick={() => setOpen(!open)}
                style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--text-secondary)',
                    position: 'relative',
                    padding: 6,
                    display: 'flex',
                    alignItems: 'center',
                }}
                aria-label="Notifications"
            >
                <Bell size={20} />
                {unreadCount > 0 && (
                    <span style={{
                        position: 'absolute',
                        top: 2,
                        right: 2,
                        background: 'var(--accent-red)',
                        color: '#fff',
                        fontSize: 9,
                        fontWeight: 800,
                        minWidth: 16,
                        height: 16,
                        borderRadius: 9999,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '0 4px',
                    }}>
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {open && (
                <div className="notification-panel glass-card" style={{
                    position: 'absolute',
                    right: 0,
                    top: 'calc(100% + 8px)',
                    width: 340,
                    maxHeight: 420,
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    zIndex: 1000,
                    animation: 'slide-up 0.2s ease',
                    padding: 0,
                }}>
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '12px 16px',
                        borderBottom: '1px solid var(--border-color)',
                    }}>
                        <span style={{ fontWeight: 700, fontSize: 14 }}>Notifications</span>
                        {unreadCount > 0 && (
                            <button
                                onClick={markAllRead}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    color: 'var(--accent-blue)',
                                    fontSize: 11,
                                    cursor: 'pointer',
                                    fontWeight: 600,
                                }}
                            >
                                Mark all read
                            </button>
                        )}
                    </div>
                    <div style={{ overflowY: 'auto', flex: 1 }}>
                        {notifications.length === 0 ? (
                            <div style={{
                                padding: 32,
                                textAlign: 'center',
                                color: 'var(--text-muted)',
                                fontSize: 13,
                            }}>
                                <div style={{ fontSize: 28, marginBottom: 8 }}>🔔</div>
                                No notifications yet
                            </div>
                        ) : (
                            notifications.map(n => (
                                <div
                                    key={n.id}
                                    onClick={() => !n.read && markRead(n.id)}
                                    style={{
                                        display: 'flex',
                                        gap: 10,
                                        padding: '10px 16px',
                                        borderBottom: '1px solid var(--border-color)',
                                        cursor: n.read ? 'default' : 'pointer',
                                        background: n.read ? 'transparent' : 'rgba(59,130,246,0.04)',
                                        transition: 'background 0.2s',
                                    }}
                                >
                                    <div style={{ fontSize: 18, flexShrink: 0, marginTop: 2 }}>
                                        {typeIcon[n.type] || '📌'}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{
                                            fontSize: 12.5,
                                            fontWeight: n.read ? 400 : 600,
                                            color: 'var(--text-primary)',
                                            marginBottom: 2,
                                        }}>
                                            {n.title}
                                        </div>
                                        {n.message && (
                                            <div style={{
                                                fontSize: 11,
                                                color: 'var(--text-muted)',
                                                lineHeight: 1.4,
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                display: '-webkit-box',
                                                WebkitLineClamp: 2,
                                                WebkitBoxOrient: 'vertical',
                                            }}>
                                                {n.message}
                                            </div>
                                        )}
                                        <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 4 }}>
                                            {new Date(n.created_at).toLocaleString()}
                                        </div>
                                    </div>
                                    {!n.read && (
                                        <div style={{
                                            width: 8,
                                            height: 8,
                                            borderRadius: 9999,
                                            background: 'var(--accent-blue)',
                                            flexShrink: 0,
                                            marginTop: 6,
                                        }} />
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

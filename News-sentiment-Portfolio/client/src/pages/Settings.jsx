import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../utils/api';
import { SkeletonCard, Skeleton } from '../components/Skeleton';

export default function Settings() {
    const toast = useToast();
    const navigate = useNavigate();
    const { user, loading: authLoading, logout } = useAuth();
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [name, setName] = useState('');

    useEffect(() => {
        if (authLoading) return;

        if (!user) {
            setLoading(false);
            navigate('/portfolio', { replace: true });
            return;
        }

        let cancelled = false;
        apiRequest('/users/profile')
            .then(data => {
                if (cancelled) return;
                setProfile(data.user);
                setName(data.user.name || '');
            })
            .catch(err => {
                if (cancelled) return;
                if (err?.status === 401 || err?.status === 403) {
                    navigate('/portfolio', { replace: true });
                    return;
                }
                toast(err.message || 'Failed to load profile', 'error');
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [authLoading, navigate, toast, user]);

    const handleLogout = async () => {
        await logout();
        setProfile(null);
        setName('');
        toast('Logged out successfully', 'info');
        navigate('/portfolio', { replace: true });
    };

    const handleSave = async (e) => {
        e.preventDefault();
        if (!name.trim()) return;
        setSaving(true);
        try {
            const data = await apiRequest('/users/profile', {
                method: 'PUT',
                body: JSON.stringify({ name }),
            });
            setProfile(data.user);
            toast('Profile updated', 'success');
        } catch (err) {
            toast(err.message || 'Failed to update profile', 'error');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="page-enter">
            <div className="page-header">
                <h1>Settings</h1>
                <p className="subtitle">Manage your account</p>
            </div>

            <div className="bento-grid">
                <div className="col-span-6">
                    {loading ? (
                        <SkeletonCard>
                            <Skeleton width="40%" height={14} />
                            <Skeleton width="100%" height={40} />
                            <Skeleton width="100%" height={40} />
                            <Skeleton width={120} height={38} />
                        </SkeletonCard>
                    ) : (
                        <div className="glass-card no-hover">
                            <div className="card-header">
                                <h3>Profile</h3>
                            </div>
                            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                <div className="form-group">
                                    <label>Display Name</label>
                                    <input
                                        className="input"
                                        style={{ width: '100%' }}
                                        value={name}
                                        onChange={e => setName(e.target.value)}
                                        placeholder="Enter your name"
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Email</label>
                                    <input
                                        className="input"
                                        style={{ width: '100%', opacity: 0.6, cursor: 'not-allowed' }}
                                        value={profile?.email || ''}
                                        readOnly
                                        title="Email cannot be changed"
                                    />
                                </div>
                                <div>
                                    <button className="btn btn-primary" type="submit" disabled={saving || !name.trim()}>
                                        {saving ? 'Saving...' : 'Save Changes'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}
                </div>

                <div className="col-span-6">
                    {loading ? (
                        <SkeletonCard>
                            <Skeleton width="40%" height={14} />
                            <Skeleton width="100%" height={70} />
                            <Skeleton width="100%" height={70} />
                        </SkeletonCard>
                    ) : (
                        <div className="glass-card no-hover">
                            <div className="card-header"><h3>Account</h3></div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                <div className="list-item" style={{ cursor: 'default' }}>
                                    <div className="item-left">
                                        <div>
                                            <div className="item-symbol" style={{ fontSize: 13 }}>Account Type</div>
                                            <div className="item-name">Standard access</div>
                                        </div>
                                    </div>
                                    <span
                                        className="signal-badge"
                                        style={{
                                            background: 'rgba(148,163,184,0.1)',
                                            color: 'var(--text-secondary)',
                                            textTransform: 'capitalize',
                                        }}
                                    >
                                        Standard
                                    </span>
                                </div>

                                <div className="list-item" style={{ cursor: 'default' }}>
                                    <div className="item-left">
                                        <div>
                                            <div className="item-symbol" style={{ fontSize: 13 }}>Member Since</div>
                                            <div className="item-name">Account creation date</div>
                                        </div>
                                    </div>
                                    <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                                        {profile?.created_at
                                            ? new Date(profile.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
                                            : '-'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {!loading && (
                <div className="col-span-12" style={{ marginTop: '2rem' }}>
                    <div className="glass-card no-hover" style={{ border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem', fontSize: '14px' }}>
                            Sign out of your SentinelQuant account on this device. You will need to re-authenticate to access your portfolio.
                        </p>
                        <button
                            className="btn"
                            style={{ background: '#ef4444', color: 'white', border: 'none', fontWeight: 600 }}
                            onClick={handleLogout}
                        >
                            Log Out
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

// TwoFactorSetup removed from here.

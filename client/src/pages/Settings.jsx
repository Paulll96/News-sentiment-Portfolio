import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { apiRequest } from '../utils/api';
import { SkeletonCard, Skeleton } from '../components/Skeleton';

export default function Settings() {
    const { user } = useAuth();
    const toast = useToast();
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [name, setName] = useState('');

    useEffect(() => {
        apiRequest('/users/profile')
            .then(data => {
                setProfile(data.user);
                setName(data.user.name || '');
            })
            .catch(err => toast(err.message || 'Failed to load profile', 'error'))
            .finally(() => setLoading(false));
    }, []);

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
            toast('Profile updated!', 'success');
        } catch (err) {
            toast(err.message || 'Failed to update profile', 'error');
        } finally {
            setSaving(false);
        }
    };

    const tierColor = { free: 'var(--text-secondary)', pro: 'var(--accent-green)', enterprise: 'var(--accent-purple)' };

    return (
        <div className="page-enter">
            <div className="page-header">
                <h1>Settings</h1>
                <p className="subtitle">Manage your account</p>
            </div>

            <div className="bento-grid">
                {/* Profile Card */}
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
                                        {saving ? 'Saving…' : 'Save Changes'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}
                </div>

                {/* Account Info Card */}
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
                                            <div className="item-symbol" style={{ fontSize: 13 }}>Subscription Tier</div>
                                            <div className="item-name">Your current plan</div>
                                        </div>
                                    </div>
                                    <span
                                        className="signal-badge"
                                        style={{
                                            background: profile?.tier === 'pro' ? 'var(--accent-green-dim)' : 'rgba(148,163,184,0.1)',
                                            color: tierColor[profile?.tier] || 'var(--text-secondary)',
                                            textTransform: 'capitalize',
                                        }}
                                    >
                                        {profile?.tier || 'free'}
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
                                            : '—'}
                                    </span>
                                </div>

                                {profile?.tier === 'free' && (
                                    <div style={{ marginTop: 4 }}>
                                        <div style={{
                                            background: 'var(--accent-blue-dim)',
                                            border: '1px solid rgba(59,130,246,0.2)',
                                            borderRadius: 'var(--radius-md)',
                                            padding: '12px 16px',
                                            fontSize: 13,
                                            color: 'var(--accent-blue)',
                                            marginBottom: 12,
                                        }}>
                                            💡 Free tier shows 5 stocks. Upgrade to Pro for full access to all stocks and advanced analytics.
                                        </div>
                                        <UpgradeTierButton toast={toast} setProfile={setProfile} />
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* 2FA Security Card */}
            {!loading && (
                <div className="col-span-12">
                    <TwoFactorSetup toast={toast} />
                </div>
            )}
        </div>
    );
}

function UpgradeTierButton({ toast, setProfile }) {
    const [loading, setLoading] = useState(false);
    const handleUpgrade = async () => {
        setLoading(true);
        try {
            const data = await apiRequest('/users/upgrade', { method: 'POST' });
            setProfile(data.user);
            toast('Upgraded to Pro! 🎉', 'success');
        } catch (err) {
            toast(err.message || 'Upgrade failed', 'error');
        } finally {
            setLoading(false);
        }
    };
    return (
        <button className="btn btn-primary" onClick={handleUpgrade} disabled={loading}>
            {loading ? 'Upgrading…' : '⚡ Upgrade to Pro'}
        </button>
    );
}

function TwoFactorSetup({ toast }) {
    const [status, setStatus] = useState(null); // null = loading
    const [setupData, setSetupData] = useState(null); // { qrCode, secret }
    const [verifyCode, setVerifyCode] = useState('');
    const [disableCode, setDisableCode] = useState('');
    const [backupCodes, setBackupCodes] = useState(null);
    const [loading, setLoading] = useState(false);
    const [showDisable, setShowDisable] = useState(false);

    useEffect(() => {
        apiRequest('/2fa/status')
            .then(data => setStatus(data.enabled))
            .catch(() => setStatus(false));
    }, []);

    const handleSetup = async () => {
        setLoading(true);
        try {
            const data = await apiRequest('/2fa/setup', { method: 'POST' });
            setSetupData(data);
        } catch (err) {
            toast(err.message || 'Failed to setup 2FA', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleVerify = async (e) => {
        e.preventDefault();
        if (!verifyCode.trim()) return;
        setLoading(true);
        try {
            const data = await apiRequest('/2fa/verify', {
                method: 'POST',
                body: JSON.stringify({ code: verifyCode.trim() }),
            });
            setStatus(true);
            setSetupData(null);
            setVerifyCode('');
            setBackupCodes(data.backupCodes);
            toast('2FA enabled! 🔐', 'success');
        } catch (err) {
            toast(err.message || 'Invalid code', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleDisable = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await apiRequest('/2fa/disable', {
                method: 'POST',
                body: JSON.stringify({ code: disableCode.trim() }),
            });
            setStatus(false);
            setShowDisable(false);
            setDisableCode('');
            setBackupCodes(null);
            toast('2FA disabled', 'info');
        } catch (err) {
            toast(err.message || 'Invalid code', 'error');
        } finally {
            setLoading(false);
        }
    };

    if (status === null) return null;

    return (
        <div className="glass-card no-hover">
            <div className="card-header">
                <h3>🔐 Two-Factor Authentication</h3>
                <span className={`signal-badge ${status ? 'bullish' : ''}`}
                    style={status ? {} : { background: 'rgba(148,163,184,0.1)', color: 'var(--text-secondary)' }}>
                    {status ? '✅ Enabled' : 'Disabled'}
                </span>
            </div>

            {/* Backup codes display (shown once after enabling) */}
            {backupCodes && (
                <div style={{
                    background: 'rgba(251, 146, 60, 0.08)',
                    border: '1px solid rgba(251, 146, 60, 0.25)',
                    borderRadius: 'var(--radius-md)',
                    padding: 16,
                    marginBottom: 16,
                }}>
                    <div style={{ fontWeight: 700, marginBottom: 8 }}>⚠️ Save your backup codes</div>
                    <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>
                        These codes can only be shown once. Store them safely.
                    </p>
                    <div style={{
                        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8,
                        fontFamily: 'monospace', fontSize: 14, fontWeight: 700
                    }}>
                        {backupCodes.map(c => (
                            <div key={c} style={{
                                background: 'rgba(0,0,0,0.3)', borderRadius: 6, padding: '6px 12px', textAlign: 'center'
                            }}>{c}</div>
                        ))}
                    </div>
                    <button className="btn btn-ghost" style={{ marginTop: 12, fontSize: 12 }}
                        onClick={() => { navigator.clipboard.writeText(backupCodes.join('\n')); toast('Backup codes copied!', 'success'); }}>
                        📋 Copy All
                    </button>
                </div>
            )}

            {!status && !setupData && (
                <div>
                    <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 16 }}>
                        Add an extra layer of security to your account using a TOTP authenticator app.
                    </p>
                    <button className="btn btn-primary" onClick={handleSetup} disabled={loading}>
                        {loading ? 'Setting up…' : '🛡️ Setup 2FA'}
                    </button>
                </div>
            )}

            {setupData && (
                <div>
                    <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 12 }}>
                        Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)
                    </p>
                    <div style={{ textAlign: 'center', margin: '16px 0' }}>
                        <img src={setupData.qrCode} alt="2FA QR Code" style={{ borderRadius: 12, maxWidth: 200 }} />
                    </div>
                    <p style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', marginBottom: 12 }}>
                        Or manually enter: <code style={{ background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: 4 }}>{setupData.secret}</code>
                    </p>
                    <form onSubmit={handleVerify} style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                        <div className="form-group" style={{ flex: 1, margin: 0 }}>
                            <label>Verification Code</label>
                            <input className="input" placeholder="000000" value={verifyCode}
                                onChange={e => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                style={{ letterSpacing: 4, fontWeight: 700 }}
                            />
                        </div>
                        <button className="btn btn-primary" type="submit" disabled={loading || verifyCode.length < 6}>
                            {loading ? 'Verifying…' : 'Verify'}
                        </button>
                    </form>
                </div>
            )}

            {status && !backupCodes && (
                <div>
                    <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 16 }}>
                        Your account is protected with two-factor authentication.
                    </p>
                    {!showDisable ? (
                        <button className="btn btn-ghost" style={{ color: 'var(--accent-red)' }} onClick={() => setShowDisable(true)}>
                            Disable 2FA
                        </button>
                    ) : (
                        <form onSubmit={handleDisable} style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                            <div className="form-group" style={{ flex: 1, margin: 0 }}>
                                <label>Enter code to disable</label>
                                <input className="input" placeholder="000000" value={disableCode}
                                    onChange={e => setDisableCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                />
                            </div>
                            <button className="btn btn-ghost" type="submit" disabled={loading || disableCode.length < 6}
                                style={{ color: 'var(--accent-red)' }}>
                                {loading ? 'Disabling…' : 'Confirm Disable'}
                            </button>
                            <button className="btn btn-ghost" type="button" onClick={() => { setShowDisable(false); setDisableCode(''); }}>
                                Cancel
                            </button>
                        </form>
                    )}
                </div>
            )}
        </div>
    );
}

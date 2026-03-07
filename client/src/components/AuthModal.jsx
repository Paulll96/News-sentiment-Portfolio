import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export default function AuthModal({ open, onClose }) {
    const [isLogin, setIsLogin] = useState(true);
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [totpCode, setTotpCode] = useState('');
    const [loading, setLoading] = useState(false);
    const { login, signup, verify2FA, cancel2FA, twoFactorChallenge } = useAuth();
    const toast = useToast();

    if (!open) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const result = isLogin
                ? await login(email, password)
                : await signup(name, email, password);

            if (result?.requires2FA) {
                toast('Please enter your 2FA code', 'info');
                setLoading(false);
                return; // Stay on modal, show 2FA input
            }

            toast(`Welcome${result?.name ? ', ' + result.name : ''}!`, 'success');
            onClose();
        } catch (err) {
            toast(err.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handle2FASubmit = async (e) => {
        e.preventDefault();
        if (!totpCode.trim()) return;
        setLoading(true);
        try {
            const user = await verify2FA(totpCode.trim());
            toast(`Welcome back, ${user.name || user.email}! 🔐`, 'success');
            setTotpCode('');
            onClose();
        } catch (err) {
            toast(err.message || 'Invalid 2FA code', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleCancel2FA = () => {
        cancel2FA();
        setTotpCode('');
    };

    const handleClose = () => {
        if (twoFactorChallenge) cancel2FA();
        setTotpCode('');
        onClose();
    };

    // 2FA Code Input View
    if (twoFactorChallenge) {
        return (
            <div className="modal-overlay" onClick={handleClose}>
                <div className="modal-box" onClick={e => e.stopPropagation()}>
                    <button className="modal-close" onClick={handleClose}>&times;</button>
                    <div style={{ textAlign: 'center', marginBottom: 16 }}>
                        <span style={{ fontSize: 40 }}>🔐</span>
                    </div>
                    <h2 style={{ textAlign: 'center' }}>Two-Factor Authentication</h2>
                    <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13, marginBottom: 16 }}>
                        Enter the 6-digit code from your authenticator app
                    </p>
                    <form onSubmit={handle2FASubmit}>
                        <div className="form-group">
                            <input
                                className="input"
                                type="text"
                                placeholder="000000"
                                value={totpCode}
                                onChange={e => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                style={{ textAlign: 'center', fontSize: 24, letterSpacing: 8, fontWeight: 700 }}
                                autoFocus
                                maxLength={8}
                            />
                        </div>
                        <button className="btn btn-primary btn-full" type="submit" disabled={loading || totpCode.length < 6}>
                            {loading ? 'Verifying…' : 'Verify Code'}
                        </button>
                    </form>
                    <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 12, marginTop: 12 }}>
                        You can also use a backup code
                    </p>
                    <p className="auth-switch" style={{ marginTop: 8 }}>
                        <a onClick={handleCancel2FA}>← Back to login</a>
                    </p>
                </div>
            </div>
        );
    }

    // Normal Login/Signup View
    return (
        <div className="modal-overlay" onClick={handleClose}>
            <div className="modal-box" onClick={e => e.stopPropagation()}>
                <button className="modal-close" onClick={handleClose}>&times;</button>
                <h2>{isLogin ? 'Login' : 'Sign Up'}</h2>
                <form onSubmit={handleSubmit}>
                    {!isLogin && (
                        <div className="form-group">
                            <label>Name</label>
                            <input className="input" type="text" placeholder="Your name" value={name} onChange={e => setName(e.target.value)} />
                        </div>
                    )}
                    <div className="form-group">
                        <label>Email</label>
                        <input className="input" type="email" placeholder="you@example.com" required value={email} onChange={e => setEmail(e.target.value)} />
                    </div>
                    <div className="form-group">
                        <label>Password</label>
                        <input className="input" type="password" placeholder="••••••••" required value={password} onChange={e => setPassword(e.target.value)} />
                    </div>
                    <button className="btn btn-primary btn-full" type="submit" disabled={loading}>
                        {loading ? 'Please wait…' : (isLogin ? 'Login' : 'Sign Up')}
                    </button>
                </form>
                <p className="auth-switch">
                    {isLogin ? "Don't have an account? " : "Already have an account? "}
                    <a onClick={() => setIsLogin(!isLogin)}>{isLogin ? 'Sign up' : 'Login'}</a>
                </p>
            </div>
        </div>
    );
}

import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export default function AuthModal({ open, mode = 'login', onModeChange, onClose }) {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const { login, signup } = useAuth();
    const toast = useToast();
    const isLogin = mode === 'login';

    if (!open) return null;

    const resetAuthForm = () => {
        setName('');
        setEmail('');
        setPassword('');
        setLoading(false);
    };

    const handleModeSwitch = () => {
        onModeChange?.(isLogin ? 'signup' : 'login');
        resetAuthForm();
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await (isLogin
                ? login(email, password)
                : signup(name, email, password));

            toast('Welcome!', 'success');
            resetAuthForm();
            onClose();
        } catch (err) {
            toast(err.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        resetAuthForm();
        onClose();
    };

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
                    <a onClick={handleModeSwitch}>{isLogin ? 'Sign up' : 'Login'}</a>
                </p>
            </div>
        </div>
    );
}

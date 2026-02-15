import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export default function AuthModal({ open, onClose }) {
    const [isLogin, setIsLogin] = useState(true);
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const { login, signup } = useAuth();
    const toast = useToast();

    if (!open) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const user = isLogin
                ? await login(email, password)
                : await signup(name, email, password);
            toast(`Welcome${user.name ? ', ' + user.name : ''}!`, 'success');
            onClose();
        } catch (err) {
            toast(err.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-box" onClick={e => e.stopPropagation()}>
                <button className="modal-close" onClick={onClose}>&times;</button>
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

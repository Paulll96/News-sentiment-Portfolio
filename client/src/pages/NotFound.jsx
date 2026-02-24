import { Link } from 'react-router-dom';

export default function NotFound() {
    return (
        <div className="page-enter" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
            <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 80, marginBottom: 16, lineHeight: 1 }}>🔍</div>
                <h1 style={{ fontSize: 48, fontWeight: 800, marginBottom: 8, background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-purple))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                    404
                </h1>
                <p style={{ fontSize: 18, color: 'var(--text-secondary)', marginBottom: 24 }}>
                    The page you're looking for doesn't exist
                </p>
                <Link to="/" className="btn btn-primary" style={{ fontSize: 14 }}>
                    ← Back to Dashboard
                </Link>
            </div>
        </div>
    );
}

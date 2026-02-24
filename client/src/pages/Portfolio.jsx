import { useState, useEffect } from 'react';
import { apiRequest, formatCurrency } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { SkeletonTableRow } from '../components/Skeleton';
import { exportPortfolio } from '../utils/export';

export default function Portfolio() {
    const { user } = useAuth();
    const toast = useToast();
    const [holdings, setHoldings] = useState(null); // null = loading
    const [trades, setTrades] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!user) { setHoldings([]); return; }
        apiRequest('/portfolio')
            .then(data => setHoldings(data.holdings || []))
            .catch(err => {
                toast(err.message || 'Failed to load portfolio', 'error');
                setHoldings([]);
            });
    }, [user]);

    const handleInit = async () => {
        if (!user) { toast('Please login first', 'error'); return; }
        try {
            setLoading(true);
            await apiRequest('/portfolio/initialize', { method: 'POST' });
            toast('Portfolio initialized!', 'success');
            // Reload holdings
            const data = await apiRequest('/portfolio');
            setHoldings(data.holdings || []);
        } catch (e) { toast(e.message, 'error'); }
        finally { setLoading(false); }
    };

    const handleRebalance = async () => {
        if (!user) { toast('Please login first', 'error'); return; }
        try {
            setLoading(true);
            const data = await apiRequest('/portfolio/rebalance', {
                method: 'POST',
                body: JSON.stringify({ dryRun: true }),
            });
            setTrades(data.trades || []);
            toast('Rebalance preview generated', 'success');
        } catch (e) { toast(e.message, 'error'); }
        finally { setLoading(false); }
    };

    const handleExecuteRebalance = async () => {
        if (!user) { toast('Please login first', 'error'); return; }
        if (trades.length === 0) { toast('Run a preview first', 'info'); return; }
        try {
            setLoading(true);
            await apiRequest('/portfolio/rebalance', {
                method: 'POST',
                body: JSON.stringify({ dryRun: false }),
            });
            toast('Rebalance executed!', 'success');
            setTrades([]);
            // Reload holdings
            const data = await apiRequest('/portfolio');
            setHoldings(data.holdings || []);
        } catch (e) { toast(e.message, 'error'); }
        finally { setLoading(false); }
    };

    return (
        <div className="page-enter">
            <div className="page-header">
                <h1>Portfolio Management</h1>
                <p className="subtitle">Sentiment-driven dynamic rebalancing</p>
            </div>

            {!user ? (
                <div className="glass-card no-hover" style={{ textAlign: 'center', padding: 48 }}>
                    <p style={{ fontSize: 18, marginBottom: 16 }}>🔑 Please log in to manage your portfolio</p>
                </div>
            ) : (
                <>
                    <div className="controls-bar">
                        <button className="btn btn-primary" onClick={handleInit} disabled={loading}>🚀 Initialize Portfolio</button>
                        <button className="btn btn-secondary" onClick={handleRebalance} disabled={loading}>⚖️ Rebalance (Preview)</button>
                        <button className="btn btn-success" onClick={handleExecuteRebalance} disabled={loading || trades.length === 0}>✅ Execute Rebalance</button>
                        {holdings && holdings.length > 0 && (
                            <button className="btn btn-ghost" onClick={() => exportPortfolio(holdings)}>📥 Export CSV</button>
                        )}
                    </div>

                    <div className="bento-grid">
                        {/* Holdings */}
                        <div className="glass-card no-hover col-span-8">
                            <div className="card-header"><h3>Current Holdings</h3></div>
                            <div className="data-table-wrap">
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>Symbol</th>
                                            <th>Name</th>
                                            <th>Shares</th>
                                            <th>Value</th>
                                            <th>Weight</th>
                                            <th>Signal</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {holdings === null ? (
                                            Array.from({ length: 5 }).map((_, i) => <SkeletonTableRow key={i} />)
                                        ) : holdings.length === 0 ? (
                                            <tr><td colSpan={6} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>No holdings yet — click "Initialize Portfolio"</td></tr>
                                        ) : (
                                            holdings.map((h, i) => (
                                                <tr key={i}>
                                                    <td style={{ fontWeight: 700, color: 'var(--accent-blue)' }}>{h.symbol}</td>
                                                    <td>{h.name}</td>
                                                    <td>{parseFloat(h.shares).toFixed(2)}</td>
                                                    <td>{formatCurrency(h.currentValue || h.value)}</td>
                                                    <td>{(h.weight || 0).toFixed(1)}%</td>
                                                    <td><span className={`signal-badge ${h.signal || 'neutral'}`}>{h.signal || 'neutral'}</span></td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Trades */}
                        <div className="glass-card no-hover col-span-4">
                            <div className="card-header"><h3>Suggested Trades</h3></div>
                            {trades.length === 0 ? (
                                <p className="empty-state">Click "Rebalance" to see suggested trades</p>
                            ) : trades.map((t, i) => (
                                <div className="list-item" key={i} style={{ borderLeft: `3px solid ${t.type === 'buy' ? 'var(--accent-green)' : 'var(--accent-red)'}` }}>
                                    <div className="item-left">
                                        <div>
                                            <div className="item-symbol">{t.type?.toUpperCase()} {t.symbol}</div>
                                            <div className="item-name">{t.currentWeight} → {t.targetWeight}</div>
                                        </div>
                                    </div>
                                    <div className="item-right">
                                        <div className="item-amount">{formatCurrency(t.tradeValue)}</div>
                                        <div className="item-weight">{t.signal}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

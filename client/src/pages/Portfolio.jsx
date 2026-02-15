import { useState, useEffect } from 'react';
import { apiRequest, formatCurrency } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

const mockHoldings = [
    { symbol: 'NVDA', name: 'NVIDIA', value: 2800, weight: 22.5 },
    { symbol: 'AAPL', name: 'Apple', value: 2450, weight: 19.7 },
    { symbol: 'MSFT', name: 'Microsoft', value: 2100, weight: 16.9 },
    { symbol: 'GOOGL', name: 'Alphabet', value: 1850, weight: 14.9 },
    { symbol: 'AMZN', name: 'Amazon', value: 1600, weight: 12.9 },
    { symbol: 'TSLA', name: 'Tesla', value: 1650, weight: 13.3 },
];

export default function Portfolio() {
    const { user } = useAuth();
    const toast = useToast();
    const [holdings, setHoldings] = useState(mockHoldings);
    const [trades, setTrades] = useState([]);

    useEffect(() => {
        if (!user) return;
        apiRequest('/portfolio')
            .then(data => { if (data.holdings?.length) setHoldings(data.holdings); })
            .catch(() => {/* mock */ });
    }, [user]);

    const handleInit = async () => {
        if (!user) { toast('Please login first', 'error'); return; }
        try {
            await apiRequest('/portfolio/initialize', { method: 'POST' });
            toast('Portfolio initialized!', 'success');
        } catch (e) { toast(e.message, 'error'); }
    };

    const handleRebalance = async () => {
        if (!user) { toast('Please login first', 'error'); return; }
        try {
            const data = await apiRequest('/portfolio/rebalance', {
                method: 'POST',
                body: JSON.stringify({ dryRun: true }),
            });
            setTrades(data.trades || []);
            toast('Rebalance preview generated', 'success');
        } catch (e) { toast(e.message, 'error'); }
    };

    return (
        <div className="page-enter">
            <div className="page-header">
                <h1>Portfolio Management</h1>
                <p className="subtitle">Sentiment-driven dynamic rebalancing</p>
            </div>

            <div className="controls-bar">
                <button className="btn btn-primary" onClick={handleInit}>🚀 Initialize Portfolio</button>
                <button className="btn btn-secondary" onClick={handleRebalance}>⚖️ Rebalance (Preview)</button>
                <button className="btn btn-success">✅ Execute Rebalance</button>
            </div>

            <div className="bento-grid">
                {/* Holdings */}
                <div className="glass-card no-hover col-span-8">
                    <div className="card-header"><h3>Current Holdings</h3></div>
                    {!user && <p className="empty-state">Please login to view your portfolio</p>}
                    {user && holdings.length === 0 && <p className="empty-state">No holdings yet. Initialize your portfolio.</p>}
                    {(user || holdings === mockHoldings) && holdings.map((h, i) => (
                        <div className="list-item" key={i}>
                            <div className="item-left">
                                <div>
                                    <div className="item-symbol">{h.symbol}</div>
                                    <div className="item-name">{h.name}</div>
                                </div>
                            </div>
                            <div className="item-right">
                                <div className="item-amount">{formatCurrency(h.currentValue || h.value)}</div>
                                <div className="item-weight">{(h.weight || 0).toFixed(1)}%</div>
                            </div>
                        </div>
                    ))}
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
        </div>
    );
}

import { useState, useEffect } from 'react';
import { apiRequest } from '../utils/api';
import { useToast } from '../context/ToastContext';

const mockData = [
    { symbol: 'NVDA', name: 'NVIDIA Corporation', wss: 0.88, signal: 'bullish', articles: 245 },
    { symbol: 'AAPL', name: 'Apple Inc.', wss: 0.72, signal: 'bullish', articles: 312 },
    { symbol: 'GOOGL', name: 'Alphabet Inc.', wss: 0.55, signal: 'bullish', articles: 189 },
    { symbol: 'MSFT', name: 'Microsoft Corporation', wss: 0.45, signal: 'bullish', articles: 267 },
    { symbol: 'AMZN', name: 'Amazon.com Inc.', wss: 0.38, signal: 'bullish', articles: 198 },
    { symbol: 'JPM', name: 'JPMorgan Chase', wss: 0.12, signal: 'neutral', articles: 134 },
    { symbol: 'JNJ', name: 'Johnson & Johnson', wss: -0.05, signal: 'neutral', articles: 87 },
    { symbol: 'META', name: 'Meta Platforms', wss: -0.18, signal: 'neutral', articles: 156 },
    { symbol: 'TSLA', name: 'Tesla Inc.', wss: -0.32, signal: 'bearish', articles: 423 },
    { symbol: 'V', name: 'Visa Inc.', wss: 0.25, signal: 'bullish', articles: 78 },
];

export default function Sentiment() {
    const [sentiments, setSentiments] = useState(mockData);
    const [timeframe, setTimeframe] = useState('7');
    const toast = useToast();

    useEffect(() => {
        apiRequest('/sentiment')
            .then(data => setSentiments(data.sentiments || []))
            .catch(() => {/* keep mock */ });
    }, []);

    const handleRefresh = async () => {
        try {
            const data = await apiRequest('/sentiment');
            setSentiments(data.sentiments || []);
            toast('Sentiment data refreshed', 'success');
        } catch {
            toast('Using mock data', 'info');
        }
    };

    return (
        <div className="page-enter">
            <div className="page-header">
                <h1>Sentiment Analysis</h1>
                <p className="subtitle">Real-time FinBERT-powered financial sentiment</p>
            </div>

            <div className="controls-bar">
                <div className="form-group">
                    <label>Timeframe</label>
                    <select className="select-input" value={timeframe} onChange={e => setTimeframe(e.target.value)}>
                        <option value="1">Last 24 Hours</option>
                        <option value="7">Last 7 Days</option>
                        <option value="30">Last 30 Days</option>
                    </select>
                </div>
                <button className="btn btn-primary" onClick={handleRefresh}>🔄 Refresh</button>
            </div>

            <div className="bento-grid">
                <div className="glass-card no-hover col-span-12">
                    <div className="data-table-wrap">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Symbol</th>
                                    <th>Company</th>
                                    <th>Sentiment Score</th>
                                    <th>Signal</th>
                                    <th>Articles</th>
                                    <th>Trend</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sentiments.map((s, i) => (
                                    <tr key={i}>
                                        <td><strong>{s.symbol}</strong></td>
                                        <td>{s.name}</td>
                                        <td style={{ color: s.wss > 0 ? 'var(--accent-green)' : s.wss < 0 ? 'var(--accent-red)' : 'inherit', fontWeight: 600 }}>
                                            {s.wss > 0 ? '+' : ''}{s.wss.toFixed(3)}
                                        </td>
                                        <td><span className={`signal-badge ${s.signal}`}>{s.signal}</span></td>
                                        <td>{s.articles || s.articleCount}</td>
                                        <td style={{ fontSize: 18 }}>{s.wss > 0 ? '📈' : s.wss < 0 ? '📉' : '➡️'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}

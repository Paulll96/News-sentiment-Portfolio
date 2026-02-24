import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../utils/api';
import { useToast } from '../context/ToastContext';
import { SkeletonTableRow } from '../components/Skeleton';
import { exportSentiments } from '../utils/export';

export default function Sentiment() {
    const [sentiments, setSentiments] = useState(null); // null = loading
    const [timeframe, setTimeframe] = useState('7');
    const toast = useToast();

    useEffect(() => {
        apiRequest(`/sentiment?days=${timeframe}`)
            .then(data => setSentiments(data.sentiments || []))
            .catch(err => {
                toast(err.message || 'Failed to load sentiment data', 'error');
                setSentiments([]);
            });
    }, [timeframe]);

    const handleRefresh = async () => {
        setSentiments(null); // trigger skeleton
        try {
            const data = await apiRequest('/sentiment');
            setSentiments(data.sentiments || []);
            toast('Sentiment data refreshed', 'success');
        } catch (err) {
            toast(err.message || 'Failed to fetch sentiment data', 'error');
            setSentiments([]);
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
                {sentiments && sentiments.length > 0 && (
                    <button className="btn btn-ghost" onClick={() => exportSentiments(sentiments)}>📥 Export CSV</button>
                )}
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
                                {sentiments === null ? (
                                    Array.from({ length: 6 }).map((_, i) => <SkeletonTableRow key={i} />)
                                ) : sentiments.length === 0 ? (
                                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>No sentiment data yet — run a scrape first</td></tr>
                                ) : (
                                    sentiments.map((s, i) => (
                                        <tr key={i}>
                                            <td>
                                                <Link to={`/stock/${s.symbol}`} style={{ color: 'var(--accent-blue)', fontWeight: 700, textDecoration: 'none' }}
                                                    onMouseOver={e => e.target.style.textDecoration = 'underline'}
                                                    onMouseOut={e => e.target.style.textDecoration = 'none'}>
                                                    {s.symbol}
                                                </Link>
                                            </td>
                                            <td>{s.name}</td>
                                            <td style={{ color: s.wss > 0 ? 'var(--accent-green)' : s.wss < 0 ? 'var(--accent-red)' : 'inherit', fontWeight: 600 }}>
                                                {s.wss > 0 ? '+' : ''}{(s.wss ?? 0).toFixed(3)}
                                            </td>
                                            <td><span className={`signal-badge ${s.signal}`}>{s.signal}</span></td>
                                            <td>{s.articles || s.articleCount || '—'}</td>
                                            <td style={{ fontSize: 18 }}>{s.wss > 0 ? '📈' : s.wss < 0 ? '📉' : '➡️'}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}

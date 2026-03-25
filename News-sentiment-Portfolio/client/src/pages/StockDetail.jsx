import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { apiRequest } from '../utils/api';
import { useToast } from '../context/ToastContext';
import {
    ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, ReferenceLine,
} from 'recharts';
import { SkeletonChartCard, SkeletonStatCard, Skeleton, SkeletonCard } from '../components/Skeleton';

const tooltipStyle = {
    background: '#111827',
    border: '1px solid rgba(148,163,184,0.12)',
    borderRadius: 10,
    padding: '10px 14px',
    fontSize: 12,
};

const RANGE_OPTIONS = [
    { label: '7D', days: 7 },
    { label: '30D', days: 30 },
    { label: '90D', days: 90 },
];

export default function StockDetail() {
    const { symbol } = useParams();
    const toast = useToast();
    const [stock, setStock] = useState(null);
    const [sentiment, setSentiment] = useState(null);
    const [history, setHistory] = useState([]);
    const [range, setRange] = useState(30);
    const [loading, setLoading] = useState(true);
    const [histLoading, setHistLoading] = useState(false);

    // Fetch stock info + current sentiment
    useEffect(() => {
        setLoading(true);
        Promise.all([
            apiRequest(`/stocks/${symbol}`),
            apiRequest(`/sentiment/${symbol}`),
        ])
            .then(([stockData, sentimentData]) => {
                setStock(stockData.stock);
                setSentiment(sentimentData);
            })
            .catch(err => toast(err.message || 'Failed to load stock data', 'error'))
            .finally(() => setLoading(false));
    }, [symbol]);

    // Fetch history on range change
    useEffect(() => {
        if (!symbol) return;
        setHistLoading(true);
        apiRequest(`/sentiment/history/${symbol}?days=${range}`)
            .then(data => setHistory(data.history || []))
            .catch(() => setHistory([]))
            .finally(() => setHistLoading(false));
    }, [symbol, range]);

    const signalColor = {
        bullish: 'var(--accent-green)',
        bearish: 'var(--accent-red)',
        neutral: 'var(--text-secondary)',
    };

    const signalBg = {
        bullish: 'var(--accent-green-dim)',
        bearish: 'var(--accent-red-dim)',
        neutral: 'rgba(148,163,184,0.1)',
    };

    const sig = sentiment?.signal || 'neutral';
    const wss = sentiment?.wss ?? null;

    return (
        <div className="page-enter">
            {/* Header */}
            <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                <div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
                        <Link to="/sentiment" style={{ color: 'var(--accent-blue)', textDecoration: 'none' }}>← Back to Sentiment</Link>
                    </div>
                    {loading ? (
                        <>
                            <Skeleton width={200} height={32} style={{ marginBottom: 8 }} />
                            <Skeleton width={150} height={14} />
                        </>
                    ) : (
                        <>
                            <h1 style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                {symbol?.toUpperCase()}
                                <span style={{
                                    fontSize: 13,
                                    fontWeight: 600,
                                    padding: '4px 12px',
                                    borderRadius: 9999,
                                    background: signalBg[sig],
                                    color: signalColor[sig],
                                    textTransform: 'capitalize',
                                }}>
                                    {sig === 'bullish' ? '▲' : sig === 'bearish' ? '▼' : '●'} {sig}
                                </span>
                            </h1>
                            <p className="subtitle">{stock?.name} · {stock?.sector}</p>
                        </>
                    )}
                </div>
            </div>

            <div className="bento-grid">
                {/* Stat Cards Row */}
                {loading ? (
                    <>
                        <div className="col-span-4"><SkeletonStatCard /></div>
                        <div className="col-span-4"><SkeletonStatCard /></div>
                        <div className="col-span-4"><SkeletonStatCard /></div>
                    </>
                ) : (
                    <>
                        <div className="col-span-4">
                            <div className="glass-card no-hover">
                                <div className="stat-card">
                                    <div className="stat-icon" style={{ background: signalBg[sig], color: signalColor[sig], width: 48, height: 48, borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
                                        {sig === 'bullish' ? '📈' : sig === 'bearish' ? '📉' : '📊'}
                                    </div>
                                    <div className="stat-body">
                                        <div className="stat-value" style={{ color: signalColor[sig] }}>
                                            {wss !== null ? (wss > 0 ? '+' : '') + (wss * 100).toFixed(1) + '%' : 'N/A'}
                                        </div>
                                        <div className="stat-label">Weighted Sentiment Score</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="col-span-4">
                            <div className="glass-card no-hover">
                                <div className="stat-card">
                                    <div className="stat-icon blue" style={{ width: 48, height: 48, borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
                                        🗞️
                                    </div>
                                    <div className="stat-body">
                                        <div className="stat-value">{sentiment?.articleCount ?? '—'}</div>
                                        <div className="stat-label">Articles Analyzed (last {sentiment?.days || 7}d)</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="col-span-4">
                            <div className="glass-card no-hover">
                                <div className="stat-card">
                                    <div className="stat-icon purple" style={{ width: 48, height: 48, borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
                                        🎯
                                    </div>
                                    <div className="stat-body">
                                        <div className="stat-value" style={{ textTransform: 'capitalize', color: signalColor[sig] }}>
                                            {sig}
                                        </div>
                                        <div className="stat-label">Trading Signal</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </>
                )}

                {/* Sentiment History Chart */}
                <div className="col-span-8">
                    {histLoading ? (
                        <SkeletonChartCard height={320} />
                    ) : (
                        <div className="glass-card no-hover">
                            <div className="card-header">
                                <h3>Sentiment History</h3>
                                <div style={{ display: 'flex', gap: 6 }}>
                                    {RANGE_OPTIONS.map(opt => (
                                        <button
                                            key={opt.days}
                                            onClick={() => setRange(opt.days)}
                                            style={{
                                                padding: '4px 10px',
                                                fontSize: 11,
                                                fontWeight: 700,
                                                borderRadius: 6,
                                                border: 'none',
                                                cursor: 'pointer',
                                                background: range === opt.days ? 'var(--accent-blue)' : 'rgba(255,255,255,0.05)',
                                                color: range === opt.days ? '#fff' : 'var(--text-secondary)',
                                                transition: 'all 0.2s',
                                            }}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            {history.length === 0 ? (
                                <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 14, flexDirection: 'column', gap: 8 }}>
                                    <span style={{ fontSize: 32 }}>📭</span>
                                    <span>No history yet — data populates after the first cron cycle</span>
                                </div>
                            ) : (
                                <div className="chart-area" style={{ height: 300 }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={history.map(d => ({ ...d, date: d.date?.substring(0, 10) }))}>
                                            <defs>
                                                <linearGradient id="gradSentiment" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="0%" stopColor="#22d3a7" stopOpacity={0.25} />
                                                    <stop offset="100%" stopColor="#22d3a7" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#475569', fontSize: 11 }} interval="preserveStartEnd" />
                                            <YAxis domain={[-1, 1]} axisLine={false} tickLine={false} tick={{ fill: '#475569', fontSize: 11 }} tickFormatter={v => v.toFixed(1)} />
                                            <Tooltip contentStyle={tooltipStyle} formatter={v => [(v * 100).toFixed(1) + '%', 'WSS']} />
                                            <ReferenceLine y={0} stroke="rgba(255,255,255,0.1)" strokeDasharray="4 4" />
                                            <Area type="monotone" dataKey="weighted_sentiment" stroke="#22d3a7" strokeWidth={2} fill="url(#gradSentiment)" name="Sentiment" dot={false} />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Recent News with Sentiment */}
                <div className="col-span-4">
                    {loading ? (
                        <SkeletonCard>
                            {[1, 2, 3, 4].map(i => (
                                <div key={i} style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                                    <Skeleton width={40} height={40} />
                                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                                        <Skeleton width="90%" height={13} />
                                        <Skeleton width="50%" height={11} />
                                    </div>
                                </div>
                            ))}
                        </SkeletonCard>
                    ) : (
                        <div className="glass-card no-hover" style={{ overflow: 'hidden' }}>
                            <div className="card-header">
                                <h3>Recent News</h3>
                                <span className="badge badge-live">Live</span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 0, maxHeight: 340, overflowY: 'auto' }}>
                                {(sentiment?.recentScores || []).length === 0 ? (
                                    <div style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: 24 }}>
                                        No analyzed articles yet
                                    </div>
                                ) : (
                                    sentiment.recentScores.map((s, i) => (
                                        <div key={i} className="news-card" style={{ padding: '10px 0', borderBottom: i < sentiment.recentScores.length - 1 ? '1px solid var(--border-color)' : 'none' }}>
                                            <div className={`news-sentiment-icon ${s.sentiment}`} style={{ width: 36, height: 36, fontSize: 14, flexShrink: 0 }}>
                                                {s.sentiment === 'positive' ? '📈' : s.sentiment === 'negative' ? '📉' : '📊'}
                                            </div>
                                            <div className="news-body">
                                                <div className="news-title" style={{ fontSize: 12, WebkitLineClamp: 2, display: '-webkit-box', WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                                    {s.title}
                                                </div>
                                                <div className="news-meta" style={{ marginTop: 4 }}>
                                                    <span style={{
                                                        padding: '2px 7px',
                                                        borderRadius: 4,
                                                        fontSize: 10,
                                                        fontWeight: 700,
                                                        textTransform: 'uppercase',
                                                        background: s.sentiment === 'positive' ? 'var(--accent-green-dim)' : s.sentiment === 'negative' ? 'var(--accent-red-dim)' : 'rgba(148,163,184,0.1)',
                                                        color: s.sentiment === 'positive' ? 'var(--accent-green)' : s.sentiment === 'negative' ? 'var(--accent-red)' : 'var(--text-secondary)',
                                                    }}>
                                                        {s.sentiment}
                                                    </span>
                                                    <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>
                                                        {s.confidence ? (s.confidence * 100).toFixed(0) + '% conf' : ''}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

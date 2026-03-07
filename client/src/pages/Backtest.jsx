import { useState } from 'react';
import { apiRequest, formatCurrency } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import StarBorder from '../components/ReactBits/StarBorder';
import { ResponsiveContainer, AreaChart, Area, Line, XAxis, YAxis, Tooltip } from 'recharts';

const customTooltipStyle = {
    background: '#111827',
    border: '1px solid rgba(148,163,184,0.12)',
    borderRadius: 10,
    padding: '10px 14px',
    fontSize: 12,
};

export default function Backtest() {
    const toast = useToast();
    const { user } = useAuth();
    const [startDate, setStartDate] = useState('2020-01-01');
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [capital, setCapital] = useState(10000);
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);

    const handleRun = async () => {
        if (!user) {
            toast('Please log in to run backtests', 'error');
            return;
        }
        setLoading(true);
        toast('Running backtest…', 'info');
        try {
            const r = await apiRequest('/backtest/run', {
                method: 'POST',
                body: JSON.stringify({ startDate, endDate, initialCapital: capital }),
            });
            setResult(r);
            toast(r.sentimentDataUsed
                ? 'Backtest completed with real sentiment data!'
                : 'Backtest completed (baseline model — no sentiment data in date range)',
                r.sentimentDataUsed ? 'success' : 'info'
            );
        } catch (e) {
            toast(e.message || 'Backtest failed', 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="page-enter">
            <div className="page-header">
                <h1>Backtesting Simulator</h1>
                <p className="subtitle">Validate strategy with historical sentiment data</p>
            </div>

            <div className="bento-grid">
                <div className="col-span-4" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div className="glass-card no-hover">
                        <div className="card-header"><h3>Configuration</h3></div>
                        <div className="form-group">
                            <label>Start Date</label>
                            <input className="input" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                        </div>
                        <div className="form-group" style={{ marginTop: 12 }}>
                            <label>End Date</label>
                            <input className="input" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
                        </div>
                        <div className="form-group" style={{ marginTop: 12 }}>
                            <label>Initial Capital ($)</label>
                            <input className="input" type="number" value={capital} onChange={e => setCapital(e.target.value)} />
                        </div>
                        <StarBorder as="div" color="#22d3a7" speed="5s" className="btn-full" style={{ marginTop: 20, width: '100%' }}>
                            <button className="btn btn-primary btn-full" onClick={handleRun} disabled={loading} style={{ width: '100%', border: 'none', background: 'transparent', color: '#fff' }}>
                                {loading ? '⏳ Running…' : '🚀 Run Backtest'}
                            </button>
                        </StarBorder>
                        {!user && (
                            <p style={{ marginTop: 12, fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
                                🔑 Login required to run backtests
                            </p>
                        )}
                    </div>

                    {result && (
                        <div className="results-grid">
                            <ResultCell label="Final Value" value={formatCurrency(result.summary.finalValue)} />
                            <ResultCell label="Total Return" value={result.summary.totalReturn} positive={parseFloat(result.summary.totalReturn) > 0} />
                            <ResultCell label="CAGR" value={result.summary.cagr} />
                            <ResultCell label="Sharpe Ratio" value={result.summary.sharpeRatio} />
                            <ResultCell label="Alpha" value={result.summary.alpha} positive={parseFloat(result.summary.alpha) > 0} />
                            <ResultCell label="Max Drawdown" value={result.summary.maxDrawdown} negative />
                            {result.sentimentDataUsed !== undefined && (
                                <div className="result-cell" style={{ gridColumn: '1 / -1' }}>
                                    <div className="result-label">Data Source</div>
                                    <div className={`result-value ${result.sentimentDataUsed ? 'positive' : ''}`}>
                                        {result.sentimentDataUsed ? '✅ Real Sentiment' : '📊 Baseline Model'}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="glass-card no-hover col-span-8" style={{ minHeight: 500 }}>
                    <div className="card-header">
                        <h3>Equity Curve</h3>
                        <div className="chart-legend">
                            <span className="legend-item"><span className="legend-dot" style={{ background: '#22d3a7' }} /> Portfolio</span>
                            <span className="legend-item"><span className="legend-dot" style={{ background: '#475569' }} /> Benchmark</span>
                        </div>
                    </div>
                    {result ? (
                        <div className="chart-area tall" style={{ height: '100%' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={result.equityCurve}>
                                    <defs>
                                        <linearGradient id="gradBt" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#22d3a7" stopOpacity={0.2} />
                                            <stop offset="100%" stopColor="#22d3a7" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#475569', fontSize: 11 }} interval="preserveStartEnd" />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#475569', fontSize: 11 }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                                    <Tooltip contentStyle={customTooltipStyle} formatter={v => [`$${v.toLocaleString()}`, '']} />
                                    <Area type="monotone" dataKey="portfolio" stroke="#22d3a7" strokeWidth={2} fill="url(#gradBt)" name="Portfolio" />
                                    <Line type="monotone" dataKey="benchmark" stroke="#475569" strokeWidth={1.5} strokeDasharray="5 5" dot={false} name="Benchmark" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', flexDirection: 'column', gap: 8 }}>
                            <span style={{ fontSize: 32 }}>📈</span>
                            <span>{user ? 'Run a backtest to view the equity curve' : 'Log in to run backtests'}</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function ResultCell({ label, value, positive, negative }) {
    const cls = positive ? 'positive' : negative ? 'negative' : '';
    return (
        <div className="result-cell">
            <div className="result-label">{label}</div>
            <div className={`result-value ${cls}`}>{value}</div>
        </div>
    );
}

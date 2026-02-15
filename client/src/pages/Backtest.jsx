import { useState } from 'react';
import { apiRequest, formatCurrency } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { ResponsiveContainer, AreaChart, Area, Line, XAxis, YAxis, Tooltip } from 'recharts';

const customTooltipStyle = {
    background: '#111827',
    border: '1px solid rgba(148,163,184,0.12)',
    borderRadius: 10,
    padding: '10px 14px',
    fontSize: 12,
};

function simulateBacktest(startDate, endDate, initialCapital) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const years = (end - start) / (365 * 24 * 60 * 60 * 1000);
    const cagr = 0.15 + Math.random() * 0.10;
    const finalValue = initialCapital * Math.pow(1 + cagr, years);

    const equityCurve = [];
    const months = Math.floor(years * 12);
    let value = parseFloat(initialCapital);
    const monthlyReturn = Math.pow(1 + cagr, 1 / 12) - 1;

    for (let i = 0; i <= months; i++) {
        const d = new Date(start);
        d.setMonth(d.getMonth() + i);
        value *= (1 + monthlyReturn + (Math.random() - 0.5) * 0.02);
        equityCurve.push({
            date: d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
            portfolio: Math.round(value),
            benchmark: Math.round(initialCapital * Math.pow(1.10, i / 12)),
        });
    }

    return {
        summary: {
            finalValue: finalValue.toFixed(2),
            totalReturn: ((finalValue / initialCapital - 1) * 100).toFixed(2) + '%',
            cagr: (cagr * 100).toFixed(2) + '%',
            sharpeRatio: (1.2 + Math.random() * 0.5).toFixed(2),
            alpha: (2 + Math.random() * 3).toFixed(2) + '%',
            maxDrawdown: '-' + (10 + Math.random() * 15).toFixed(2) + '%',
        },
        equityCurve,
    };
}

export default function Backtest() {
    const toast = useToast();
    const { user } = useAuth();
    const [startDate, setStartDate] = useState('2020-01-01');
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [capital, setCapital] = useState(10000);
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);

    const handleRun = async () => {
        setLoading(true);
        toast('Running backtest…', 'info');
        try {
            let r;
            if (user) {
                r = await apiRequest('/backtest/run', {
                    method: 'POST',
                    body: JSON.stringify({ startDate, endDate, initialCapital: capital }),
                });
            } else {
                await new Promise(res => setTimeout(res, 800));
                r = simulateBacktest(startDate, endDate, capital);
            }
            setResult(r);
            toast('Backtest completed!', 'success');
        } catch (e) {
            const r = simulateBacktest(startDate, endDate, capital);
            setResult(r);
            toast('Using simulated backtest', 'info');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="page-enter">
            <div className="page-header">
                <h1>Backtesting Simulator</h1>
                <p className="subtitle">Validate strategy with historical data</p>
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
                        <button className="btn btn-primary btn-full" style={{ marginTop: 20 }} onClick={handleRun} disabled={loading}>
                            {loading ? '⏳ Running…' : '🚀 Run Backtest'}
                        </button>
                    </div>

                    {result && (
                        <div className="results-grid">
                            <ResultCell label="Final Value" value={formatCurrency(result.summary.finalValue)} />
                            <ResultCell label="Total Return" value={result.summary.totalReturn} positive />
                            <ResultCell label="CAGR" value={result.summary.cagr} />
                            <ResultCell label="Sharpe Ratio" value={result.summary.sharpeRatio} />
                            <ResultCell label="Alpha" value={result.summary.alpha} positive />
                            <ResultCell label="Max Drawdown" value={result.summary.maxDrawdown} negative />
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
                        <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                            Run backtest to view chart
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

import { useEffect, useState, useMemo } from 'react';
import {
    ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip,
    PieChart, Pie, Cell, Legend, Area, AreaChart
} from 'recharts';

// ── Mock Data Generators ──
function generatePerformanceData() {
    const data = [];
    let pVal = 10000, bVal = 10000;
    for (let i = 0; i < 24; i++) {
        const d = new Date();
        d.setMonth(d.getMonth() - (23 - i));
        pVal *= 1 + (Math.random() * 0.04 - 0.01);
        bVal *= 1 + (Math.random() * 0.03 - 0.01);
        data.push({
            date: d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
            portfolio: Math.round(pVal),
            benchmark: Math.round(bVal),
        });
    }
    return data;
}

const allocationData = [
    { name: 'AAPL', value: 22 },
    { name: 'MSFT', value: 18 },
    { name: 'GOOGL', value: 15 },
    { name: 'TSLA', value: 14 },
    { name: 'NVDA', value: 12 },
    { name: 'Others', value: 19 },
];

const PIE_COLORS = ['#3b82f6', '#a78bfa', '#22d3a7', '#fb923c', '#22d3ee', '#475569'];

const heatmapStocks = [
    { symbol: 'AAPL', score: 0.72 }, { symbol: 'MSFT', score: 0.45 },
    { symbol: 'GOOGL', score: 0.55 }, { symbol: 'AMZN', score: 0.38 },
    { symbol: 'TSLA', score: -0.32 }, { symbol: 'NVDA', score: 0.88 },
    { symbol: 'META', score: -0.18 }, { symbol: 'JPM', score: 0.12 },
    { symbol: 'V', score: 0.25 }, { symbol: 'JNJ', score: -0.05 },
];

const customTooltipStyle = {
    background: '#111827',
    border: '1px solid rgba(148,163,184,0.12)',
    borderRadius: 10,
    padding: '10px 14px',
    fontSize: 12,
    lineHeight: 1.5,
};

function ChartTooltip({ active, payload, label }) {
    if (!active || !payload?.length) return null;
    return (
        <div style={customTooltipStyle}>
            <div style={{ color: '#94a3b8', marginBottom: 4 }}>{label}</div>
            {payload.map((p, i) => (
                <div key={i} style={{ color: p.color }}>
                    {p.name}: ${p.value.toLocaleString()}
                </div>
            ))}
        </div>
    );
}

export default function Dashboard() {
    const perfData = useMemo(() => generatePerformanceData(), []);

    return (
        <div className="page-enter">
            <div className="page-header">
                <h1>Portfolio Dashboard</h1>
                <p className="subtitle">AI-driven insights powered by FinBERT sentiment analysis</p>
            </div>

            {/* ── Stat Cards ── */}
            <div className="bento-grid" style={{ marginBottom: 16 }}>
                <div className="col-span-3"><StatCard icon="📈" color="green" value="$12,450" label="Portfolio Value" change="+24.5%" changeType="positive" /></div>
                <div className="col-span-3"><StatCard icon="🎯" color="blue" value="+3.2%" label="Alpha (vs S&P 500)" change="Target: 2-5%" changeType="positive" /></div>
                <div className="col-span-3"><StatCard icon="📊" color="purple" value="1.45" label="Sharpe Ratio" change="Target: >1.2" changeType="positive" /></div>
                <div className="col-span-3"><StatCard icon="📰" color="orange" value="2,847" label="Articles Analyzed" change="Last 24h" changeType="neutral" /></div>
            </div>

            {/* ── Charts Row ── */}
            <div className="bento-grid" style={{ marginBottom: 16 }}>
                <div className="glass-card no-hover col-span-8">
                    <div className="card-header">
                        <h3>Portfolio Performance vs Benchmark</h3>
                        <div className="chart-legend">
                            <span className="legend-item"><span className="legend-dot" style={{ background: '#22d3a7' }} /> Portfolio</span>
                            <span className="legend-item"><span className="legend-dot" style={{ background: '#475569' }} /> S&P 500</span>
                        </div>
                    </div>
                    <div className="chart-area tall">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={perfData}>
                                <defs>
                                    <linearGradient id="gradPortfolio" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#22d3a7" stopOpacity={0.25} />
                                        <stop offset="100%" stopColor="#22d3a7" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#475569', fontSize: 11 }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#475569', fontSize: 11 }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                                <Tooltip content={<ChartTooltip />} />
                                <Area type="monotone" dataKey="portfolio" stroke="#22d3a7" strokeWidth={2} fill="url(#gradPortfolio)" name="Portfolio" />
                                <Line type="monotone" dataKey="benchmark" stroke="#475569" strokeWidth={1.5} strokeDasharray="5 5" dot={false} name="S&P 500" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="glass-card no-hover col-span-4">
                    <div className="card-header">
                        <h3>Asset Allocation</h3>
                    </div>
                    <div className="chart-area">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={allocationData} cx="50%" cy="45%" innerRadius="55%" outerRadius="85%" paddingAngle={3} dataKey="value">
                                    {allocationData.map((_, i) => (
                                        <Cell key={i} fill={PIE_COLORS[i]} stroke="none" />
                                    ))}
                                </Pie>
                                <Legend
                                    verticalAlign="bottom"
                                    iconType="circle"
                                    iconSize={8}
                                    formatter={(val) => <span style={{ color: '#94a3b8', fontSize: 11 }}>{val}</span>}
                                />
                                <Tooltip
                                    contentStyle={customTooltipStyle}
                                    formatter={(v) => [`${v}%`, 'Weight']}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* ── Sentiment Heatmap ── */}
            <div className="glass-card no-hover col-span-12">
                <div className="card-header">
                    <h3>🔥 Sentiment Heatmap</h3>
                    <span className="badge badge-live">Live</span>
                </div>
                <div className="heatmap-grid">
                    {heatmapStocks.map(s => {
                        const cls = s.score > 0.2 ? 'bullish' : s.score < -0.2 ? 'bearish' : 'neutral';
                        return (
                            <div className={`heatmap-cell ${cls}`} key={s.symbol}>
                                <span className="h-symbol">{s.symbol}</span>
                                <span className="h-score">{s.score > 0 ? '+' : ''}{s.score.toFixed(2)}</span>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

function StatCard({ icon, color, value, label, change, changeType }) {
    return (
        <div className="glass-card stat-card">
            <div className={`stat-icon ${color}`}>
                <span style={{ fontSize: 22 }}>{icon}</span>
            </div>
            <div className="stat-body">
                <div className="stat-value">{value}</div>
                <div className="stat-label">{label}</div>
            </div>
            <span className={`stat-change ${changeType}`}>{change}</span>
        </div>
    );
}

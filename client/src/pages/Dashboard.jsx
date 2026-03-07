import { useEffect, useState, useMemo, useRef } from 'react';
import {
    ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip,
    PieChart, Pie, Cell, Legend, Area, AreaChart, Sector
} from 'recharts';
import { Link } from 'react-router-dom';
import SpotlightCard from '../components/ReactBits/SpotlightCard';
import { ParticleCard, GlobalSpotlight, BentoCardGrid, useMobileDetection } from '../components/ReactBits/MagicBento';
import { apiRequest, formatCurrency } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { SkeletonStatCard, SkeletonChartCard } from '../components/Skeleton';

const PIE_COLORS = ['#3b82f6', '#a78bfa', '#22d3a7', '#fb923c', '#22d3ee', '#475569', '#f43f5e', '#facc15', '#06b6d4', '#8b5cf6'];

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
                <div key={i} style={{ color: p.color || p.payload?.fill }}>
                    {p.name}: ${p.value?.toLocaleString()}
                </div>
            ))}
        </div>
    );
}

const renderActiveShape = (props) => {
    const {
        cx, cy, innerRadius, outerRadius, startAngle, endAngle,
        fill, payload, value
    } = props;

    return (
        <g>
            <text x={cx} y={cy} dy={-8} textAnchor="middle" fill={fill} fontSize={18} fontWeight={700}>
                {payload.name}
            </text>
            <text x={cx} y={cy} dy={20} textAnchor="middle" fill="#94a3b8" fontSize={14}>
                {value}%
            </text>
            <Sector
                cx={cx} cy={cy}
                innerRadius={innerRadius}
                outerRadius={outerRadius + 8}
                startAngle={startAngle}
                endAngle={endAngle}
                fill={fill}
            />
            <Sector
                cx={cx} cy={cy}
                startAngle={startAngle}
                endAngle={endAngle}
                innerRadius={outerRadius + 12}
                outerRadius={outerRadius + 15}
                fill={fill}
            />
        </g>
    );
};

export default function Dashboard() {
    const { user } = useAuth();
    const [data, setData] = useState(null); // null = loading
    const [error, setError] = useState(null);
    const [activeIndex, setActiveIndex] = useState(0);
    const heatmapGridRef = useRef(null);
    const isMobile = useMobileDetection();

    useEffect(() => {
        if (!user) {
            setData(null);
            setError(null);
            return;
        }
        setData(null);
        apiRequest('/portfolio/dashboard')
            .then(d => setData(d))
            .catch(err => {
                console.error('Dashboard fetch error:', err);
                setError(err.message);
                setData({ stats: { totalValue: 0, totalReturn: '0', sharpeRatio: '0', articlesAnalyzed: 0, holdingsCount: 0 }, allocation: [], heatmap: [], perfHistory: [], hasPortfolio: false });
            });
    }, [user]);

    const onPieEnter = (_, index) => setActiveIndex(index);

    // Not logged in
    if (!user) {
        return (
            <div className="page-enter">
                <div className="page-header">
                    <h1>Portfolio Dashboard</h1>
                    <p className="subtitle">AI-driven insights powered by FinBERT sentiment analysis</p>
                </div>
                <div className="glass-card no-hover" style={{ textAlign: 'center', padding: 48 }}>
                    <p style={{ fontSize: 18, marginBottom: 16 }}>🔑 Please log in to view your dashboard</p>
                    <p style={{ color: 'var(--text-muted)' }}>Sign up to create your sentiment-driven portfolio</p>
                </div>
            </div>
        );
    }

    // Loading
    if (data === null) {
        return (
            <div className="page-enter">
                <div className="page-header">
                    <h1>Portfolio Dashboard</h1>
                    <p className="subtitle">AI-driven insights powered by FinBERT sentiment analysis</p>
                </div>
                <div className="bento-grid" style={{ marginBottom: 16 }}>
                    <div className="col-span-3"><SkeletonStatCard /></div>
                    <div className="col-span-3"><SkeletonStatCard /></div>
                    <div className="col-span-3"><SkeletonStatCard /></div>
                    <div className="col-span-3"><SkeletonStatCard /></div>
                </div>
                <div className="bento-grid">
                    <div className="col-span-8"><SkeletonChartCard height={280} /></div>
                    <div className="col-span-4"><SkeletonChartCard height={280} /></div>
                </div>
            </div>
        );
    }

    const { stats, allocation, heatmap, perfHistory, hasPortfolio } = data;

    return (
        <div className="page-enter">
            <div className="page-header">
                <h1>Portfolio Dashboard</h1>
                <p className="subtitle">AI-driven insights powered by FinBERT sentiment analysis</p>
            </div>

            {/* ── Stat Cards ── */}
            <div className="bento-grid" style={{ marginBottom: 16 }}>
                <div className="col-span-3">
                    <StatCard icon="📈" color="green"
                        value={hasPortfolio ? formatCurrency(stats.totalValue) : '—'}
                        label="Portfolio Value"
                        change={hasPortfolio ? `${stats.holdingsCount} holdings` : 'No portfolio'}
                        changeType={hasPortfolio ? 'positive' : 'neutral'} />
                </div>
                <div className="col-span-3">
                    <StatCard icon="🎯" color="blue"
                        value={hasPortfolio ? `${stats.totalReturn > 0 ? '+' : ''}${stats.totalReturn}%` : '—'}
                        label="Total Return"
                        change="vs $10k initial"
                        changeType={parseFloat(stats.totalReturn) > 0 ? 'positive' : parseFloat(stats.totalReturn) < 0 ? 'negative' : 'neutral'} />
                </div>
                <div className="col-span-3">
                    <StatCard icon="📊" color="purple"
                        value={hasPortfolio ? stats.sharpeRatio : '—'}
                        label="Sharpe Ratio"
                        change="Target: >1.2"
                        changeType={parseFloat(stats.sharpeRatio) > 1.2 ? 'positive' : 'neutral'} />
                </div>
                <div className="col-span-3">
                    <StatCard icon="📰" color="orange"
                        value={stats.articlesAnalyzed.toLocaleString()}
                        label="Articles Analyzed"
                        change="All time"
                        changeType="neutral" />
                </div>
            </div>

            {/* ── Charts Row ── */}
            <div className="bento-grid" style={{ marginBottom: 16 }}>
                <div className="glass-card no-hover col-span-8">
                    <div className="card-header">
                        <h3>Portfolio Performance</h3>
                        {!hasPortfolio && <span className="badge" style={{ background: 'var(--accent-orange-dim)', color: 'var(--accent-orange)' }}>No Data</span>}
                    </div>
                    <div className="chart-area tall">
                        {perfHistory.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={perfHistory}>
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
                                </AreaChart>
                            </ResponsiveContainer>
                        ) : (
                            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                                Initialize your portfolio to see performance data
                            </div>
                        )}
                    </div>
                </div>

                <div className="glass-card no-hover col-span-4">
                    <div className="card-header">
                        <h3>Asset Allocation</h3>
                    </div>
                    <div className="chart-area" style={{ position: 'relative' }}>
                        {allocation.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        activeIndex={activeIndex}
                                        activeShape={renderActiveShape}
                                        data={allocation}
                                        cx="50%"
                                        cy="45%"
                                        innerRadius="55%"
                                        outerRadius="80%"
                                        paddingAngle={3}
                                        dataKey="value"
                                        onMouseEnter={onPieEnter}
                                    >
                                        {allocation.map((_, i) => (
                                            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="none" style={{ outline: 'none' }} />
                                        ))}
                                    </Pie>
                                    <Legend
                                        verticalAlign="bottom"
                                        iconType="circle"
                                        iconSize={8}
                                        formatter={(val) => <span style={{ color: '#94a3b8', fontSize: 11 }}>{val}</span>}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', flexDirection: 'column', gap: 8 }}>
                                <span>No holdings yet</span>
                                <Link to="/portfolio" className="btn btn-primary" style={{ fontSize: 12 }}>Initialize Portfolio</Link>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Sentiment Heatmap (MagicBento) ── */}
            <div className="glass-card no-hover col-span-12">
                <div className="card-header">
                    <h3>🔥 Sentiment Heatmap</h3>
                    <span className="badge badge-live">Live</span>
                </div>
                <GlobalSpotlight
                    gridRef={heatmapGridRef}
                    disableAnimations={isMobile}
                    enabled={heatmap.length > 0}
                    spotlightRadius={400}
                    glowColor="34, 211, 167"
                />
                <BentoCardGrid gridRef={heatmapGridRef}>
                    {heatmap.length > 0 ? heatmap.map(s => {
                        const cls = s.score > 0.2 ? 'bullish' : s.score < -0.2 ? 'bearish' : 'neutral';
                        const glowColor = s.score > 0.2 ? '34, 211, 167' : s.score < -0.2 ? '244, 63, 94' : '100, 116, 139';
                        return (
                            <ParticleCard
                                key={s.symbol}
                                className={`magic-bento-card magic-bento-card--border-glow`}
                                disableAnimations={isMobile}
                                particleCount={8}
                                glowColor={glowColor}
                                clickEffect
                                style={{ '--glow-color': glowColor, cursor: 'pointer' }}
                            >
                                <Link to={`/stock/${s.symbol}`} style={{ textDecoration: 'none', color: 'inherit', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%' }}>
                                    <div className="magic-bento-card__header">
                                        <div className="magic-bento-card__label">{cls === 'bullish' ? '📈' : cls === 'bearish' ? '📉' : '➡️'}</div>
                                    </div>
                                    <div className="magic-bento-card__content">
                                        <h2 className="magic-bento-card__title">{s.symbol}</h2>
                                        <p className={`magic-bento-card__description`} style={{ color: s.score > 0 ? '#22d3a7' : s.score < 0 ? '#f43f5e' : '#94a3b8', fontWeight: 700, fontSize: 16 }}>
                                            {s.score > 0 ? '+' : ''}{s.score.toFixed(3)}
                                        </p>
                                    </div>
                                </Link>
                            </ParticleCard>
                        );
                    }) : (
                        <div style={{ padding: 32, color: 'var(--text-muted)', textAlign: 'center', gridColumn: '1 / -1' }}>
                            No sentiment data yet — run a scrape from the News page
                        </div>
                    )}
                </BentoCardGrid>
            </div>
        </div>
    );
}

function StatCard({ icon, color, value, label, change, changeType }) {
    return (
        <SpotlightCard className="h-full" spotlightColor="rgba(255, 255, 255, 0.1)">
            <div className="glass-card stat-card border-none bg-transparent">
                <div className={`stat-icon ${color}`}>
                    <span style={{ fontSize: 22 }}>{icon}</span>
                </div>
                <div className="stat-body">
                    <div className="stat-value">{value}</div>
                    <div className="stat-label">{label}</div>
                </div>
                <span className={`stat-change ${changeType}`}>{change}</span>
            </div>
        </SpotlightCard>
    );
}

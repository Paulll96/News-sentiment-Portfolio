import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X } from 'lucide-react';
import { apiRequest } from '../utils/api';

/**
 * SearchBar — Ctrl+K command palette for quick stock navigation
 * Fetches stocks from /api/stocks and lets users filter + navigate
 */
export default function SearchBar() {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [stocks, setStocks] = useState([]);
    const [sentimentBySymbol, setSentimentBySymbol] = useState({});
    const [filtered, setFiltered] = useState([]);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const sentimentRequestedRef = useRef(new Set());
    const inputRef = useRef(null);
    const navigate = useNavigate();

    // Ctrl+K to open
    useEffect(() => {
        const handler = (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setOpen(prev => !prev);
            }
            if (e.key === 'Escape') setOpen(false);
        };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, []);

    // Focus input when opened
    useEffect(() => {
        if (open) {
            inputRef.current?.focus();
            if (stocks.length === 0) {
                apiRequest('/stocks')
                    .then(data => setStocks(data.stocks || []))
                    .catch(() => { });
            }

            // Warm up with aggregated sentiment payload (may be limited by tier).
            if (Object.keys(sentimentBySymbol).length === 0) {
                apiRequest('/sentiment?days=7')
                    .then((data) => {
                        const sentiments = data?.sentiments || [];
                        const map = {};
                        sentiments.forEach((s) => {
                            if (!s?.symbol) return;
                            map[s.symbol] = {
                                signal: s.signal || 'neutral',
                                wss: typeof s.wss === 'number' ? s.wss : null,
                            };
                        });
                        if (Object.keys(map).length > 0) {
                            setSentimentBySymbol(prev => ({ ...prev, ...map }));
                        }
                    })
                    .catch(() => { });
            }
        } else {
            setQuery('');
            setSelectedIndex(0);
        }
    }, [open, stocks.length, sentimentBySymbol]);

    // Filter on query change
    useEffect(() => {
        if (!query.trim()) {
            setFiltered(stocks.slice(0, 10));
        } else {
            const q = query.toLowerCase();
            setFiltered(
                stocks
                    .filter(s =>
                        s.symbol.toLowerCase().includes(q) ||
                        s.name.toLowerCase().includes(q) ||
                        (s.sector || '').toLowerCase().includes(q)
                    )
                    .slice(0, 8)
            );
        }
        setSelectedIndex(0);
    }, [query, stocks]);

    // Backfill missing sentiment for visible results so each row can show current status.
    useEffect(() => {
        if (!open || filtered.length === 0) return;

        const missingSymbols = filtered
            .map(s => s.symbol)
            .filter(symbol => symbol && !sentimentBySymbol[symbol] && !sentimentRequestedRef.current.has(symbol));

        if (missingSymbols.length === 0) return;

        missingSymbols.forEach(symbol => sentimentRequestedRef.current.add(symbol));

        Promise.allSettled(
            missingSymbols.map(symbol => apiRequest(`/sentiment/${symbol}?days=7`))
        ).then((results) => {
            const updates = {};

            results.forEach((result, idx) => {
                const symbol = missingSymbols[idx];
                if (!symbol) return;

                if (result.status === 'fulfilled') {
                    const payload = result.value || {};
                    updates[symbol] = {
                        signal: payload.signal || 'neutral',
                        wss: typeof payload.wss === 'number' ? payload.wss : null,
                    };
                    return;
                }

                updates[symbol] = {
                    signal: 'neutral',
                    wss: null,
                };
            });

            if (Object.keys(updates).length > 0) {
                setSentimentBySymbol(prev => ({ ...prev, ...updates }));
            }
        });
    }, [open, filtered, sentimentBySymbol]);

    const getSignalBadge = (symbol) => {
        const meta = sentimentBySymbol[symbol] || { signal: 'neutral', wss: null };
        const signal = meta.signal || 'neutral';

        const signalColor = {
            bullish: 'var(--accent-green)',
            bearish: 'var(--accent-red)',
            neutral: 'var(--text-secondary)',
        };

        const signalBg = {
            bullish: 'var(--accent-green-dim)',
            bearish: 'var(--accent-red-dim)',
            neutral: 'rgba(148,163,184,0.12)',
        };

        return {
            signal,
            wss: meta.wss,
            color: signalColor[signal] || signalColor.neutral,
            background: signalBg[signal] || signalBg.neutral,
            icon: signal === 'bullish' ? '▲' : signal === 'bearish' ? '▼' : '●',
        };
    };

    const renderTrendLine = (signal) => {
        const trendColor = {
            bullish: 'var(--accent-green)',
            bearish: 'var(--accent-red)',
            neutral: 'var(--text-secondary)',
        };

        const trendPath = {
            bullish: 'M2 14 L10 12 L18 9 L26 6 L34 3',
            bearish: 'M2 3 L10 5 L18 8 L26 11 L34 14',
            neutral: 'M2 9 L10 8 L18 9 L26 8 L34 9',
        };

        const color = trendColor[signal] || trendColor.neutral;
        const path = trendPath[signal] || trendPath.neutral;

        return (
            <svg width="36" height="18" viewBox="0 0 36 18" role="img" aria-label={`${signal} trend`}>
                <path
                    d={path}
                    fill="none"
                    stroke={color}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray="48"
                    strokeDashoffset="48"
                >
                    <animate
                        attributeName="stroke-dashoffset"
                        values="48;0;0"
                        keyTimes="0;0.6;1"
                        dur="1.6s"
                        repeatCount="indefinite"
                    />
                </path>
            </svg>
        );
    };

    const handleSelect = (stock) => {
        navigate(`/stock/${stock.symbol}`);
        setOpen(false);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(prev => Math.min(prev + 1, filtered.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(prev => Math.max(prev - 1, 0));
        } else if (e.key === 'Enter' && filtered[selectedIndex]) {
            handleSelect(filtered[selectedIndex]);
        }
    };

    if (!open) {
        return (
            <button
                onClick={() => setOpen(true)}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '6px 14px',
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 8,
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    fontSize: 12,
                    transition: 'all 0.2s',
                }}
                title="Search stocks (Ctrl+K)"
            >
                <Search size={14} />
                <span className="desktop-only">Search stocks…</span>
                <kbd style={{
                    fontSize: 10,
                    padding: '1px 5px',
                    borderRadius: 4,
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-dim)',
                    marginLeft: 4,
                }} className="desktop-only">⌘K</kbd>
            </button>
        );
    }

    return (
        <>
            {/* Backdrop */}
            <div
                onClick={() => setOpen(false)}
                style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(0,0,0,0.6)',
                    backdropFilter: 'blur(4px)',
                    zIndex: 999,
                }}
            />

            {/* Modal */}
            <div style={{
                position: 'fixed',
                top: '20%',
                left: '50%',
                transform: 'translateX(-50%)',
                width: '100%',
                maxWidth: 480,
                zIndex: 1000,
                animation: 'slide-up 0.2s ease',
            }}>
                <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
                    {/* Input */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '14px 16px',
                        borderBottom: '1px solid var(--border-color)',
                    }}>
                        <Search size={18} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                        <input
                            ref={inputRef}
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Search stocks by symbol, name, or sector…"
                            style={{
                                flex: 1,
                                background: 'transparent',
                                border: 'none',
                                outline: 'none',
                                color: 'var(--text-primary)',
                                fontSize: 14,
                            }}
                        />
                        <button
                            onClick={() => setOpen(false)}
                            style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--text-muted)',
                                cursor: 'pointer',
                                padding: 4,
                                display: 'flex',
                            }}
                        >
                            <X size={16} />
                        </button>
                    </div>

                    {/* Results */}
                    <div style={{ maxHeight: 340, overflowY: 'auto' }}>
                        {filtered.length === 0 ? (
                            <div style={{
                                padding: 32,
                                textAlign: 'center',
                                color: 'var(--text-muted)',
                                fontSize: 13,
                            }}>
                                {query ? 'No matching stocks found' : 'Loading stocks…'}
                            </div>
                        ) : (
                            filtered.map((stock, i) => (
                                (() => {
                                    const badge = getSignalBadge(stock.symbol);
                                    return (
                                <div
                                    key={stock.id || stock.symbol}
                                    onClick={() => handleSelect(stock)}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        padding: '10px 16px',
                                        cursor: 'pointer',
                                        background: i === selectedIndex ? 'rgba(59,130,246,0.08)' : 'transparent',
                                        borderBottom: '1px solid var(--border-color)',
                                        transition: 'background 0.15s',
                                    }}
                                    onMouseEnter={() => setSelectedIndex(i)}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                        <span style={{
                                            fontWeight: 700,
                                            fontSize: 13,
                                            color: i === selectedIndex ? 'var(--accent-blue)' : 'var(--text-primary)',
                                            minWidth: 50,
                                        }}>
                                            {stock.symbol}
                                        </span>
                                        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                                            {stock.name}
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <span style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            width: 42,
                                            height: 20,
                                            borderRadius: 6,
                                            background: 'rgba(255,255,255,0.03)',
                                            border: '1px solid var(--border-color)',
                                        }}>
                                            {renderTrendLine(badge.signal)}
                                        </span>

                                        <span style={{
                                            fontSize: 10,
                                            padding: '2px 8px',
                                            borderRadius: 4,
                                            background: 'rgba(255,255,255,0.04)',
                                            color: 'var(--text-dim)',
                                        }}>
                                            {stock.sector}
                                        </span>

                                        <span style={{
                                            fontSize: 10,
                                            fontWeight: 700,
                                            textTransform: 'capitalize',
                                            padding: '2px 8px',
                                            borderRadius: 9999,
                                            background: badge.background,
                                            color: badge.color,
                                        }}>
                                            {badge.icon} {badge.signal}
                                        </span>

                                        <span style={{
                                            fontSize: 10,
                                            padding: '2px 6px',
                                            borderRadius: 4,
                                            background: 'rgba(255,255,255,0.04)',
                                            color: 'var(--text-dim)',
                                            minWidth: 44,
                                            textAlign: 'center',
                                        }}>
                                            {typeof badge.wss === 'number'
                                                ? `${badge.wss > 0 ? '+' : ''}${(badge.wss * 100).toFixed(1)}%`
                                                : '--'}
                                        </span>
                                    </div>
                                </div>
                                    );
                                })()
                            ))
                        )}
                    </div>

                    {/* Footer Hint */}
                    <div style={{
                        padding: '8px 16px',
                        borderTop: '1px solid var(--border-color)',
                        display: 'flex',
                        gap: 16,
                        fontSize: 10,
                        color: 'var(--text-dim)',
                    }}>
                        <span>↑↓ Navigate</span>
                        <span>↵ Select</span>
                        <span>ESC Close</span>
                    </div>
                </div>
            </div>
        </>
    );
}

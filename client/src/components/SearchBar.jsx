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
    const [filtered, setFiltered] = useState([]);
    const [selectedIndex, setSelectedIndex] = useState(0);
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
        } else {
            setQuery('');
            setSelectedIndex(0);
        }
    }, [open]);

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
                                    <span style={{
                                        fontSize: 10,
                                        padding: '2px 8px',
                                        borderRadius: 4,
                                        background: 'rgba(255,255,255,0.04)',
                                        color: 'var(--text-dim)',
                                    }}>
                                        {stock.sector}
                                    </span>
                                </div>
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

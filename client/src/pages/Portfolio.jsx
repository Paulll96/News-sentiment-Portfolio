import { useState, useEffect } from 'react';
import { apiRequest, formatCurrency } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { SkeletonTableRow } from '../components/Skeleton';
import { exportPortfolio } from '../utils/export';

function parseCsvLine(line) {
    const cells = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        const next = line[i + 1];

        if (ch === '"') {
            if (inQuotes && next === '"') {
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
            continue;
        }

        if (ch === ',' && !inQuotes) {
            cells.push(current.trim());
            current = '';
            continue;
        }

        current += ch;
    }

    cells.push(current.trim());
    return cells;
}

function parseHoldingsCsv(text) {
    const lines = String(text || '')
        .replace(/^\uFEFF/, '')
        .split(/\r?\n/)
        .map(l => l.trim())
        .filter(Boolean);

    if (lines.length < 2) {
        return [];
    }

    const headers = parseCsvLine(lines[0]).map(h => h.trim().toLowerCase());

    const findHeader = (aliases) => headers.findIndex(h => aliases.includes(h.replace(/\s+/g, '_')) || aliases.includes(h));

    const symbolIdx = findHeader(['symbol', 'ticker', 'stock', 'security']);
    const sharesIdx = findHeader(['shares', 'qty', 'quantity']);
    const avgCostIdx = findHeader(['avg_cost', 'avgcost', 'average_price', 'buy_price', 'price', 'cost']);
    const exchangeIdx = findHeader(['exchange']);

    if (symbolIdx < 0 || sharesIdx < 0) {
        return [];
    }

    const rows = [];

    for (let i = 1; i < lines.length; i++) {
        const cols = parseCsvLine(lines[i]);

        const symbol = cols[symbolIdx];
        const sharesRaw = cols[sharesIdx];
        const avgCostRaw = avgCostIdx >= 0 ? cols[avgCostIdx] : '';
        const exchangeRaw = exchangeIdx >= 0 ? cols[exchangeIdx] : '';

        if (!symbol || !sharesRaw) continue;

        rows.push({
            symbol: String(symbol).trim().toUpperCase(),
            shares: Number(sharesRaw),
            avgCost: avgCostRaw !== '' ? Number(avgCostRaw) : undefined,
            exchange: exchangeRaw ? String(exchangeRaw).trim().toUpperCase() : 'NSE',
        });
    }

    return rows;
}

export default function Portfolio() {
    const { user } = useAuth();
    const toast = useToast();
    const [holdings, setHoldings] = useState(null); // null = loading
    const [trades, setTrades] = useState([]);
    const [loading, setLoading] = useState(false);

    const [portfolioCurrency, setPortfolioCurrency] = useState('INR');

    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const [selectedStock, setSelectedStock] = useState(null);
    const [addShares, setAddShares] = useState('');
    const [addAvgCost, setAddAvgCost] = useState('');

    const [importOpen, setImportOpen] = useState(false);
    const [importRows, setImportRows] = useState([]);
    const [importPreview, setImportPreview] = useState(null);
    const [importLoading, setImportLoading] = useState(false);

    const currencyLocale = portfolioCurrency === 'INR' ? 'en-IN' : 'en-US';

    const loadPortfolio = async () => {
        if (!user) {
            setHoldings([]);
            return;
        }

        try {
            const data = await apiRequest('/portfolio');
            setHoldings(data.holdings || []);
            setPortfolioCurrency(data.currency || data.summary?.currency || 'INR');
        } catch (err) {
            toast(err.message || 'Failed to load portfolio', 'error');
            setHoldings([]);
        }
    };

    useEffect(() => {
        loadPortfolio();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user]);

    useEffect(() => {
        if (!searchQuery.trim()) {
            setSearchResults([]);
            return;
        }

        const timer = setTimeout(async () => {
            try {
                setSearchLoading(true);
                const data = await apiRequest(`/stocks/search?q=${encodeURIComponent(searchQuery)}&exchange=NSE&limit=8`);
                setSearchResults(data.results || []);
            } catch {
                setSearchResults([]);
            } finally {
                setSearchLoading(false);
            }
        }, 250);

        return () => clearTimeout(timer);
    }, [searchQuery]);

    const handleInit = async () => {
        if (!user) {
            toast('Please login first', 'error');
            return;
        }

        try {
            setLoading(true);
            await apiRequest('/portfolio/initialize', { method: 'POST' });
            toast('Demo portfolio initialized', 'success');
            await loadPortfolio();
        } catch (e) {
            toast(e.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleRebalance = async () => {
        if (!user) {
            toast('Please login first', 'error');
            return;
        }

        try {
            setLoading(true);
            const data = await apiRequest('/portfolio/rebalance', {
                method: 'POST',
                body: JSON.stringify({ dryRun: true }),
            });
            setTrades(data.trades || []);
            toast('Rebalance preview generated', 'success');
        } catch (e) {
            toast(e.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleExecuteRebalance = async () => {
        if (!user) {
            toast('Please login first', 'error');
            return;
        }
        if (trades.length === 0) {
            toast('Run a preview first', 'info');
            return;
        }

        try {
            setLoading(true);
            await apiRequest('/portfolio/rebalance', {
                method: 'POST',
                body: JSON.stringify({ dryRun: false }),
            });
            toast('Rebalance executed', 'success');
            setTrades([]);
            await loadPortfolio();
        } catch (e) {
            toast(e.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleAddHolding = async () => {
        if (!user) {
            toast('Please login first', 'error');
            return;
        }

        if (!selectedStock) {
            toast('Select a stock from search results', 'error');
            return;
        }

        const shares = Number(addShares);
        if (!Number.isInteger(shares) || shares <= 0) {
            toast('Shares must be a positive whole number', 'error');
            return;
        }

        const avgCost = addAvgCost !== '' ? Number(addAvgCost) : undefined;
        if (avgCost !== undefined && (!Number.isFinite(avgCost) || avgCost <= 0)) {
            toast('Avg cost must be a positive number', 'error');
            return;
        }

        try {
            setLoading(true);
            await apiRequest('/portfolio/holdings', {
                method: 'POST',
                body: JSON.stringify({
                    symbol: selectedStock.symbol,
                    exchange: selectedStock.exchange || 'NSE',
                    shares,
                    ...(avgCost ? { avgCost } : {}),
                }),
            });

            toast(`${selectedStock.symbol} added to portfolio`, 'success');
            setSearchQuery('');
            setSearchResults([]);
            setSelectedStock(null);
            setAddShares('');
            setAddAvgCost('');
            await loadPortfolio();
        } catch (e) {
            toast(e.message || 'Failed to add holding', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleCsvFile = async (file) => {
        if (!file) return;

        try {
            const text = await file.text();
            const parsed = parseHoldingsCsv(text);
            setImportRows(parsed);
            setImportPreview(null);

            if (parsed.length === 0) {
                toast('No valid rows found. Required columns: symbol, shares', 'error');
            } else {
                toast(`${parsed.length} rows loaded`, 'success');
            }
        } catch {
            toast('Failed to read CSV file', 'error');
        }
    };

    const handleImportPreview = async () => {
        if (!user) {
            toast('Please login first', 'error');
            return;
        }

        if (importRows.length === 0) {
            toast('Upload a CSV with at least one valid row', 'error');
            return;
        }

        try {
            setImportLoading(true);
            const result = await apiRequest('/portfolio/import', {
                method: 'POST',
                body: JSON.stringify({
                    source: 'csv',
                    mode: 'replace',
                    dryRun: true,
                    holdings: importRows,
                }),
            });

            setImportPreview(result);
            toast('Import preview generated', 'success');
        } catch (e) {
            toast(e.message || 'Import preview failed', 'error');
        } finally {
            setImportLoading(false);
        }
    };

    const handleImportCommit = async () => {
        if (!importPreview) {
            toast('Run preview first', 'info');
            return;
        }

        try {
            setImportLoading(true);
            await apiRequest('/portfolio/import', {
                method: 'POST',
                body: JSON.stringify({
                    source: 'csv',
                    mode: 'replace',
                    dryRun: false,
                    holdings: importRows,
                }),
            });

            toast('Portfolio imported successfully', 'success');
            setImportOpen(false);
            setImportRows([]);
            setImportPreview(null);
            setTrades([]);
            await loadPortfolio();
        } catch (e) {
            toast(e.message || 'Import failed', 'error');
        } finally {
            setImportLoading(false);
        }
    };

    return (
        <div className="page-enter">
            <div className="page-header">
                <h1>Portfolio Management</h1>
                <p className="subtitle">Import real holdings, add NSE stocks, and rebalance with sentiment signals</p>
            </div>

            {!user ? (
                <div className="glass-card no-hover" style={{ textAlign: 'center', padding: 48 }}>
                    <p style={{ fontSize: 18, marginBottom: 16 }}>Please log in to manage your portfolio</p>
                </div>
            ) : (
                <>
                    <div className="controls-bar">
                        <button className="btn btn-secondary" onClick={() => setImportOpen(true)} disabled={loading || importLoading}>Import Holdings</button>
                        <button className="btn btn-secondary" onClick={handleRebalance} disabled={loading}>Rebalance (Preview)</button>
                        <button className="btn btn-success" onClick={handleExecuteRebalance} disabled={loading || trades.length === 0}>Execute Rebalance</button>
                        {holdings && holdings.length > 0 && (
                            <button className="btn btn-ghost" onClick={() => exportPortfolio(holdings)}>Export CSV</button>
                        )}
                        <button className="btn btn-ghost" onClick={handleInit} disabled={loading} title="Quick demo allocation">
                            Quick Demo Initialize
                        </button>
                    </div>

                    <div className="bento-grid">
                        {/* Holdings */}
                        <div className="glass-card no-hover col-span-8">
                            <div className="card-header"><h3>Current Holdings</h3></div>
                            <div className="data-table-wrap">
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>Symbol</th>
                                            <th>Name</th>
                                            <th>Shares</th>
                                            <th>Avg Cost</th>
                                            <th>Value</th>
                                            <th>Weight</th>
                                            <th>Signal</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {holdings === null ? (
                                            Array.from({ length: 5 }).map((_, i) => <SkeletonTableRow key={i} />)
                                        ) : holdings.length === 0 ? (
                                            <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>No holdings yet — import or add your first NSE stock</td></tr>
                                        ) : (
                                            holdings.map((h, i) => (
                                                <tr key={i}>
                                                    <td style={{ fontWeight: 700, color: 'var(--accent-blue)' }}>{h.symbol}</td>
                                                    <td>{h.name}</td>
                                                    <td>{parseFloat(h.shares).toFixed(0)}</td>
                                                    <td>{h.avgCost ? formatCurrency(h.avgCost, portfolioCurrency, currencyLocale) : '—'}</td>
                                                    <td>{formatCurrency(h.currentValue || h.value || 0, portfolioCurrency, currencyLocale)}</td>
                                                    <td>{(h.weight || 0).toFixed(1)}%</td>
                                                    <td><span className={`signal-badge ${h.signal || 'neutral'}`}>{h.signal || 'neutral'}</span></td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="col-span-4 portfolio-side-stack">
                            <div className="glass-card no-hover">
                                <div className="card-header"><h3>Add Indian Stock</h3></div>

                                <div className="form-group" style={{ marginBottom: 10 }}>
                                    <label>Search NSE Symbol</label>
                                    <input
                                        className="input"
                                        placeholder="Type symbol or company"
                                        value={searchQuery}
                                        onChange={(e) => {
                                            setSearchQuery(e.target.value);
                                            setSelectedStock(null);
                                        }}
                                    />
                                </div>

                                {searchLoading && <p className="empty-state" style={{ marginBottom: 10 }}>Searching...</p>}

                                {!searchLoading && searchResults.length > 0 && (
                                    <div className="portfolio-search-results">
                                        {searchResults.map((stock) => (
                                            <button
                                                key={stock.symbol}
                                                type="button"
                                                className={`portfolio-search-item ${selectedStock?.symbol === stock.symbol ? 'active' : ''}`}
                                                onClick={() => {
                                                    setSelectedStock(stock);
                                                    setSearchQuery(stock.symbol);
                                                    setSearchResults([]);
                                                }}
                                            >
                                                <span style={{ fontWeight: 700 }}>{stock.symbol}</span>
                                                <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{stock.name}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}

                                {selectedStock && (
                                    <div className="portfolio-selected-stock">
                                        Selected: <strong>{selectedStock.symbol}</strong> · {selectedStock.name}
                                    </div>
                                )}

                                <div className="form-group" style={{ marginTop: 12 }}>
                                    <label>Shares</label>
                                    <input
                                        className="input"
                                        type="number"
                                        min="1"
                                        step="1"
                                        value={addShares}
                                        onChange={(e) => setAddShares(e.target.value)}
                                        placeholder="e.g. 10"
                                    />
                                </div>

                                <div className="form-group" style={{ marginTop: 12 }}>
                                    <label>Avg Buy Price (optional)</label>
                                    <input
                                        className="input"
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={addAvgCost}
                                        onChange={(e) => setAddAvgCost(e.target.value)}
                                        placeholder="e.g. 2490.50"
                                    />
                                </div>

                                <button className="btn btn-primary" style={{ marginTop: 14, width: '100%' }} onClick={handleAddHolding} disabled={loading}>
                                    Add Holding
                                </button>
                            </div>

                            <div className="glass-card no-hover">
                                <div className="card-header"><h3>Suggested Trades</h3></div>
                                {trades.length === 0 ? (
                                    <p className="empty-state">Run rebalance preview to see suggested trades</p>
                                ) : trades.map((t, i) => (
                                    <div className="list-item" key={i} style={{ borderLeft: `3px solid ${t.type === 'buy' ? 'var(--accent-green)' : 'var(--accent-red)'}` }}>
                                        <div className="item-left">
                                            <div>
                                                <div className="item-symbol">{t.type?.toUpperCase()} {t.symbol}</div>
                                                <div className="item-name">{t.currentWeight} ? {t.targetWeight}</div>
                                            </div>
                                        </div>
                                        <div className="item-right">
                                            <div className="item-amount">{formatCurrency(t.tradeValue, portfolioCurrency, currencyLocale)}</div>
                                            <div className="item-weight">{t.signal}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </>
            )}

            {importOpen && (
                <div className="modal-overlay" onClick={() => !importLoading && setImportOpen(false)}>
                    <div className="modal-box" style={{ maxWidth: 760 }} onClick={(e) => e.stopPropagation()}>
                        <button className="modal-close" onClick={() => !importLoading && setImportOpen(false)}>×</button>
                        <h2>Import Holdings (CSV)</h2>

                        <div className="form-group">
                            <label>Upload CSV File</label>
                            <input
                                className="input"
                                type="file"
                                accept=".csv"
                                onChange={(e) => handleCsvFile(e.target.files?.[0])}
                            />
                            <p style={{ marginTop: 6, color: 'var(--text-muted)', fontSize: 12 }}>
                                Required columns: symbol, shares. Optional: avg_cost, exchange.
                            </p>
                        </div>

                        {importRows.length > 0 && (
                            <div style={{ marginTop: 14, color: 'var(--text-secondary)', fontSize: 13 }}>
                                Loaded rows: <strong>{importRows.length}</strong>
                            </div>
                        )}

                        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                            <button className="btn btn-secondary" onClick={handleImportPreview} disabled={importLoading || importRows.length === 0}>
                                {importLoading ? 'Processing...' : 'Preview Import'}
                            </button>
                            <button className="btn btn-success" onClick={handleImportCommit} disabled={importLoading || !importPreview}>
                                Confirm Replace Import
                            </button>
                        </div>

                        {importPreview && (
                            <div className="portfolio-import-preview">
                                <div className="portfolio-import-stats">
                                    <span>Accepted: <strong>{importPreview.imported}</strong></span>
                                    <span>Rejected: <strong>{importPreview.rejected}</strong></span>
                                    <span>Total: <strong>{formatCurrency(importPreview.summary?.totalValue || 0, 'INR', 'en-IN')}</strong></span>
                                </div>

                                {importPreview.rejectedRows?.length > 0 && (
                                    <div className="portfolio-import-errors">
                                        {importPreview.rejectedRows.slice(0, 6).map((row, idx) => (
                                            <div key={idx} className="portfolio-import-error-row">
                                                {row.symbol || `Row ${row.row || idx + 1}`}: {row.error}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {importPreview.accepted?.length > 0 && (
                                    <div className="data-table-wrap" style={{ marginTop: 12, maxHeight: 240 }}>
                                        <table className="data-table">
                                            <thead>
                                                <tr>
                                                    <th>Symbol</th>
                                                    <th>Shares</th>
                                                    <th>Unit Price</th>
                                                    <th>Value</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {importPreview.accepted.slice(0, 10).map((row, idx) => (
                                                    <tr key={`${row.symbol}-${idx}`}>
                                                        <td>{row.symbol}</td>
                                                        <td>{row.shares}</td>
                                                        <td>{formatCurrency(row.unitPrice || 0, 'INR', 'en-IN')}</td>
                                                        <td>{formatCurrency(row.value || 0, 'INR', 'en-IN')}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}


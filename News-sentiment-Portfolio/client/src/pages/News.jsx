import { useState, useEffect } from 'react';
import { apiRequest } from '../utils/api';
import { useToast } from '../context/ToastContext';
import { SkeletonTableRow } from '../components/Skeleton';
import StarBorder from '../components/ReactBits/StarBorder';

export default function News() {
    const [articles, setArticles] = useState(null); // null = loading
    const [source, setSource] = useState('');
    const [sources, setSources] = useState([]);
    const [showPopup, setShowPopup] = useState(false);
    const [topStocks, setTopStocks] = useState([]);
    const [analysisSource, setAnalysisSource] = useState('global');
    const toast = useToast();

    // Load articles
    useEffect(() => {
        const params = new URLSearchParams({ limit: '50' });
        if (source) params.set('source', source);

        apiRequest(`/news?${params.toString()}`)
            .then(data => setArticles(data.articles || []))
            .catch(err => {
                toast(err.message || 'Failed to load news', 'error');
                setArticles([]);
            });
    }, [source]);

    // Load sources dynamically
    useEffect(() => {
        apiRequest('/news/sources')
            .then(data => setSources(data.sources || []))
            .catch(() => { });
    }, []);

    const handleScrape = async () => {
        try {
            toast('Scraping news…', 'info');
            setArticles(null); // show loading
            await apiRequest('/news/scrape', { method: 'POST' });
            toast('News scraped!', 'success');
            const data = await apiRequest('/news?limit=50');
            setArticles(data.articles || []);
            // Reload sources too
            const srcData = await apiRequest('/news/sources');
            setSources(srcData.sources || []);
        } catch (e) {
            toast(e.message, 'error');
            setArticles([]);
        }
    };

    const handleAnalyze = async () => {
        try {
            toast('Analyzing sentiment…', 'info');

            // Run analysis (may fail if not logged in)
            try {
                const result = await apiRequest('/sentiment/analyze', { method: 'POST' });
                toast(`Analysis complete! ${result.analyzed} articles analyzed.`, 'success');
            } catch (analyzeErr) {
                // If unauthenticated, still proceed to show results
                if (analyzeErr.message?.includes('401') || analyzeErr.message?.toLowerCase().includes('auth')) {
                    toast('Please log in to run analysis. Showing existing results…', 'info');
                } else {
                    toast(analyzeErr.message || 'Analysis failed', 'error');
                }
            }

            // Fetch top Indian stocks (no auth required, with global fallback)
            const topData = await apiRequest('/sentiment/top-india');
            setTopStocks(topData.stocks || []);
            setAnalysisSource(topData.source || 'global');
            setShowPopup(true);
        } catch (e) {
            toast(e.message, 'error');
        }
    };


    return (
        <div className="page-enter">
            <div className="page-header">
                <h1>Live News Feed</h1>
                <p className="subtitle">Multi-source news with FinBERT sentiment scoring</p>
            </div>

            <div className="controls-bar">
                <div className="form-group">
                    <label>Source</label>
                    <select className="select-input" value={source} onChange={e => setSource(e.target.value)}>
                        <option value="">All Sources</option>
                        {sources.map(s => (
                            <option key={s.source} value={s.source}>
                                {s.source} ({s.count})
                            </option>
                        ))}
                    </select>
                </div>
                <button className="btn btn-secondary" onClick={handleScrape}>📥 Scrape News</button>
                <StarBorder as="button" color="#3b82f6" speed="5s" onClick={handleAnalyze} className="analyze-btn">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
                        🧠 Analyze
                    </div>
                </StarBorder>
                <style>{`
                    .analyze-btn .star-border-inner-content {
                        padding: 9px 18px !important;
                        font-size: 13px !important;
                        border-radius: var(--radius-md) !important;
                    }
                    .analyze-btn {
                        border-radius: var(--radius-md) !important;
                    }
                `}</style>
            </div>

            <div className="bento-grid">
                <div className="glass-card no-hover col-span-12">
                    {articles === null ? (
                        // Loading skeleton
                        <div className="data-table-wrap">
                            <table className="data-table">
                                <tbody>
                                    {Array.from({ length: 8 }).map((_, i) => <SkeletonTableRow key={i} />)}
                                </tbody>
                            </table>
                        </div>
                    ) : articles.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>
                            <p style={{ fontSize: 18, marginBottom: 8 }}>📰 No articles yet</p>
                            <p>Click "Scrape News" to fetch articles from all sources</p>
                        </div>
                    ) : (
                        articles.map((article, i) => {
                            const s = article.sentiment || 'neutral';
                            const icon = s === 'positive' ? '📈' : s === 'negative' ? '📉' : '📰';
                            const sentiments = article.sentiments;
                            const firstSentiment = Array.isArray(sentiments) && sentiments.length > 0 ? sentiments[0] : null;
                            const displaySentiment = firstSentiment?.sentiment || s;
                            const displaySymbol = firstSentiment?.symbol || article.symbol;
                            const displayIcon = displaySentiment === 'positive' ? '📈' : displaySentiment === 'negative' ? '📉' : '📰';

                            return (
                                <div className="news-card" key={article.id || i}>
                                    <div className={`news-sentiment-icon ${displaySentiment}`}>{displayIcon}</div>
                                    <div className="news-body">
                                        <div className="news-title">
                                            <a href={article.url || '#'} target="_blank" rel="noopener noreferrer">{article.title}</a>
                                        </div>
                                        <div className="news-meta">
                                            <span className="source">{article.source}</span>
                                            {article.published_at && <span>{new Date(article.published_at).toLocaleString()}</span>}
                                            {displaySymbol && <span>📌 {displaySymbol}</span>}
                                            {article.processed && <span style={{ color: 'var(--accent-green)' }}>✓ Analyzed</span>}
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* Top 3 Indian Stocks Popup */}
            {showPopup && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }} onClick={() => setShowPopup(false)}>
                    <div className="glass-card" style={{ width: '90%', maxWidth: 450, padding: 24, position: 'relative' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                            <h3 style={{ margin: 0, fontSize: 18, color: 'var(--text-primary)' }}>
                                {analysisSource === 'india' ? '🇮🇳 Top 3 Indian Stocks' : '🌐 Top 3 Stocks by Sentiment'}
                            </h3>
                            <button onClick={() => setShowPopup(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 24, padding: 0, lineHeight: 1 }}>&times;</button>
                        </div>
                        {analysisSource !== 'india' && (
                            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
                                No Indian (NSE/BSE) stocks have sentiment data yet — showing global top stocks. Scrape & Analyze more news to get Indian-specific results.
                            </p>
                        )}
                        {analysisSource === 'india' && <div style={{ marginBottom: 16 }} />}

                        {topStocks.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                {topStocks.map((stock, i) => (
                                    <div key={stock.symbol} className="list-item" style={{ marginTop: 0, background: 'rgba(0,0,0,0.3)' }}>
                                        <div className="item-left">
                                            <div style={{ fontSize: 22, width: 28, textAlign: 'center' }}>
                                                {i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}
                                            </div>
                                            <div>
                                                <div className="item-symbol">{stock.symbol}</div>
                                                <div className="item-name">{stock.name} <span style={{ color: 'var(--text-dim)', fontSize: 11 }}>({stock.exchange})</span></div>
                                            </div>
                                        </div>
                                        <div className="item-right">
                                            <div className="item-amount" style={{ color: stock.wss > 0 ? 'var(--accent-green)' : stock.wss < 0 ? 'var(--accent-red)' : 'var(--text-primary)' }}>
                                                {stock.wss > 0 ? '+' : ''}{Number(stock.wss).toFixed(3)}
                                            </div>
                                            <div className="item-weight">{stock.article_count} articles</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)' }}>
                                No sentiment data yet — scrape some news first, then analyze.
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

import { useState, useEffect } from 'react';
import { apiRequest } from '../utils/api';
import { useToast } from '../context/ToastContext';
import { SkeletonTableRow } from '../components/Skeleton';

export default function News() {
    const [articles, setArticles] = useState(null); // null = loading
    const [source, setSource] = useState('');
    const [sources, setSources] = useState([]);
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
            const result = await apiRequest('/sentiment/analyze', { method: 'POST' });
            toast(`Analysis complete! ${result.analyzed} articles analyzed.`, 'success');
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
                <button className="btn btn-primary" onClick={handleAnalyze}>🧠 Analyze</button>
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
        </div>
    );
}

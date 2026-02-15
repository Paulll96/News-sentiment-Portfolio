import { useState, useEffect } from 'react';
import { apiRequest } from '../utils/api';
import { useToast } from '../context/ToastContext';

const mockNews = [
    { title: 'NVIDIA Announces Record-Breaking Q4 Earnings, AI Demand Soars', source: 'Reuters', sentiment: 'positive', time: '2 hours ago', symbol: 'NVDA' },
    { title: 'Apple Vision Pro Sales Exceed Expectations in First Month', source: 'Bloomberg', sentiment: 'positive', time: '3 hours ago', symbol: 'AAPL' },
    { title: 'Tesla Faces Production Delays at Berlin Factory', source: 'WSJ', sentiment: 'negative', time: '4 hours ago', symbol: 'TSLA' },
    { title: 'Microsoft Azure Growth Accelerates Amid AI Integration', source: 'CNBC', sentiment: 'positive', time: '5 hours ago', symbol: 'MSFT' },
    { title: 'Reddit IPO Filing Reveals Growing User Base', source: 'TechCrunch', sentiment: 'neutral', time: '6 hours ago', symbol: null },
    { title: 'Amazon Web Services Announces New AI Features', source: 'Yahoo Finance', sentiment: 'positive', time: '7 hours ago', symbol: 'AMZN' },
    { title: 'Meta Stock Drops on Advertising Revenue Concerns', source: 'MarketWatch', sentiment: 'negative', time: '8 hours ago', symbol: 'META' },
    { title: 'Google DeepMind Achieves Breakthrough in Protein Folding', source: 'Nature', sentiment: 'positive', time: '10 hours ago', symbol: 'GOOGL' },
];

export default function News() {
    const [articles, setArticles] = useState(mockNews);
    const [source, setSource] = useState('');
    const toast = useToast();

    useEffect(() => {
        apiRequest('/news/live')
            .then(data => { if (data.articles?.length) setArticles(data.articles); })
            .catch(() => {/* keep mock */ });
    }, []);

    const handleScrape = async () => {
        try {
            toast('Scraping news…', 'info');
            await apiRequest('/news/scrape', { method: 'POST' });
            toast('News scraped!', 'success');
            const data = await apiRequest('/news/live');
            if (data.articles?.length) setArticles(data.articles);
        } catch (e) {
            toast(e.message, 'error');
        }
    };

    const handleAnalyze = async () => {
        try {
            toast('Analyzing sentiment…', 'info');
            await apiRequest('/sentiment/analyze', { method: 'POST' });
            toast('Analysis complete!', 'success');
        } catch (e) {
            toast(e.message, 'error');
        }
    };

    const filtered = source ? articles.filter(a => (a.source || '').toLowerCase().includes(source)) : articles;

    return (
        <div className="page-enter">
            <div className="page-header">
                <h1>Live News Feed</h1>
                <p className="subtitle">5,000+ articles analyzed daily with sentiment scoring</p>
            </div>

            <div className="controls-bar">
                <div className="form-group">
                    <label>Source</label>
                    <select className="select-input" value={source} onChange={e => setSource(e.target.value)}>
                        <option value="">All Sources</option>
                        <option value="newsapi">NewsAPI</option>
                        <option value="yahoo">Yahoo Finance</option>
                        <option value="reddit">Reddit WSB</option>
                    </select>
                </div>
                <button className="btn btn-secondary" onClick={handleScrape}>📥 Scrape News</button>
                <button className="btn btn-primary" onClick={handleAnalyze}>🧠 Analyze</button>
            </div>

            <div className="bento-grid">
                <div className="glass-card no-hover col-span-12">
                    {filtered.map((article, i) => {
                        const s = article.sentiment || 'neutral';
                        const icon = s === 'positive' ? '📈' : s === 'negative' ? '📉' : '📰';
                        const time = article.time || (article.published_at ? new Date(article.published_at).toLocaleString() : '');

                        return (
                            <div className="news-card" key={i}>
                                <div className={`news-sentiment-icon ${s}`}>{icon}</div>
                                <div className="news-body">
                                    <div className="news-title">
                                        <a href={article.url || '#'} target="_blank" rel="noopener noreferrer">{article.title}</a>
                                    </div>
                                    <div className="news-meta">
                                        <span className="source">{article.source}</span>
                                        {time && <span>{time}</span>}
                                        {article.symbol && <span>📌 {article.symbol}</span>}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    {filtered.length === 0 && <p className="empty-state">No news articles found</p>}
                </div>
            </div>
        </div>
    );
}

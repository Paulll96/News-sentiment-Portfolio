const tickerData = [
    { symbol: 'AAPL', value: +0.72, },
    { symbol: 'TSLA', value: -0.45, },
    { symbol: 'NVDA', value: +0.88, },
    { symbol: 'MSFT', value: +0.12, },
    { symbol: 'GOOGL', value: +0.55, },
    { symbol: 'META', value: -0.32, },
    { symbol: 'AMZN', value: +0.41, },
    { symbol: 'JPM', value: +0.08, },
    { symbol: 'V', value: +0.25, },
    { symbol: 'JNJ', value: -0.05, },
];

function TickerItems() {
    return tickerData.map((t, i) => {
        // Only "positive", "negative", "neutral" classes
        const cls = t.value > 0.15 ? 'positive' : t.value < -0.15 ? 'negative' : 'neutral';
        return (
            <span className={`ticker-item ${cls}`} key={i}>
                <span className="ticker-symbol">{t.symbol}</span>
                <span className="ticker-value">{t.value > 0 ? '+' : ''}{t.value.toFixed(2)}</span>
            </span>
        );
    });
}

export default function SentimentTicker() {
    return (
        <div className="sentiment-ticker">
            <div className="ticker-track">
                <TickerItems />
                <TickerItems />
            </div>
        </div>
    );
}

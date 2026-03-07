import { useState, useEffect } from 'react';
import ShinyText from './ReactBits/ShinyText';
import { apiRequest } from '../utils/api';

function TickerItems({ data }) {
    return data.map((t, i) => {
        const cls = t.value > 0.15 ? 'positive' : t.value < -0.15 ? 'negative' : 'neutral';
        return (
            <span className={`ticker-item ${cls}`} key={i}>
                <span className="ticker-symbol">
                    <ShinyText text={t.symbol} disabled={false} speed={3} className="" />
                </span>
                <span className="ticker-value">{t.value > 0 ? '+' : ''}{t.value.toFixed(2)}</span>
            </span>
        );
    });
}

export default function SentimentTicker() {
    const [tickerData, setTickerData] = useState([]);

    useEffect(() => {
        apiRequest('/sentiment')
            .then(data => {
                if (data.sentiments && data.sentiments.length > 0) {
                    setTickerData(data.sentiments.map(s => ({
                        symbol: s.symbol,
                        value: s.wss || 0
                    })));
                }
            })
            .catch(() => { /* Ticker is non-critical, fail silently */ });
    }, []);

    if (tickerData.length === 0) return null;

    return (
        <div className="sentiment-ticker">
            <div className="ticker-track">
                <TickerItems data={tickerData} />
                <TickerItems data={tickerData} />
            </div>
        </div>
    );
}

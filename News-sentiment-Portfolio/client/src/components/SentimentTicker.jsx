import { useState, useEffect } from 'react';
import ShinyText from './ReactBits/ShinyText';
import { apiRequest } from '../utils/api';
import { useAuth } from '../context/AuthContext';

const SIGNAL_THRESHOLD = 0.1;

function TickerItems({ data }) {
    return data.map((t, i) => {
        const cls = t.value >= SIGNAL_THRESHOLD ? 'positive' : t.value <= -SIGNAL_THRESHOLD ? 'negative' : 'neutral';
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
    const { user } = useAuth();

    useEffect(() => {
        const params = new URLSearchParams({
            scope: user ? 'portfolio' : 'market',
            days: '7',
        });

        apiRequest(`/sentiment?${params.toString()}`)
            .then(data => {
                if (data.sentiments && data.sentiments.length > 0) {
                    setTickerData(data.sentiments.map(s => ({
                        symbol: s.symbol,
                        value: s.wss || 0
                    })));
                } else {
                    setTickerData([]);
                }
            })
            .catch(() => {
                // Ticker is non-critical, fail silently
                setTickerData([]);
            });
    }, [user]);

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

/**
 * Stocktwits Scraper — Free social sentiment source
 * Scrapes public sentiment data from Stocktwits API (no auth required for public endpoints)
 * Replaces the Twitter/X scraper (which costs $100+/mo)
 */

const axios = require('axios');

// Stocktwits public API base
const STOCKTWITS_API = 'https://api.stocktwits.com/api/2';

/**
 * Fetch public sentiment stream for a stock symbol from Stocktwits
 * @param {string} symbol - Stock ticker symbol (e.g., 'AAPL')
 * @returns {Object[]} Array of article-like objects for the scraper pipeline
 */
async function fetchStocktwitsStream(symbol) {
    try {
        const response = await axios.get(`${STOCKTWITS_API}/streams/symbol/${symbol}.json`, {
            timeout: 10000,
            headers: {
                'User-Agent': 'SentinelQuant/1.0',
            },
        });

        if (!response.data || !response.data.messages) {
            return [];
        }

        const messages = response.data.messages;

        return messages.map(msg => ({
            source: 'stocktwits',
            title: msg.body.substring(0, 200), // Use as "title" for sentiment analysis
            content: msg.body,
            url: `https://stocktwits.com/${msg.user?.username}/message/${msg.id}`,
            published_at: msg.created_at,
            // Stocktwits has its own sentiment labels
            stocktwits_sentiment: msg.entities?.sentiment?.basic || null,
        }));
    } catch (error) {
        if (error.response?.status === 429) {
            console.log(`⚠️  Stocktwits rate limited for ${symbol}, skipping`);
        } else {
            console.error(`⚠️  Stocktwits fetch failed for ${symbol}:`, error.message);
        }
        return [];
    }
}

/**
 * Scrape Stocktwits for all tracked symbols
 * Respects rate limits by adding a small delay between requests
 */
async function scrapeStocktwits() {
    const symbols = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'NVDA', 'META', 'JPM', 'V', 'JNJ'];
    const allMessages = [];

    console.log(`📱 Scraping Stocktwits for ${symbols.length} symbols...`);

    for (const symbol of symbols) {
        const messages = await fetchStocktwitsStream(symbol);
        allMessages.push(...messages);

        // Rate limit: 200 req/hour = ~5.5s between requests. Use 3s for safety.
        if (symbols.indexOf(symbol) < symbols.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 3000));
        }
    }

    console.log(`📱 Stocktwits: Found ${allMessages.length} messages across ${symbols.length} symbols`);
    return allMessages;
}

/**
 * Get Stocktwits sentiment summary for a symbol (for real-time display)
 * @param {string} symbol - Stock ticker
 * @returns {Object} Sentiment summary { bullish, bearish, total, bullishPercent }
 */
async function getStocktwitsSentiment(symbol) {
    try {
        const response = await axios.get(`${STOCKTWITS_API}/streams/symbol/${symbol}.json`, {
            timeout: 10000,
            headers: { 'User-Agent': 'SentinelQuant/1.0' },
        });

        const messages = response.data?.messages || [];
        let bullish = 0, bearish = 0;

        messages.forEach(msg => {
            const sentiment = msg.entities?.sentiment?.basic;
            if (sentiment === 'Bullish') bullish++;
            else if (sentiment === 'Bearish') bearish++;
        });

        const total = bullish + bearish;
        return {
            symbol,
            bullish,
            bearish,
            total,
            bullishPercent: total > 0 ? ((bullish / total) * 100).toFixed(1) : null,
            messageCount: messages.length,
        };
    } catch (error) {
        return { symbol, bullish: 0, bearish: 0, total: 0, bullishPercent: null, messageCount: 0 };
    }
}

module.exports = {
    fetchStocktwitsStream,
    scrapeStocktwits,
    getStocktwitsSentiment,
};

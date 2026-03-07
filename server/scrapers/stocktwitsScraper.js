/**
 * Stocktwits scraper.
 * Pulls public messages for tracked symbols and feeds them into the news pipeline.
 */

const axios = require('axios');
const { query } = require('../db');

const STOCKTWITS_API = 'https://api.stocktwits.com/api/2';
const DEFAULT_SYMBOLS = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'NVDA', 'META', 'JPM', 'V', 'JNJ'];

async function fetchStocktwitsStream(symbol) {
    try {
        const response = await axios.get(`${STOCKTWITS_API}/streams/symbol/${symbol}.json`, {
            timeout: 10000,
            headers: {
                'User-Agent': 'SentinelQuant/1.0',
            },
        });

        const messages = response.data?.messages || [];
        return messages.map(msg => ({
            source: 'stocktwits',
            title: String(msg.body || '').substring(0, 200),
            content: msg.body || null,
            url: `https://stocktwits.com/${msg.user?.username}/message/${msg.id}`,
            published_at: msg.created_at,
            stocktwits_sentiment: msg.entities?.sentiment?.basic || null,
        }));
    } catch (error) {
        if (error.response?.status === 429) {
            console.log(`Stocktwits rate limited for ${symbol}, skipping`);
        } else if (error.response?.status !== 404 && error.response?.status !== 403) {
            console.error(`Stocktwits fetch failed for ${symbol}:`, error.message);
        }
        return [];
    }
}

async function getSymbolsToScrape() {
    try {
        const result = await query(
            `SELECT symbol
             FROM stocks
             WHERE is_active = true
             ORDER BY exchange, symbol
             LIMIT 30`
        );

        const symbols = new Set();
        for (const row of result.rows) {
            const symbol = String(row.symbol || '').trim().toUpperCase();
            if (!symbol) continue;
            symbols.add(symbol);
            // Try bare form for NSE tickers too (e.g., RELIANCE from RELIANCE.NS)
            if (symbol.endsWith('.NS')) {
                symbols.add(symbol.slice(0, -3));
            }
        }

        const dynamic = [...symbols].slice(0, 30);
        return dynamic.length > 0 ? dynamic : DEFAULT_SYMBOLS;
    } catch (error) {
        console.warn(`Stocktwits symbol query failed, using defaults: ${error.message}`);
        return DEFAULT_SYMBOLS;
    }
}

async function scrapeStocktwits() {
    const symbols = await getSymbolsToScrape();
    const allMessages = [];

    console.log(`Scraping Stocktwits for ${symbols.length} symbols...`);

    for (let i = 0; i < symbols.length; i++) {
        const symbol = symbols[i];
        const messages = await fetchStocktwitsStream(symbol);
        allMessages.push(...messages);

        // Keep below Stocktwits free-rate limits.
        if (i < symbols.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 3000));
        }
    }

    console.log(`Stocktwits: found ${allMessages.length} messages across ${symbols.length} symbols`);
    return allMessages;
}

async function getStocktwitsSentiment(symbol) {
    try {
        const response = await axios.get(`${STOCKTWITS_API}/streams/symbol/${symbol}.json`, {
            timeout: 10000,
            headers: { 'User-Agent': 'SentinelQuant/1.0' },
        });

        const messages = response.data?.messages || [];
        let bullish = 0;
        let bearish = 0;

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
    } catch {
        return { symbol, bullish: 0, bearish: 0, total: 0, bullishPercent: null, messageCount: 0 };
    }
}

module.exports = {
    fetchStocktwitsStream,
    scrapeStocktwits,
    getStocktwitsSentiment,
};

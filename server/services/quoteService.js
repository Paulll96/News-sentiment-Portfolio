const axios = require('axios');
const { query } = require('../db');

const DEFAULT_CACHE_MINUTES = parseInt(process.env.QUOTE_CACHE_MINUTES || '5', 10);

function getProvider() {
    const configured = (process.env.QUOTE_PROVIDER || '').trim().toLowerCase();
    if (configured) return configured;
    return process.env.QUOTE_API_KEY ? 'twelvedata' : 'yahoo';
}

function formatSymbolForProvider(symbol, provider) {
    const clean = String(symbol || '').trim().toUpperCase();
    if (!clean) return clean;

    if (provider === 'twelvedata') {
        if (clean.endsWith('.NS')) return `${clean.slice(0, -3)}:NSE`;
        if (clean.endsWith('.BO')) return `${clean.slice(0, -3)}:BSE`;
    }

    return clean;
}

async function getCachedQuote(stockId, maxAgeMinutes = DEFAULT_CACHE_MINUTES) {
    const result = await query(
        `SELECT stock_id, price, currency, source, as_of
         FROM stock_quotes
         WHERE stock_id = $1
           AND as_of >= NOW() - ($2 || ' minutes')::interval
         LIMIT 1`,
        [stockId, String(maxAgeMinutes)]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
        stockId: row.stock_id,
        price: parseFloat(row.price),
        currency: row.currency,
        source: row.source,
        asOf: row.as_of,
    };
}

async function upsertQuote(stockId, quote) {
    await query(
        `INSERT INTO stock_quotes (stock_id, price, currency, source, as_of, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW())
         ON CONFLICT (stock_id)
         DO UPDATE SET
            price = EXCLUDED.price,
            currency = EXCLUDED.currency,
            source = EXCLUDED.source,
            as_of = EXCLUDED.as_of,
            updated_at = NOW()`,
        [stockId, quote.price, quote.currency, quote.source, quote.asOf]
    );
}

async function fetchFromTwelveData(symbol, currencyHint) {
    const apiKey = process.env.QUOTE_API_KEY;
    if (!apiKey) {
        return null;
    }

    const baseUrl = process.env.QUOTE_API_BASE_URL || 'https://api.twelvedata.com';
    const providerSymbol = formatSymbolForProvider(symbol, 'twelvedata');

    const response = await axios.get(`${baseUrl}/price`, {
        timeout: 12000,
        params: {
            symbol: providerSymbol,
            apikey: apiKey,
        },
    });

    const raw = response.data?.price;
    const price = parseFloat(raw);
    if (!Number.isFinite(price) || price <= 0) {
        return null;
    }

    return {
        price,
        currency: currencyHint || 'INR',
        source: 'twelvedata',
        asOf: new Date().toISOString(),
    };
}

async function fetchFromYahoo(symbol, currencyHint) {
    const response = await axios.get('https://query1.finance.yahoo.com/v7/finance/quote', {
        timeout: 12000,
        params: {
            symbols: formatSymbolForProvider(symbol, 'yahoo'),
        },
        headers: {
            'User-Agent': 'Mozilla/5.0 SentinelQuant/1.0',
        }
    });

    const quote = response.data?.quoteResponse?.result?.[0];
    const price = parseFloat(quote?.regularMarketPrice);

    if (!Number.isFinite(price) || price <= 0) {
        return null;
    }

    const marketTime = quote?.regularMarketTime
        ? new Date(quote.regularMarketTime * 1000).toISOString()
        : new Date().toISOString();

    return {
        price,
        currency: quote?.currency || currencyHint || 'INR',
        source: 'yahoo',
        asOf: marketTime,
    };
}

async function fetchLiveQuote(symbol, currencyHint) {
    const provider = getProvider();

    try {
        if (provider === 'twelvedata') {
            const quote = await fetchFromTwelveData(symbol, currencyHint);
            if (quote) return quote;
        }
    } catch (error) {
        console.warn(`Quote provider ${provider} failed for ${symbol}: ${error.message}`);
    }

    try {
        return await fetchFromYahoo(symbol, currencyHint);
    } catch (error) {
        console.warn(`Yahoo quote failed for ${symbol}: ${error.message}`);
        return null;
    }
}

async function getQuoteForStock(stock, options = {}) {
    const maxAgeMinutes = Number.isFinite(options.maxAgeMinutes)
        ? options.maxAgeMinutes
        : DEFAULT_CACHE_MINUTES;
    const forceRefresh = Boolean(options.forceRefresh);

    if (!stock?.id) return null;

    if (!forceRefresh) {
        const cached = await getCachedQuote(stock.id, maxAgeMinutes);
        if (cached) return cached;
    }

    const live = await fetchLiveQuote(stock.symbol, stock.currency);
    if (!live) return null;

    await upsertQuote(stock.id, live);

    return {
        stockId: stock.id,
        price: live.price,
        currency: live.currency,
        source: live.source,
        asOf: live.asOf,
    };
}

async function getQuotesForStocks(stocks, options = {}) {
    const byStockId = {};

    for (const stock of stocks) {
        const quote = await getQuoteForStock(stock, options);
        if (quote) {
            byStockId[stock.id] = quote;
        }
    }

    return byStockId;
}

async function getLiveQuoteBySymbol(symbol, currencyHint = 'INR') {
    return fetchLiveQuote(symbol, currencyHint);
}

module.exports = {
    getQuoteForStock,
    getQuotesForStocks,
    getLiveQuoteBySymbol,
};

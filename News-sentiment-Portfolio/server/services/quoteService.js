const axios = require('axios');
const { query } = require('../db');

const DEFAULT_CACHE_MINUTES = parseInt(process.env.QUOTE_CACHE_MINUTES || '5', 10);
const QUOTE_PROVIDER_UNAVAILABLE = 'QUOTE_PROVIDER_UNAVAILABLE';
const PLACEHOLDER_QUOTE_KEYS = [
    'your_quote_api_key_here',
    'your_api_key_here',
    'replace_me',
    'replace-with-real-key',
    'replace_with_real_key',
    'changeme',
    'dummy',
    'test',
    'null',
    'undefined',
];

function normalizeEnvValue(value) {
    return String(value || '').trim();
}

function hasConfiguredQuoteApiKey(value = process.env.QUOTE_API_KEY) {
    const raw = normalizeEnvValue(value);
    if (!raw) return false;

    const lowered = raw.toLowerCase();
    if (PLACEHOLDER_QUOTE_KEYS.includes(lowered)) {
        return false;
    }

    if (lowered.includes('your_quote_api_key') || lowered.includes('your_api_key') || lowered.includes('xxxxxxxx')) {
        return false;
    }

    return true;
}

function createQuoteProviderError(message, provider, providerStatus = 'unavailable') {
    const error = new Error(message);
    error.code = QUOTE_PROVIDER_UNAVAILABLE;
    error.provider = provider;
    error.providerStatus = providerStatus;
    return error;
}

function isAuthFailure(error) {
    const status = error?.response?.status;
    return status === 401 || status === 403;
}

function getProvider() {
    const configured = normalizeEnvValue(process.env.QUOTE_PROVIDER).toLowerCase();
    if (configured) return configured;
    return hasConfiguredQuoteApiKey() ? 'twelvedata' : 'yahoo';
}

function getQuoteEngineStatus() {
    const provider = getProvider();

    if (provider === 'twelvedata') {
        return {
            provider,
            status: hasConfiguredQuoteApiKey() ? 'configured' : 'misconfigured',
        };
    }

    return {
        provider,
        status: 'unavailable',
    };
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
    const apiKey = normalizeEnvValue(process.env.QUOTE_API_KEY);
    if (!hasConfiguredQuoteApiKey(apiKey)) {
        throw createQuoteProviderError(
            'Live quote provider is not configured with a valid Twelve Data API key.',
            'twelvedata',
            'misconfigured'
        );
    }

    const baseUrl = process.env.QUOTE_API_BASE_URL || 'https://api.twelvedata.com';
    const providerSymbol = formatSymbolForProvider(symbol, 'twelvedata');
    let response;

    try {
        response = await axios.get(`${baseUrl}/price`, {
            timeout: 12000,
            params: {
                symbol: providerSymbol,
                apikey: apiKey,
            },
        });
    } catch (error) {
        if (isAuthFailure(error)) {
            throw createQuoteProviderError(
                'Live quote provider rejected the configured Twelve Data API key.',
                'twelvedata',
                'misconfigured'
            );
        }
        throw error;
    }

    if (response.data?.status === 'error' || response.data?.code === 401) {
        throw createQuoteProviderError(
            'Live quote provider rejected the configured Twelve Data API key.',
            'twelvedata',
            'misconfigured'
        );
    }

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
    let response;

    try {
        console.log(`[QuoteService] Attempting Yahoo fallback for: ${symbol}`);
        response = await axios.get('https://query1.finance.yahoo.com/v7/finance/quote', {
            timeout: 12000,
            params: {
                symbols: formatSymbolForProvider(symbol, 'yahoo'),
            },
            headers: {
                'User-Agent': 'Mozilla/5.0 SentinelQuant/1.0',
            }
        });
    } catch (error) {
        console.warn(`[QuoteService] Yahoo fallback failed for ${symbol}: ${error.message}`);
        if (isAuthFailure(error)) {
            throw createQuoteProviderError(
                'Yahoo live quote fallback is unavailable.',
                'yahoo',
                'unavailable'
            );
        }
        throw error;
    }

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

async function fetchLiveQuoteDetailed(symbol, currencyHint) {
    const provider = getProvider();
    let providerFailure = null;

    try {
        if (provider === 'twelvedata') {
            const quote = await fetchFromTwelveData(symbol, currencyHint);
            if (quote) return { quote, error: null };
        }
    } catch (error) {
        if (error?.code === QUOTE_PROVIDER_UNAVAILABLE) {
            providerFailure = error;
        } else {
            console.warn(`Quote provider ${provider} failed for ${symbol}: ${error.message}`);
        }
    }

    try {
        const yahooQuote = await fetchFromYahoo(symbol, currencyHint);
        if (yahooQuote) {
            return { quote: yahooQuote, error: null };
        }
    } catch (error) {
        console.warn(`Yahoo quote failed for ${symbol}: ${error.message}`);
        if (!providerFailure && error?.code === QUOTE_PROVIDER_UNAVAILABLE) {
            providerFailure = error;
        }
    }

    return {
        quote: null,
        error: providerFailure,
    };
}

async function fetchLiveQuote(symbol, currencyHint) {
    const result = await fetchLiveQuoteDetailed(symbol, currencyHint);
    return result.quote;
}

async function getQuoteForStockDetailed(stock, options = {}) {
    const maxAgeMinutes = Number.isFinite(options.maxAgeMinutes)
        ? options.maxAgeMinutes
        : DEFAULT_CACHE_MINUTES;
    const forceRefresh = Boolean(options.forceRefresh);

    if (!stock?.id) {
        return { quote: null, error: null };
    }

    if (!forceRefresh) {
        const cached = await getCachedQuote(stock.id, maxAgeMinutes);
        if (cached) {
            return { quote: cached, error: null };
        }
    }

    const liveResult = await fetchLiveQuoteDetailed(stock.symbol, stock.currency);
    if (!liveResult.quote) {
        return liveResult;
    }

    await upsertQuote(stock.id, liveResult.quote);

    return {
        quote: {
            stockId: stock.id,
            price: liveResult.quote.price,
            currency: liveResult.quote.currency,
            source: liveResult.quote.source,
            asOf: liveResult.quote.asOf,
        },
        error: null,
    };
}

async function getQuoteForStock(stock, options = {}) {
    const result = await getQuoteForStockDetailed(stock, options);
    return result.quote;
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

async function getLiveQuoteBySymbolDetailed(symbol, currencyHint = 'INR') {
    return fetchLiveQuoteDetailed(symbol, currencyHint);
}

/**
 * Fetches historical daily closing prices for an array of symbols over a given range
 * @param {string[]} symbols - Array of stock symbols
 * @param {string} range - e.g., '1mo', '3mo', '1y'
 * @returns {Record<string, Record<string, number>>} - { 'AAPL': { '2026-03-01': 150.5, ... } }
 */
async function fetchHistoricalPrices(symbols, range = '1mo') {
    const historyMap = {};
    if (!symbols || symbols.length === 0) return historyMap;

    for (const symbol of symbols) {
        try {
            const providerSymbol = formatSymbolForProvider(symbol, 'yahoo');
            const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(providerSymbol)}?range=${range}&interval=1d`;

            const response = await axios.get(url, {
                timeout: 10000,
                headers: { 'User-Agent': 'Mozilla/5.0 SentinelQuant/1.0' }
            });

            const result = response.data?.chart?.result?.[0];
            if (!result || !result.timestamp || !result.indicators?.quote?.[0]?.close) {
                continue;
            }

            const timestamps = result.timestamp;
            const closes = result.indicators.quote[0].close;
            historyMap[symbol] = {};

            for (let i = 0; i < timestamps.length; i++) {
                const price = closes[i];
                if (price == null || !Number.isFinite(price)) continue;

                const d = new Date(timestamps[i] * 1000);
                const dateKey = d.toISOString().split('T')[0]; // 'YYYY-MM-DD'

                historyMap[symbol][dateKey] = Number(price);
            }
        } catch (error) {
            console.warn(`Failed to fetch historical prices for ${symbol}: ${error.message}`);
        }
    }

    return historyMap;
}

module.exports = {
    getQuoteForStock,
    getQuoteForStockDetailed,
    getQuotesForStocks,
    getLiveQuoteBySymbol,
    getLiveQuoteBySymbolDetailed,
    getQuoteEngineStatus,
    hasConfiguredQuoteApiKey,
    QUOTE_PROVIDER_UNAVAILABLE,
    fetchHistoricalPrices,
};

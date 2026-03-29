require('dotenv').config();
const axios = require('axios');

const QUOTE_PROVIDER_UNAVAILABLE = 'QUOTE_PROVIDER_UNAVAILABLE';

function createQuoteProviderError(message, provider, providerStatus = 'unavailable') {
    const error = new Error(message);
    error.code = QUOTE_PROVIDER_UNAVAILABLE;
    error.provider = provider;
    error.providerStatus = providerStatus;
    return error;
}

async function fetchFromTwelveData(symbol, apiKey) {
    const baseUrl = 'https://api.twelvedata.com';
    const providerSymbol = symbol.endsWith('.NS') ? `${symbol.slice(0, -3)}:NSE` : symbol;
    
    try {
        const response = await axios.get(`${baseUrl}/price`, {
            timeout: 12000,
            params: {
                symbol: providerSymbol,
                apikey: apiKey,
            },
        });
        if (response.data?.status === 'error' || response.data?.code === 401) {
             throw createQuoteProviderError('TwelveData Error: ' + response.data.message, 'twelvedata', 'misconfigured');
        }
        return response.data;
    } catch (e) {
        if (e.code === QUOTE_PROVIDER_UNAVAILABLE) throw e;
        throw new Error('TwelveData Failed: ' + e.message);
    }
}

async function fetchFromYahoo(symbol) {
    try {
        const response = await axios.get('https://query1.finance.yahoo.com/v7/finance/quote', {
            timeout: 12000,
            params: { symbols: symbol },
            headers: { 'User-Agent': 'Mozilla/5.0 SentinelQuant/1.0' }
        });
        const quote = response.data?.quoteResponse?.result?.[0];
        if (!quote) throw new Error('No Yahoo result');
        return quote;
    } catch (e) {
        throw new Error('Yahoo Failed: ' + e.message);
    }
}

async function testFullFlow(symbol) {
    let providerFailure = null;
    const apiKey = process.env.QUOTE_API_KEY;

    console.log(`Testing full flow for ${symbol}...`);

    try {
        console.log('Attempting TwelveData...');
        const td = await fetchFromTwelveData(symbol, apiKey);
        console.log('TwelveData Success:', td);
        return;
    } catch (error) {
        console.log('TwelveData Failed:', error.message);
        if (error.code === QUOTE_PROVIDER_UNAVAILABLE) {
            providerFailure = error;
        }
    }

    try {
        console.log('Attempting Yahoo Fallback...');
        const yh = await fetchFromYahoo(symbol);
        console.log('Yahoo Success Price:', yh.regularMarketPrice);
        return;
    } catch (error) {
        console.log('Yahoo Fallback Failed:', error.message);
    }

    console.log('FINAL RESULT: Both failed.');
    if (providerFailure) {
        console.log('Final Error Code:', providerFailure.code);
        console.log('Final Error Msg:', providerFailure.message);
    }
}

testFullFlow('RELIANCE.NS');

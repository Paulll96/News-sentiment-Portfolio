require('dotenv').config();
const axios = require('axios');

async function testTwelveData() {
    const apiKey = process.env.QUOTE_API_KEY;
    const symbols = ['AAPL', 'RELIANCE:NSE', 'RELIANCE'];
    
    for (const symbol of symbols) {
        console.log(`--- Testing TwelveData ${symbol} ---`);
        try {
            const response = await axios.get('https://api.twelvedata.com/price', {
                params: {
                    symbol: symbol,
                    apikey: apiKey,
                },
            });
            console.log('Response:', JSON.stringify(response.data, null, 2));
        } catch (error) {
            console.error('Error:', error.message);
        }
    }
}

async function testYahoo() {
    const symbols = ['RELIANCE.NS', 'AAPL'];
    for (const symbol of symbols) {
        console.log(`--- Testing Yahoo ${symbol} ---`);
        try {
            const response = await axios.get('https://query1.finance.yahoo.com/v7/finance/quote', {
                params: { symbols: symbol },
                headers: { 'User-Agent': 'Mozilla/5.0 SentinelQuant/1.0' }
            });
            const quote = response.data?.quoteResponse?.result?.[0];
            console.log('Price:', quote?.regularMarketPrice);
        } catch (error) {
            console.error('Error:', error.message);
        }
    }
}

async function runTests() {
    await testTwelveData();
    await testYahoo();
}

runTests();

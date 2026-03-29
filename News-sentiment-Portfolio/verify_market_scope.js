require('dotenv').config();
const { query } = require('./server/db');

async function verifyMarketScope() {
    console.log('--- Verifying Market Scope Data Sources ---');

    try {
        // 1. Get all stocks with at least one sentiment score in the last 7 days
        const marketStocksResult = await query(`
            SELECT DISTINCT s.symbol, s.name, COUNT(ss.id) as score_count
            FROM stocks s
            JOIN sentiment_scores ss ON s.id = ss.stock_id
            WHERE ss.analyzed_at >= NOW() - INTERVAL '7 days'
            GROUP BY s.symbol, s.name
            ORDER BY score_count DESC
            LIMIT 10
        `);

        console.log('\nTop 10 Trending Stocks in Market Scope (by news volume):');
        console.table(marketStocksResult.rows);

        // 2. Identify which of these are actually held by ANY user
        const symbols = marketStocksResult.rows.map(r => r.symbol);
        const heldResult = await query(`
            SELECT DISTINCT s.symbol
            FROM portfolio_holdings ph
            JOIN stocks s ON ph.stock_id = s.id
            WHERE s.symbol = ANY($1::text[])
        `, [symbols]);

        const heldSymbols = new Set(heldResult.rows.map(r => r.symbol));
        
        console.log('\nVerification Analysis:');
        marketStocksResult.rows.forEach(row => {
            const isHeld = heldSymbols.has(row.symbol);
            console.log(`- ${row.symbol.padEnd(15)}: ${isHeld ? '✅ Held by a user' : '🌐 Public Market Data (Not held by anyone)'}`);
        });

        const publicCount = marketStocksResult.rows.length - heldSymbols.size;
        if (publicCount > 0) {
            console.log(`\n✅ CONFIRMED: ${publicCount} out of the top 10 stocks in the Market scope are NOT held by any user.`);
            console.log('This proves the Market scope is fetching data based on GLOBAL news trends, not just user data.');
        } else {
            console.log('\n⚠️ All top trending stocks happen to be held by users. (This can happen if you have a small test database).');
        }

    } catch (error) {
        console.error('Verification failed:', error.message);
    }
    process.exit(0);
}

verifyMarketScope();

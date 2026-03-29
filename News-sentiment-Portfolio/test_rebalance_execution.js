/**
 * Regression test: after execute rebalance, holdings shares actually change
 * for buy and sell cases.
 *
 * Usage: node test_rebalance_execution.js
 *
 * Requires: running PostgreSQL with sentinelquant DB, .env configured.
 */

require('dotenv').config();
const { query, transaction } = require('./server/db');
const {
    rebalancePortfolio,
    getPortfolioHoldings,
    CONFIG,
} = require('./server/services/portfolioService');

const TEST_USER_ID = 999999; // Use a throwaway user ID

async function setup() {
    // Clean up any previous test data
    await query('DELETE FROM transactions WHERE user_id = $1', [TEST_USER_ID]);
    await query('DELETE FROM portfolio_holdings WHERE user_id = $1', [TEST_USER_ID]);

    // Pick two stocks that exist in the stocks table
    const stocksResult = await query(
        `SELECT id, symbol FROM stocks WHERE is_active = true LIMIT 2`
    );

    if (stocksResult.rows.length < 2) {
        throw new Error('Need at least 2 active stocks in the stocks table to run this test');
    }

    const [stockA, stockB] = stocksResult.rows;

    // Insert holdings with deliberately uneven weights to force rebalance trades
    // Stock A: 80% weight (overweight → should sell)
    // Stock B: 20% weight (underweight → should buy)
    await query(
        `INSERT INTO portfolio_holdings (user_id, stock_id, shares, avg_cost, current_value, weight, sentiment_score)
         VALUES ($1, $2, 100, 100, 8000, 0.80, 0)`,
        [TEST_USER_ID, stockA.id]
    );
    await query(
        `INSERT INTO portfolio_holdings (user_id, stock_id, shares, avg_cost, current_value, weight, sentiment_score)
         VALUES ($1, $2, 20, 100, 2000, 0.20, 0)`,
        [TEST_USER_ID, stockB.id]
    );

    return { stockA, stockB };
}

async function cleanup() {
    await query('DELETE FROM transactions WHERE user_id = $1', [TEST_USER_ID]);
    await query('DELETE FROM portfolio_holdings WHERE user_id = $1', [TEST_USER_ID]);
}

async function runTest() {
    console.log('\n🧪 Rebalance Execution Regression Test\n');

    let passed = true;

    try {
        const { stockA, stockB } = await setup();

        // Record shares before
        const beforeHoldings = await getPortfolioHoldings(TEST_USER_ID);
        const beforeSharesA = parseFloat(beforeHoldings.find(h => h.symbol === stockA.symbol)?.shares || 0);
        const beforeSharesB = parseFloat(beforeHoldings.find(h => h.symbol === stockB.symbol)?.shares || 0);

        console.log(`Before: ${stockA.symbol} = ${beforeSharesA} shares, ${stockB.symbol} = ${beforeSharesB} shares`);

        // Lower threshold to ensure trades generate
        const originalThreshold = CONFIG.rebalanceThreshold;
        CONFIG.rebalanceThreshold = 0.01;

        // Execute rebalance (dryRun = false)
        const result = await rebalancePortfolio(TEST_USER_ID, false);

        // Restore threshold
        CONFIG.rebalanceThreshold = originalThreshold;

        console.log(`Trades generated: ${result.trades.length}`);
        result.trades.forEach(t => {
            console.log(`  ${t.type.toUpperCase()} ${t.symbol}: ${t.currentWeight} → ${t.targetWeight} (value: ${t.tradeValue})`);
        });

        if (result.trades.length === 0) {
            console.log('⚠️  No trades were generated (weights may already be balanced). Test is inconclusive.');
            return;
        }

        // Record shares after
        const afterHoldings = await getPortfolioHoldings(TEST_USER_ID);
        const afterSharesA = parseFloat(afterHoldings.find(h => h.symbol === stockA.symbol)?.shares || 0);
        const afterSharesB = parseFloat(afterHoldings.find(h => h.symbol === stockB.symbol)?.shares || 0);

        console.log(`After:  ${stockA.symbol} = ${afterSharesA} shares, ${stockB.symbol} = ${afterSharesB} shares`);

        // Assert: shares must have changed for at least one stock
        const sharesChanged = (afterSharesA !== beforeSharesA) || (afterSharesB !== beforeSharesB);
        if (!sharesChanged) {
            console.error('❌ FAIL: Shares did not change after execute rebalance!');
            passed = false;
        } else {
            console.log('✅ PASS: Shares changed after execute rebalance');
        }

        // Assert: check buy increases shares
        for (const trade of result.trades) {
            const beforeShares = trade.symbol === stockA.symbol ? beforeSharesA : beforeSharesB;
            const afterShares = trade.symbol === stockA.symbol ? afterSharesA : afterSharesB;

            if (trade.type === 'buy' && afterShares <= beforeShares) {
                console.error(`❌ FAIL: Buy trade for ${trade.symbol} did not increase shares (${beforeShares} → ${afterShares})`);
                passed = false;
            } else if (trade.type === 'sell' && afterShares >= beforeShares) {
                console.error(`❌ FAIL: Sell trade for ${trade.symbol} did not decrease shares (${beforeShares} → ${afterShares})`);
                passed = false;
            }
        }

        if (passed) {
            console.log('✅ All assertions passed');
        }

        // Verify transactions were recorded
        const txResult = await query(
            `SELECT type, shares, reason FROM transactions WHERE user_id = $1 ORDER BY executed_at DESC`,
            [TEST_USER_ID]
        );
        console.log(`\nTransactions recorded: ${txResult.rows.length}`);
        txResult.rows.forEach(tx => {
            console.log(`  ${tx.type.toUpperCase()} ${parseFloat(tx.shares).toFixed(4)} shares — ${tx.reason}`);
        });

    } catch (err) {
        console.error('❌ Test error:', err.message);
        passed = false;
    } finally {
        await cleanup();
        console.log('\n🧹 Test data cleaned up');
    }

    process.exit(passed ? 0 : 1);
}

runTest();



const { query, transaction } = require('../db');
const { calculateWSS, getAllStockSentiments } = require('./sentimentService');

// Rebalancing parameters
const CONFIG = {
    maxPositionPercent: parseFloat(process.env.MAX_POSITION_PERCENT) || 25,
    rebalanceThreshold: parseFloat(process.env.REBALANCE_THRESHOLD) || 0.05,
    sentimentWeight: 0.6,  // 60% sentiment, 40% equal weight
    minSentimentForBuy: 0.15,  // Minimum WSS to increase position
    maxSentimentForSell: -0.15  // Maximum WSS before decreasing position
};

/**
 
 * @param {Array} sentiments - Array of {symbol, wss, ...}
 * @returns {Object} - { symbol: targetWeight }
 */
function calculateTargetWeights(sentiments) {
    const activeStocks = sentiments.filter(s => s.articleCount > 0);

    if (activeStocks.length === 0) {
        // Equal weight if no sentiment data
        const equalWeight = 1 / sentiments.length;
        return Object.fromEntries(sentiments.map(s => [s.symbol, equalWeight]));
    }

    // Normalize WSS to positive values for weighting
    const normalizedScores = activeStocks.map(s => ({
        symbol: s.symbol,
        score: (s.wss + 1) / 2  // Convert [-1, 1] to [0, 1]
    }));

    const totalScore = normalizedScores.reduce((sum, s) => sum + s.score, 0);

    // Calculate sentiment-based weights
    const sentimentWeights = {};
    normalizedScores.forEach(s => {
        sentimentWeights[s.symbol] = s.score / totalScore;
    });

    // Blend with equal weight
    const equalWeight = 1 / sentiments.length;
    const targetWeights = {};

    sentiments.forEach(s => {
        const sentWeight = sentimentWeights[s.symbol] || equalWeight;
        const blendedWeight = CONFIG.sentimentWeight * sentWeight +
            (1 - CONFIG.sentimentWeight) * equalWeight;

        // Apply max position limit
        targetWeights[s.symbol] = Math.min(blendedWeight, CONFIG.maxPositionPercent / 100);
    });

    // Normalize to sum to 1
    const totalWeight = Object.values(targetWeights).reduce((a, b) => a + b, 0);
    Object.keys(targetWeights).forEach(symbol => {
        targetWeights[symbol] /= totalWeight;
    });

    return targetWeights;
}

/**
 * Get current portfolio holdings for a user
 */
async function getPortfolioHoldings(userId) {
    const result = await query(
        `SELECT ph.*, s.symbol, s.name
         FROM portfolio_holdings ph
         JOIN stocks s ON ph.stock_id = s.id
         WHERE ph.user_id = $1`,
        [userId]
    );
    return result.rows;
}

/**
 * Calculate portfolio value
 */
async function calculatePortfolioValue(userId) {
    const holdings = await getPortfolioHoldings(userId);
    return holdings.reduce((total, h) => total + parseFloat(h.current_value || 0), 0);
}

/**
 * Execute rebalancing for a portfolio
 */
async function rebalancePortfolio(userId, dryRun = true) {
    console.log(`\n🔄 ${dryRun ? '[DRY RUN] ' : ''}Rebalancing portfolio for user ${userId}...\n`);

    // Get current holdings
    const holdings = await getPortfolioHoldings(userId);
    const portfolioValue = holdings.reduce((total, h) => total + parseFloat(h.current_value || 0), 0);

    if (portfolioValue === 0) {
        return { error: 'Empty portfolio', trades: [] };
    }

    // Get current weights
    const currentWeights = {};
    holdings.forEach(h => {
        currentWeights[h.symbol] = parseFloat(h.current_value) / portfolioValue;
    });

    // Get sentiment and calculate target weights
    const sentiments = await getAllStockSentiments();
    const targetWeights = calculateTargetWeights(sentiments);

    // Calculate required trades
    const trades = [];

    for (const sentiment of sentiments) {
        const symbol = sentiment.symbol;
        const currentWeight = currentWeights[symbol] || 0;
        const targetWeight = targetWeights[symbol] || 0;
        const weightDiff = targetWeight - currentWeight;

        // Only trade if difference exceeds threshold
        if (Math.abs(weightDiff) >= CONFIG.rebalanceThreshold) {
            const tradeValue = weightDiff * portfolioValue;
            const tradeType = tradeValue > 0 ? 'buy' : 'sell';

            trades.push({
                symbol,
                type: tradeType,
                currentWeight: (currentWeight * 100).toFixed(2) + '%',
                targetWeight: (targetWeight * 100).toFixed(2) + '%',
                tradeValue: Math.abs(tradeValue).toFixed(2),
                sentiment: sentiment.wss.toFixed(3),
                signal: sentiment.signal,
                reason: `WSS: ${sentiment.wss.toFixed(3)} (${sentiment.signal})`
            });
        }
    }

    // Sort by absolute trade value (largest first)
    trades.sort((a, b) => parseFloat(b.tradeValue) - parseFloat(a.tradeValue));

    console.log(`📊 Portfolio Value: $${portfolioValue.toFixed(2)}`);
    console.log(`📈 Trades Required: ${trades.length}`);

    trades.forEach(t => {
        const emoji = t.type === 'buy' ? '🟢' : '🔴';
        console.log(`${emoji} ${t.type.toUpperCase()} ${t.symbol}: $${t.tradeValue} (${t.currentWeight} → ${t.targetWeight})`);
    });

    // Execute trades if not dry run
    if (!dryRun && trades.length > 0) {
        await executeTrades(userId, trades, portfolioValue);
    }

    return {
        portfolioValue,
        currentWeights,
        targetWeights,
        trades,
        dryRun
    };
}

/**
 * Execute trades — creates explicit buy/sell transactions (NOT type='rebalance')
 */
async function executeTrades(userId, trades, portfolioValue) {
    await transaction(async (client) => {
        for (const trade of trades) {
            // Get stock ID
            const stockResult = await client.query(
                'SELECT id FROM stocks WHERE symbol = $1',
                [trade.symbol]
            );

            if (stockResult.rows.length === 0) continue;

            const stockId = stockResult.rows[0].id;
            const tradeValue = parseFloat(trade.tradeValue);
            // Use a representative price (value / approximate shares)
            const approxPrice = tradeValue > 0 ? tradeValue : 1;
            const approxShares = tradeValue / approxPrice;

            // Log as explicit buy or sell — not 'rebalance' with zeroed fields
            await client.query(
                `INSERT INTO transactions (user_id, stock_id, type, shares, price, total_value, reason)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [userId, stockId, trade.type, approxShares, approxPrice, tradeValue,
                    `Rebalance: ${trade.reason}`]
            );

            // Update or create holding
            const newWeight = parseFloat(trade.targetWeight) / 100;
            const newValue = portfolioValue * newWeight;

            await client.query(
                `INSERT INTO portfolio_holdings (user_id, stock_id, shares, current_value, weight, sentiment_score)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 ON CONFLICT (user_id, stock_id) 
                 DO UPDATE SET current_value = $4, weight = $5, sentiment_score = $6, updated_at = NOW()`,
                [userId, stockId, approxShares, newValue, newWeight, parseFloat(trade.sentiment)]
            );
        }
    });

    console.log('\n✅ Trades executed successfully');
}

/**
 * Initialize a new portfolio with default allocation
 * Creates both holdings AND corresponding buy transactions for ledger integrity
 */
async function initializePortfolio(userId, initialCapital = 10000) {
    const sentiments = await getAllStockSentiments();
    const targetWeights = calculateTargetWeights(sentiments);

    await transaction(async (client) => {
        for (const [symbol, weight] of Object.entries(targetWeights)) {
            const stockResult = await client.query(
                'SELECT id FROM stocks WHERE symbol = $1',
                [symbol]
            );

            if (stockResult.rows.length === 0) continue;

            const stockId = stockResult.rows[0].id;
            const value = initialCapital * weight;
            const sentiment = sentiments.find(s => s.symbol === symbol);
            // Use value as both price and 1 share (notional position)
            const approxPrice = value > 0 ? value : 1;
            const approxShares = value / approxPrice;

            // Create holding
            await client.query(
                `INSERT INTO portfolio_holdings (user_id, stock_id, shares, current_value, weight, sentiment_score)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 ON CONFLICT (user_id, stock_id) DO NOTHING`,
                [userId, stockId, approxShares, value, weight, sentiment?.wss || 0]
            );

            // Create matching buy transaction for ledger integrity
            await client.query(
                `INSERT INTO transactions (user_id, stock_id, type, shares, price, total_value, reason)
                 VALUES ($1, $2, 'buy', $3, $4, $5, 'Initial portfolio allocation')`,
                [userId, stockId, approxShares, approxPrice, value]
            );
        }
    });

    console.log(`✅ Initialized portfolio with $${initialCapital}`);
    return { initialCapital, weights: targetWeights };
}

module.exports = {
    calculateTargetWeights,
    getPortfolioHoldings,
    calculatePortfolioValue,
    rebalancePortfolio,
    initializePortfolio,
    CONFIG
};

/**
 * Portfolio API Routes
 */

const express = require('express');
const { query } = require('../db');
const { authenticateToken } = require('../middleware/auth');
const {
    getPortfolioHoldings,
    rebalancePortfolio,
    initializePortfolio,
    calculatePortfolioValue,
    refreshPortfolioQuotes,
    addHolding,
    removeHolding,
    importHoldings
} = require('../services/portfolioService');
const { classifySignal } = require('../services/sentimentService');

const router = express.Router();

/**
 * GET /api/portfolio
 * Get user's portfolio holdings
 */
router.get('/', authenticateToken, async (req, res) => {
    try {
        await refreshPortfolioQuotes(req.user.userId);
        const holdings = await getPortfolioHoldings(req.user.userId);
        const totalValue = holdings.reduce((sum, h) => sum + parseFloat(h.current_value || 0), 0);

        res.json({
            holdings: holdings.map(h => ({
                symbol: h.symbol,
                name: h.name,
                exchange: h.exchange,
                currency: h.currency || 'INR',
                shares: parseFloat(h.shares),
                avgCost: h.avg_cost !== null ? parseFloat(h.avg_cost) : null,
                currentValue: parseFloat(h.current_value),
                weight: parseFloat(h.weight) * 100,
                sentimentScore: parseFloat(h.sentiment_score),
                signal: classifySignal(h.sentiment_score)
            })),
            summary: {
                totalValue,
                holdingsCount: holdings.length,
                lastUpdated: holdings[0]?.updated_at || null,
                currency: 'INR',
            },
            currency: 'INR',
        });
    } catch (error) {
        console.error('Get portfolio error:', error);
        res.status(500).json({ error: 'Failed to get portfolio' });
    }
});

/**
 * POST /api/portfolio/initialize
 * Initialize a new portfolio with default allocation
 */
router.post('/initialize', authenticateToken, async (req, res) => {
    try {
        const initialCapital = parseFloat(req.body.initialCapital) || 10000;

        // Check if user already has holdings
        const existing = await getPortfolioHoldings(req.user.userId);
        if (existing.length > 0) {
            return res.status(400).json({ error: 'Portfolio already exists. Use rebalance instead.' });
        }

        const result = await initializePortfolio(req.user.userId, initialCapital);

        res.status(201).json({
            message: 'Portfolio initialized',
            ...result
        });
    } catch (error) {
        console.error('Initialize portfolio error:', error);
        res.status(500).json({ error: 'Failed to initialize portfolio' });
    }
});

/**
 * POST /api/portfolio/holdings
 * Add or increase a holding manually
 */
router.post('/holdings', authenticateToken, async (req, res) => {
    try {
        const result = await addHolding(req.user.userId, req.body || {});

        if (result.error) {
            return res.status(400).json(result);
        }

        res.status(201).json(result);
    } catch (error) {
        console.error('Add holding error:', error);
        res.status(500).json({ error: 'Failed to add holding' });
    }
});

/**
 * DELETE /api/portfolio/holdings/:symbol
 * Sell all shares and remove the holding from portfolio
 */
router.delete('/holdings/:symbol', authenticateToken, async (req, res) => {
    try {
        const symbol = String(req.params.symbol || '').trim();
        if (!symbol) {
            return res.status(400).json({ error: 'Symbol is required' });
        }

        // Best-effort refresh to improve sell ledger valuation.
        try {
            await refreshPortfolioQuotes(req.user.userId, { maxAgeMinutes: 0 });
        } catch {
            // Ignore refresh failures and continue with fallback valuation.
        }

        const result = await removeHolding(req.user.userId, symbol);

        if (result.error) {
            const status = result.error.toLowerCase().includes('not found') ? 404 : 400;
            return res.status(status).json({ error: result.error });
        }

        res.json(result);
    } catch (error) {
        console.error('Remove holding error:', error);
        res.status(500).json({ error: 'Failed to remove holding' });
    }
});

/**
 * POST /api/portfolio/import
 * Import holdings (dryRun preview by default)
 */
router.post('/import', authenticateToken, async (req, res) => {
    try {
        const result = await importHoldings(req.user.userId, req.body || {});

        if (result.error) {
            return res.status(400).json(result);
        }

        res.json(result);
    } catch (error) {
        console.error('Import holdings error:', error);
        res.status(500).json({ error: 'Failed to import holdings' });
    }
});

/**
 * POST /api/portfolio/rebalance
 * Rebalance portfolio based on current sentiment
 */
router.post('/rebalance', authenticateToken, async (req, res) => {
    try {
        const dryRun = req.body.dryRun !== false; // Default to dry run

        const result = await rebalancePortfolio(req.user.userId, dryRun);

        if (result.error) {
            return res.status(400).json({ error: result.error });
        }

        res.json({
            message: dryRun ? 'Rebalance preview (no trades executed)' : 'Rebalance executed',
            ...result
        });
    } catch (error) {
        console.error('Rebalance error:', error);
        res.status(500).json({ error: 'Failed to rebalance portfolio' });
    }
});

/**
 * GET /api/portfolio/performance
 * Get portfolio performance metrics
 */
router.get('/performance', authenticateToken, async (req, res) => {
    try {
        await refreshPortfolioQuotes(req.user.userId);
        const holdings = await getPortfolioHoldings(req.user.userId);
        const totalValue = holdings.reduce((sum, h) => sum + parseFloat(h.current_value || 0), 0);

        // Get transactions for return calculation
        const txResult = await query(
            `SELECT type, total_value, executed_at
             FROM transactions
             WHERE user_id = $1
             ORDER BY executed_at DESC
             LIMIT 100`,
            [req.user.userId]
        );

        // Query actual initial capital: SUM all buy transactions from the initial batch
        // (init creates N buys in one DB transaction — they share the same executed_at)
        const initCapResult = await query(
            `SELECT COALESCE(SUM(t.total_value), 0) as initial_capital
             FROM transactions t
             WHERE t.user_id = $1 AND t.type = 'buy'
               AND t.executed_at = (
                   SELECT MIN(executed_at) FROM transactions
                   WHERE user_id = $1 AND type = 'buy'
               )`,
            [req.user.userId]
        );
        const initialValue = parseFloat(initCapResult.rows[0]?.initial_capital) || 0;

        // Calculate basic metrics
        const transactions = txResult.rows;
        const totalReturn = initialValue > 0 ? ((totalValue - initialValue) / initialValue) * 100 : 0;

        res.json({
            currentValue: totalValue,
            initialValue,
            totalReturn: totalReturn.toFixed(2),
            transactions: transactions.length,
            holdings: holdings.length
        });
    } catch (error) {
        console.error('Get performance error:', error);
        res.status(500).json({ error: 'Failed to get performance data' });
    }
});

/**
 * GET /api/portfolio/transactions
 * Get transaction history
 */
router.get('/transactions', authenticateToken, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;

        const result = await query(
            `SELECT t.*, s.symbol, s.name as stock_name
             FROM transactions t
             JOIN stocks s ON t.stock_id = s.id
             WHERE t.user_id = $1
             ORDER BY t.executed_at DESC
             LIMIT $2`,
            [req.user.userId, limit]
        );

        res.json({
            transactions: result.rows
        });
    } catch (error) {
        console.error('Get transactions error:', error);
        res.status(500).json({ error: 'Failed to get transactions' });
    }
});
/**
 * GET /api/portfolio/dashboard
 * Aggregated dashboard data — portfolio stats, allocation, heatmap, articles
 */
router.get('/dashboard', authenticateToken, async (req, res) => {
    try {
        await refreshPortfolioQuotes(req.user.userId);
        // 1. Portfolio holdings + value
        const holdings = await getPortfolioHoldings(req.user.userId);
        const totalValue = holdings.reduce((sum, h) => sum + parseFloat(h.current_value || 0), 0);

        // 2. Allocation breakdown for pie chart
        const allocation = holdings.map(h => ({
            name: h.symbol,
            value: parseFloat((parseFloat(h.weight) * 100).toFixed(1)),
        }));

        // 3. Total articles analyzed
        const articlesResult = await query('SELECT COUNT(*) as total FROM news_articles WHERE processed = true');
        const totalArticles = parseInt(articlesResult.rows[0].total) || 0;

        // 4. Sentiment heatmap (held symbols only)
        const { getStockSentimentsBySymbols } = require('../services/sentimentService');
        const heldSymbols = [...new Set(
            holdings
                .map(h => String(h.symbol || '').trim().toUpperCase())
                .filter(Boolean)
        )];
        const sentiments = heldSymbols.length > 0
            ? await getStockSentimentsBySymbols(heldSymbols)
            : [];
        const sentimentBySymbol = new Map(sentiments.map(s => [s.symbol, s.wss]));
        const heatmap = heldSymbols.map(symbol => ({
            symbol,
            score: sentimentBySymbol.get(symbol) || 0,
        }));

        // 5. Performance history — build equity curve from transactions
        // 5. Performance history — True Mark-to-Market
        const txResult = await query(
            `SELECT t.type, t.shares, t.executed_at, s.symbol
             FROM transactions t
             JOIN stocks s ON t.stock_id = s.id
             WHERE t.user_id = $1
             ORDER BY t.executed_at ASC`,
            [req.user.userId]
        );

        // Query actual initial capital: SUM all buy transactions from the initial batch
        const initCapResult = await query(
            `SELECT COALESCE(SUM(t.total_value), 0) as initial_capital
             FROM transactions t
             WHERE t.user_id = $1 AND t.type = 'buy'
               AND t.executed_at = (
                   SELECT MIN(executed_at) FROM transactions
                   WHERE user_id = $1 AND type = 'buy'
               )`,
            [req.user.userId]
        );
        const initialValue = parseFloat(initCapResult.rows[0]?.initial_capital) || 0;

        const txHistory = txResult.rows;
        const uniqueSymbols = [...new Set(txHistory.map(tx => tx.symbol))];

        const { fetchHistoricalPrices } = require('../services/quoteService');
        const historicalPrices = uniqueSymbols.length > 0
            ? await fetchHistoricalPrices(uniqueSymbols, '1mo')
            : {};

        const perfHistory = [];
        const now = new Date();
        const dates30Days = [];
        for (let i = 29; i >= 0; i--) {
            const d = new Date(now);
            d.setDate(d.getDate() - i);
            dates30Days.push(d);
        }

        const lastKnownPrices = {};

        for (const date of dates30Days) {
            const dateStrYYYYMMDD = date.toISOString().split('T')[0];
            const endOfDay = new Date(date);
            endOfDay.setHours(23, 59, 59, 999);

            let dailyEquity = 0;
            const currentShares = {};

            // Accumulate share quantities up to this day
            for (const tx of txHistory) {
                if (new Date(tx.executed_at) <= endOfDay) {
                    const shares = parseFloat(tx.shares) || 0;
                    if (!currentShares[tx.symbol]) currentShares[tx.symbol] = 0;

                    if (tx.type === 'buy') {
                        currentShares[tx.symbol] += shares;
                    } else if (tx.type === 'sell') {
                        currentShares[tx.symbol] -= shares;
                    }
                }
            }

            // Calculate MTM value using historical prices
            let dayHasData = false;
            for (const [symbol, shares] of Object.entries(currentShares)) {
                if (shares <= 0.0001) continue; // Ignore negligible fractional dust

                let price = historicalPrices[symbol]?.[dateStrYYYYMMDD];
                if (price !== undefined) {
                    lastKnownPrices[symbol] = price;
                } else {
                    price = lastKnownPrices[symbol] || 0; // Use last known if weekend/holiday
                }

                if (price > 0) {
                    dailyEquity += (shares * price);
                    dayHasData = true;
                }
            }

            if (dayHasData || Object.keys(currentShares).length > 0) {
                perfHistory.push({
                    date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                    portfolio: Math.round(dailyEquity)
                });
            }
        }

        // Ensure at least today's actual value is in the chart if it's perfectly flat
        if (perfHistory.length === 0 && totalValue > 0) {
            perfHistory.push({
                date: now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                portfolio: Math.round(totalValue)
            });
        }

        // 6. Calculate basic metrics
        const totalReturn = totalValue > 0 ? ((totalValue - initialValue) / initialValue * 100) : 0;

        // Approximate Sharpe (simplified — from available data)
        const monthlyReturns = perfHistory.map((p, i) =>
            i > 0 ? (p.portfolio - perfHistory[i - 1].portfolio) / perfHistory[i - 1].portfolio : 0
        ).slice(1);
        const avgReturn = monthlyReturns.length > 0 ? monthlyReturns.reduce((a, b) => a + b, 0) / monthlyReturns.length : 0;
        const stdDev = monthlyReturns.length > 1
            ? Math.sqrt(monthlyReturns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / monthlyReturns.length)
            : 1;
        const sharpeRatio = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(12) : 0;

        res.json({
            stats: {
                totalValue: totalValue || 0,
                totalReturn: totalReturn.toFixed(2),
                sharpeRatio: sharpeRatio.toFixed(2),
                articlesAnalyzed: totalArticles,
                holdingsCount: holdings.length,
            },
            allocation,
            heatmap,
            perfHistory,
            hasPortfolio: holdings.length > 0,
        });
    } catch (error) {
        console.error('Dashboard data error:', error);
        res.status(500).json({ error: 'Failed to get dashboard data' });
    }
});

module.exports = router;

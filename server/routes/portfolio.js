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
    calculatePortfolioValue
} = require('../services/portfolioService');

const router = express.Router();

/**
 * GET /api/portfolio
 * Get user's portfolio holdings
 */
router.get('/', authenticateToken, async (req, res) => {
    try {
        const holdings = await getPortfolioHoldings(req.user.userId);
        const totalValue = holdings.reduce((sum, h) => sum + parseFloat(h.current_value || 0), 0);

        res.json({
            holdings: holdings.map(h => ({
                symbol: h.symbol,
                name: h.name,
                shares: parseFloat(h.shares),
                currentValue: parseFloat(h.current_value),
                weight: parseFloat(h.weight) * 100,
                sentimentScore: parseFloat(h.sentiment_score),
                signal: h.sentiment_score > 0.2 ? 'bullish' : h.sentiment_score < -0.2 ? 'bearish' : 'neutral'
            })),
            summary: {
                totalValue,
                holdingsCount: holdings.length,
                lastUpdated: holdings[0]?.updated_at || null
            }
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

        // 4. Sentiment heatmap (all stocks)
        const { getAllStockSentiments } = require('../services/sentimentService');
        const sentiments = await getAllStockSentiments();
        const heatmap = sentiments.map(s => ({
            symbol: s.symbol,
            score: s.wss,
        }));

        // 5. Performance history — build equity curve from transactions
        const txResult = await query(
            `SELECT t.type, t.total_value, t.executed_at, s.symbol
             FROM transactions t
             JOIN stocks s ON t.stock_id = s.id
             WHERE t.user_id = $1
             ORDER BY t.executed_at ASC
             LIMIT 200`,
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

        let equity = initialValue;
        const perfHistory = [];
        const txByMonth = {};

        for (const tx of txResult.rows) {
            const date = new Date(tx.executed_at);
            const key = date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
            if (!txByMonth[key]) txByMonth[key] = 0;
            const val = parseFloat(tx.total_value);
            // Handle each transaction type explicitly
            if (tx.type === 'buy') {
                txByMonth[key] -= val;       // Cash out → buy shares
            } else if (tx.type === 'sell') {
                txByMonth[key] += val;       // Cash in  → sell shares
            }
            // 'rebalance' = net-neutral (internal reweighting), no cash flow
        }

        for (const [date, netFlow] of Object.entries(txByMonth)) {
            equity += netFlow;
            perfHistory.push({ date, portfolio: Math.round(equity) });
        }

        // If no transaction history, show flat line at current value (no randomness)
        if (perfHistory.length === 0 && totalValue > 0) {
            const now = new Date();
            perfHistory.push({
                date: now.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
                portfolio: Math.round(totalValue),
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

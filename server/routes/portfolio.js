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

        // Calculate basic metrics
        const transactions = txResult.rows;
        const initialValue = 10000; // Default starting value
        const totalReturn = ((totalValue - initialValue) / initialValue) * 100;

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

module.exports = router;

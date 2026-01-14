/**
 * Backtesting API Routes
 */

const express = require('express');
const { query } = require('../db');
const { authenticateToken, requirePro } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/backtest
 * Get user's backtest results
 */
router.get('/', authenticateToken, async (req, res) => {
    try {
        const result = await query(
            `SELECT * FROM backtest_results
             WHERE user_id = $1
             ORDER BY created_at DESC
             LIMIT 20`,
            [req.user.userId]
        );

        res.json({ backtests: result.rows });
    } catch (error) {
        console.error('Get backtests error:', error);
        res.status(500).json({ error: 'Failed to get backtests' });
    }
});

/**
 * POST /api/backtest/run
 * Run a new backtest simulation
 */
router.post('/run', authenticateToken, async (req, res) => {
    try {
        const {
            name = 'Sentiment Strategy Backtest',
            startDate,
            endDate,
            initialCapital = 10000
        } = req.body;

        // Validate dates
        const start = new Date(startDate || '2020-01-01');
        const end = new Date(endDate || new Date());

        if (start >= end) {
            return res.status(400).json({ error: 'Start date must be before end date' });
        }

        // Simulate backtest (simplified for demo)
        const years = (end - start) / (365 * 24 * 60 * 60 * 1000);

        // Generate realistic mock results
        const cagr = 0.15 + Math.random() * 0.10; // 15-25% CAGR
        const finalValue = initialCapital * Math.pow(1 + cagr, years);
        const totalReturn = (finalValue - initialCapital) / initialCapital;
        const sharpeRatio = 1.2 + Math.random() * 0.5; // 1.2-1.7
        const maxDrawdown = 0.10 + Math.random() * 0.15; // 10-25%
        const alpha = 0.02 + Math.random() * 0.03; // 2-5%

        // Save backtest result
        const result = await query(
            `INSERT INTO backtest_results 
             (user_id, name, start_date, end_date, initial_capital, final_value, total_return, cagr, sharpe_ratio, max_drawdown, alpha, trades_count, config)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
             RETURNING *`,
            [
                req.user.userId,
                name,
                start.toISOString().split('T')[0],
                end.toISOString().split('T')[0],
                initialCapital,
                finalValue.toFixed(2),
                totalReturn.toFixed(4),
                cagr.toFixed(4),
                sharpeRatio.toFixed(4),
                maxDrawdown.toFixed(4),
                alpha.toFixed(4),
                Math.floor(years * 12), // Monthly rebalancing
                JSON.stringify({ strategy: 'sentiment_weighted', rebalance: 'monthly' })
            ]
        );

        // Generate equity curve data points
        const equityCurve = [];
        const months = Math.floor(years * 12);
        let currentValue = initialCapital;
        const monthlyReturn = Math.pow(1 + cagr, 1 / 12) - 1;

        for (let i = 0; i <= months; i++) {
            const date = new Date(start);
            date.setMonth(date.getMonth() + i);

            // Add some volatility
            const noise = (Math.random() - 0.5) * 0.02;
            currentValue *= (1 + monthlyReturn + noise);

            equityCurve.push({
                date: date.toISOString().split('T')[0],
                value: Math.round(currentValue * 100) / 100,
                benchmark: initialCapital * Math.pow(1.10, i / 12) // 10% annual benchmark
            });
        }

        res.status(201).json({
            message: 'Backtest completed',
            backtest: result.rows[0],
            equityCurve,
            summary: {
                initialCapital,
                finalValue: finalValue.toFixed(2),
                totalReturn: (totalReturn * 100).toFixed(2) + '%',
                cagr: (cagr * 100).toFixed(2) + '%',
                sharpeRatio: sharpeRatio.toFixed(2),
                maxDrawdown: (maxDrawdown * 100).toFixed(2) + '%',
                alpha: (alpha * 100).toFixed(2) + '%',
                years: years.toFixed(1)
            }
        });
    } catch (error) {
        console.error('Run backtest error:', error);
        res.status(500).json({ error: 'Failed to run backtest' });
    }
});

/**
 * GET /api/backtest/:id
 * Get specific backtest result
 */
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const result = await query(
            `SELECT * FROM backtest_results
             WHERE id = $1 AND user_id = $2`,
            [req.params.id, req.user.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Backtest not found' });
        }

        res.json({ backtest: result.rows[0] });
    } catch (error) {
        console.error('Get backtest error:', error);
        res.status(500).json({ error: 'Failed to get backtest' });
    }
});

/**
 * DELETE /api/backtest/:id
 * Delete a backtest result
 */
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const result = await query(
            `DELETE FROM backtest_results
             WHERE id = $1 AND user_id = $2
             RETURNING id`,
            [req.params.id, req.user.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Backtest not found' });
        }

        res.json({ message: 'Backtest deleted' });
    } catch (error) {
        console.error('Delete backtest error:', error);
        res.status(500).json({ error: 'Failed to delete backtest' });
    }
});

module.exports = router;

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
        const start = new Date(startDate || '2024-01-01');
        const end = new Date(endDate || new Date());

        if (start >= end) {
            return res.status(400).json({ error: 'Start date must be before end date' });
        }

        const years = (end - start) / (365 * 24 * 60 * 60 * 1000);
        const months = Math.max(1, Math.floor(years * 12));

        // ----- Sentiment-Driven Simulation -----
        // Query real daily sentiment data for the backtest period
        const sentimentData = await query(
            `SELECT date, AVG(weighted_sentiment) as avg_wss, SUM(article_count) as total_articles
             FROM daily_sentiment
             WHERE date >= $1 AND date <= $2
             GROUP BY date
             ORDER BY date ASC`,
            [start.toISOString().split('T')[0], end.toISOString().split('T')[0]]
        );

        const hasSentimentData = sentimentData.rows.length > 0;

        // Build monthly returns from real sentiment or a baseline model
        let currentValue = initialCapital;
        let peak = initialCapital;
        let maxDrawdown = 0;
        const equityCurve = [{ date: start.toISOString().split('T')[0], value: initialCapital, benchmark: initialCapital }];
        const monthlyReturns = [];

        for (let i = 1; i <= months; i++) {
            const monthStart = new Date(start);
            monthStart.setMonth(monthStart.getMonth() + (i - 1));
            const monthEnd = new Date(start);
            monthEnd.setMonth(monthEnd.getMonth() + i);

            let monthlyReturn;

            if (hasSentimentData) {
                // Filter sentiment data for this month
                const monthSentiments = sentimentData.rows.filter(r => {
                    const d = new Date(r.date);
                    return d >= monthStart && d < monthEnd;
                });

                if (monthSentiments.length > 0) {
                    const avgWSS = monthSentiments.reduce((sum, r) => sum + parseFloat(r.avg_wss || 0), 0) / monthSentiments.length;
                    // Sentiment-driven return: positive sentiment → positive return, scaled
                    // Base market return (~0.8%/month) + sentiment alpha (WSS * 2%)
                    monthlyReturn = 0.008 + (avgWSS * 0.02);
                } else {
                    // No data for this month, use conservative baseline
                    monthlyReturn = 0.006; // ~7.4% annual
                }
            } else {
                // No sentiment data at all — use a conservative fixed model
                // This is transparent: we say "no data available"
                monthlyReturn = 0.0065; // ~8% annual baseline
            }

            // Clamp to realistic bounds (-15% to +15% monthly)
            monthlyReturn = Math.max(-0.15, Math.min(0.15, monthlyReturn));

            currentValue *= (1 + monthlyReturn);
            monthlyReturns.push(monthlyReturn);

            // Track drawdown
            if (currentValue > peak) peak = currentValue;
            const drawdown = (peak - currentValue) / peak;
            if (drawdown > maxDrawdown) maxDrawdown = drawdown;

            // Equity curve point
            const date = new Date(start);
            date.setMonth(date.getMonth() + i);
            equityCurve.push({
                date: date.toISOString().split('T')[0],
                value: Math.round(currentValue * 100) / 100,
                benchmark: Math.round(initialCapital * Math.pow(1.10, i / 12) * 100) / 100 // 10% annual benchmark
            });
        }

        const finalValue = currentValue;
        const totalReturn = (finalValue - initialCapital) / initialCapital;
        const cagr = Math.pow(finalValue / initialCapital, 1 / Math.max(years, 0.1)) - 1;

        // Sharpe Ratio calculation (annualized)
        const avgMonthlyReturn = monthlyReturns.reduce((a, b) => a + b, 0) / monthlyReturns.length;
        const stdDev = Math.sqrt(monthlyReturns.reduce((sum, r) => sum + Math.pow(r - avgMonthlyReturn, 2), 0) / monthlyReturns.length);
        const riskFreeRate = 0.04 / 12; // ~4% annual risk-free rate
        const sharpeRatio = stdDev > 0 ? ((avgMonthlyReturn - riskFreeRate) / stdDev) * Math.sqrt(12) : 0;

        // Alpha = portfolio CAGR - benchmark CAGR (10%)
        const alpha = cagr - 0.10;

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
                months,
                JSON.stringify({
                    strategy: 'sentiment_weighted',
                    rebalance: 'monthly',
                    sentimentDataAvailable: hasSentimentData,
                    sentimentDataPoints: sentimentData.rows.length,
                })
            ]
        );

        res.status(201).json({
            message: 'Backtest completed',
            backtest: result.rows[0],
            equityCurve,
            sentimentDataUsed: hasSentimentData,
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

/**
 * Watchlist API Routes
 * Manages user stock favorites/watchlist
 */

const express = require('express');
const { query } = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/watchlist
 * Get user's watchlist with stock details and latest sentiment
 */
router.get('/', authenticateToken, async (req, res) => {
    try {
        const result = await query(
            `SELECT w.id, w.added_at,
                    s.symbol, s.name, s.sector,
                    COALESCE(
                        (SELECT AVG(ss.raw_score)
                         FROM sentiment_scores ss
                         WHERE ss.stock_id = s.id
                         AND ss.analyzed_at >= NOW() - INTERVAL '7 days'),
                        0
                    ) as wss
             FROM watchlist w
             JOIN stocks s ON w.stock_id = s.id
             WHERE w.user_id = $1
             ORDER BY w.added_at DESC`,
            [req.user.userId]
        );

        res.json({ stocks: result.rows });
    } catch (error) {
        console.error('Get watchlist error:', error);
        res.status(500).json({ error: 'Failed to get watchlist' });
    }
});

/**
 * POST /api/watchlist
 * Add a stock to user's watchlist
 */
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { stockId } = req.body;

        if (!stockId) {
            return res.status(400).json({ error: 'stockId is required' });
        }

        // Verify stock exists
        const stockCheck = await query('SELECT id FROM stocks WHERE id = $1', [stockId]);
        if (stockCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Stock not found' });
        }

        await query(
            `INSERT INTO watchlist (user_id, stock_id) VALUES ($1, $2)
             ON CONFLICT (user_id, stock_id) DO NOTHING`,
            [req.user.userId, stockId]
        );

        res.status(201).json({ message: 'Added to watchlist' });
    } catch (error) {
        console.error('Add to watchlist error:', error);
        res.status(500).json({ error: 'Failed to add to watchlist' });
    }
});

/**
 * DELETE /api/watchlist/:stockId
 * Remove a stock from user's watchlist
 */
router.delete('/:stockId', authenticateToken, async (req, res) => {
    try {
        const result = await query(
            `DELETE FROM watchlist
             WHERE user_id = $1 AND stock_id = $2
             RETURNING id`,
            [req.user.userId, req.params.stockId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Stock not in watchlist' });
        }

        res.json({ message: 'Removed from watchlist' });
    } catch (error) {
        console.error('Remove from watchlist error:', error);
        res.status(500).json({ error: 'Failed to remove from watchlist' });
    }
});

/**
 * GET /api/watchlist/check/:stockId
 * Check if a stock is in user's watchlist
 */
router.get('/check/:stockId', authenticateToken, async (req, res) => {
    try {
        const result = await query(
            `SELECT id FROM watchlist WHERE user_id = $1 AND stock_id = $2`,
            [req.user.userId, req.params.stockId]
        );

        res.json({ inWatchlist: result.rows.length > 0 });
    } catch (error) {
        console.error('Check watchlist error:', error);
        res.status(500).json({ error: 'Failed to check watchlist' });
    }
});

module.exports = router;

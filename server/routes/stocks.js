/**
 * Stocks API Routes
 */

const express = require('express');
const { query } = require('../db');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { searchInstruments, syncInstrumentMaster } = require('../services/instrumentService');

const router = express.Router();

/**
 * GET /api/stocks
 * Get all tracked stocks
 */
router.get('/', async (req, res) => {
    try {
        const result = await query(
            `SELECT s.*, 
                    COALESCE(
                        (SELECT COUNT(*) FROM sentiment_scores ss WHERE ss.stock_id = s.id),
                        0
                    ) as sentiment_count
             FROM stocks s
             WHERE s.is_active = true
             ORDER BY s.symbol`
        );

        res.json({ stocks: result.rows });
    } catch (error) {
        console.error('Get stocks error:', error);
        res.status(500).json({ error: 'Failed to get stocks' });
    }
});

/**
 * GET /api/stocks/search
 * Search NSE instrument master for add/import flows
 */
router.get('/search', async (req, res) => {
    try {
        const q = String(req.query.q || '').trim();
        const exchange = String(req.query.exchange || 'NSE').toUpperCase();
        const limit = parseInt(req.query.limit, 10) || 20;

        if (!q || q.length < 1) {
            return res.status(400).json({ error: 'Query parameter "q" is required' });
        }

        const results = await searchInstruments(q, exchange, limit);

        res.json({
            results,
            exchange,
            count: results.length,
        });
    } catch (error) {
        console.error('Search stocks error:', error);
        res.status(500).json({ error: 'Failed to search stocks' });
    }
});

/**
 * GET /api/stocks/:symbol
 * Get specific stock details
 */
router.get('/:symbol', async (req, res) => {
    try {
        const { symbol } = req.params;

        const result = await query(
            `SELECT * FROM stocks WHERE symbol = $1`,
            [symbol.toUpperCase()]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Stock not found' });
        }

        res.json({ stock: result.rows[0] });
    } catch (error) {
        console.error('Get stock error:', error);
        res.status(500).json({ error: 'Failed to get stock' });
    }
});

/**
 * POST /api/stocks/sync-instruments
 * Admin-only manual instrument sync
 */
router.post('/sync-instruments', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const result = await syncInstrumentMaster();
        res.json({
            message: 'Instrument sync complete',
            ...result,
        });
    } catch (error) {
        console.error('Sync instruments error:', error);
        res.status(500).json({ error: 'Failed to sync instrument master' });
    }
});

/**
 * POST /api/stocks
 * Add a new stock to track
 */
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { symbol, name, sector } = req.body;

        if (!symbol || !name) {
            return res.status(400).json({ error: 'Symbol and name are required' });
        }

        const result = await query(
            `INSERT INTO stocks (symbol, name, sector)
             VALUES ($1, $2, $3)
             RETURNING *`,
            [symbol.toUpperCase(), name, sector || null]
        );

        res.status(201).json({
            message: 'Stock added',
            stock: result.rows[0]
        });
    } catch (error) {
        if (error.message.includes('duplicate')) {
            return res.status(409).json({ error: 'Stock already exists' });
        }
        console.error('Add stock error:', error);
        res.status(500).json({ error: 'Failed to add stock' });
    }
});

module.exports = router;

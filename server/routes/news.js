/**
 * News API Routes
 */

const express = require('express');
const { query } = require('../db');
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const { runAllScrapers, detectStockMentions } = require('../scrapers/newsScraper');

const router = express.Router();

/**
 * GET /api/news
 * Get recent news articles
 */
router.get('/', optionalAuth, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 20;
        const offset = parseInt(req.query.offset) || 0;
        const source = req.query.source;

        let queryText = `
            SELECT na.id, na.source, na.title, na.url, na.published_at, na.processed,
                   COALESCE(
                       (SELECT json_agg(json_build_object('symbol', s.symbol, 'sentiment', ss.sentiment, 'confidence', ss.confidence))
                        FROM sentiment_scores ss
                        JOIN stocks s ON ss.stock_id = s.id
                        WHERE ss.article_id = na.id),
                       '[]'::json
                   ) as sentiments
            FROM news_articles na
        `;

        const params = [];

        if (source) {
            queryText += ` WHERE na.source = $1`;
            params.push(source);
        }

        queryText += ` ORDER BY na.published_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(limit, offset);

        const result = await query(queryText, params);

        // Get total count
        const countResult = await query(
            'SELECT COUNT(*) as total FROM news_articles' + (source ? ' WHERE source = $1' : ''),
            source ? [source] : []
        );

        res.json({
            articles: result.rows,
            pagination: {
                limit,
                offset,
                total: parseInt(countResult.rows[0].total)
            }
        });
    } catch (error) {
        console.error('Get news error:', error);
        res.status(500).json({ error: 'Failed to get news' });
    }
});

/**
 * GET /api/news/sources
 * Get available news sources
 */
router.get('/sources', async (req, res) => {
    try {
        const result = await query(
            `SELECT source, COUNT(*) as count, MAX(published_at) as latest
             FROM news_articles
             GROUP BY source
             ORDER BY count DESC`
        );

        res.json({ sources: result.rows });
    } catch (error) {
        console.error('Get sources error:', error);
        res.status(500).json({ error: 'Failed to get sources' });
    }
});

/**
 * POST /api/news/scrape
 * Trigger news scraping
 */
router.post('/scrape', authenticateToken, async (req, res) => {
    try {
        const result = await runAllScrapers();

        res.json({
            message: 'Scraping complete',
            ...result
        });
    } catch (error) {
        console.error('Scrape error:', error);
        res.status(500).json({ error: 'Scraping failed' });
    }
});

/**
 * GET /api/news/stock/:symbol
 * Get news for specific stock
 */
router.get('/stock/:symbol', async (req, res) => {
    try {
        const { symbol } = req.params;
        const limit = parseInt(req.query.limit) || 20;

        const result = await query(
            `SELECT na.*, ss.sentiment, ss.confidence
             FROM news_articles na
             JOIN sentiment_scores ss ON ss.article_id = na.id
             JOIN stocks s ON ss.stock_id = s.id
             WHERE s.symbol = $1
             ORDER BY na.published_at DESC
             LIMIT $2`,
            [symbol.toUpperCase(), limit]
        );

        res.json({
            symbol: symbol.toUpperCase(),
            articles: result.rows
        });
    } catch (error) {
        console.error('Get stock news error:', error);
        res.status(500).json({ error: 'Failed to get stock news' });
    }
});

/**
 * GET /api/news/live
 * Get live news feed (most recent)
 */
router.get('/live', async (req, res) => {
    try {
        const result = await query(
            `SELECT na.id, na.source, na.title, na.url, na.published_at,
                    ss.sentiment, ss.confidence, s.symbol
             FROM news_articles na
             LEFT JOIN sentiment_scores ss ON ss.article_id = na.id
             LEFT JOIN stocks s ON ss.stock_id = s.id
             WHERE na.published_at >= NOW() - INTERVAL '24 hours'
             ORDER BY na.published_at DESC
             LIMIT 50`
        );

        res.json({
            articles: result.rows,
            count: result.rows.length,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Get live news error:', error);
        res.status(500).json({ error: 'Failed to get live news' });
    }
});

module.exports = router;

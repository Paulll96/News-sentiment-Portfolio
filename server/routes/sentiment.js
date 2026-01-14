/**
 * Sentiment API Routes
 */

const express = require('express');
const { query } = require('../db');
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const { getAllStockSentiments, analyzeUnprocessedArticles, calculateWSS } = require('../services/sentimentService');

const router = express.Router();

/**
 * GET /api/sentiment
 * Get sentiment scores for all stocks
 */
router.get('/', optionalAuth, async (req, res) => {
    try {
        const sentiments = await getAllStockSentiments();

        // Free tier: limit to 5 stocks
        const limit = req.user?.tier === 'pro' ? sentiments.length : 5;

        res.json({
            sentiments: sentiments.slice(0, limit),
            total: sentiments.length,
            limited: limit < sentiments.length,
            updated_at: new Date().toISOString()
        });
    } catch (error) {
        console.error('Get sentiments error:', error);
        res.status(500).json({ error: 'Failed to get sentiment data' });
    }
});

/**
 * GET /api/sentiment/:symbol
 * Get sentiment for specific stock
 */
router.get('/:symbol', async (req, res) => {
    try {
        const { symbol } = req.params;
        const days = parseInt(req.query.days) || 7;

        // Get stock ID
        const stockResult = await query(
            'SELECT id, symbol, name FROM stocks WHERE symbol = $1',
            [symbol.toUpperCase()]
        );

        if (stockResult.rows.length === 0) {
            return res.status(404).json({ error: 'Stock not found' });
        }

        const stock = stockResult.rows[0];
        const { wss, articleCount } = await calculateWSS(stock.id, days);

        // Get recent sentiment scores
        const scoresResult = await query(
            `SELECT ss.sentiment, ss.confidence, ss.raw_score, ss.analyzed_at, na.title
             FROM sentiment_scores ss
             JOIN news_articles na ON ss.article_id = na.id
             WHERE ss.stock_id = $1
             ORDER BY ss.analyzed_at DESC
             LIMIT 20`,
            [stock.id]
        );

        res.json({
            stock: {
                symbol: stock.symbol,
                name: stock.name
            },
            wss,
            articleCount,
            signal: wss > 0.2 ? 'bullish' : wss < -0.2 ? 'bearish' : 'neutral',
            days,
            recentScores: scoresResult.rows
        });
    } catch (error) {
        console.error('Get stock sentiment error:', error);
        res.status(500).json({ error: 'Failed to get stock sentiment' });
    }
});

/**
 * POST /api/sentiment/analyze
 * Trigger sentiment analysis for unprocessed articles
 */
router.post('/analyze', authenticateToken, async (req, res) => {
    try {
        const analyzed = await analyzeUnprocessedArticles();
        res.json({
            message: 'Analysis complete',
            analyzed
        });
    } catch (error) {
        console.error('Analyze error:', error);
        res.status(500).json({ error: 'Analysis failed' });
    }
});

/**
 * GET /api/sentiment/history/:symbol
 * Get historical sentiment data for charting
 */
router.get('/history/:symbol', async (req, res) => {
    try {
        const { symbol } = req.params;
        const days = parseInt(req.query.days) || 30;

        const result = await query(
            `SELECT ds.date, ds.avg_sentiment, ds.weighted_sentiment, ds.article_count,
                    ds.positive_count, ds.negative_count, ds.neutral_count
             FROM daily_sentiment ds
             JOIN stocks s ON ds.stock_id = s.id
             WHERE s.symbol = $1
             AND ds.date >= CURRENT_DATE - INTERVAL '${days} days'
             ORDER BY ds.date ASC`,
            [symbol.toUpperCase()]
        );

        res.json({
            symbol: symbol.toUpperCase(),
            days,
            history: result.rows
        });
    } catch (error) {
        console.error('Get sentiment history error:', error);
        res.status(500).json({ error: 'Failed to get sentiment history' });
    }
});

module.exports = router;

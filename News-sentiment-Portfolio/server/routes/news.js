/**
 * News API Routes
 */

const express = require('express');
const { query } = require('../db');
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const { runAllScrapers, detectStockMentions } = require('../scrapers/newsScraper');
const {
    isGoogleNewsUrl,
    isResolvedPublisherUrl,
    resolveGoogleNewsUrl,
    buildNewsSearchFallbackUrl,
} = require('../services/googleNewsResolver');

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
 * GET /api/news/open/:id
 * Redirect to the best-known article URL, with Google News fallback resolution.
 */
router.get('/open/:id', async (req, res) => {
    try {
        const articleId = String(req.params.id || '').trim();
        if (!articleId) {
            return res.status(400).type('html').send('<h1>Invalid article</h1><p>Missing article id.</p>');
        }

        const result = await query(
            `SELECT id, title, url
             FROM news_articles
             WHERE id = $1
             LIMIT 1`,
            [articleId]
        );

        if (result.rows.length === 0) {
            return res.status(404).type('html').send('<h1>Article not found</h1><p>This news item no longer exists.</p>');
        }

        const article = result.rows[0];
        let targetUrl = String(article.url || '').trim();

        if (!targetUrl) {
            return res.redirect(302, buildNewsSearchFallbackUrl(article.title));
        }

        if (isGoogleNewsUrl(targetUrl)) {
            const resolvedUrl = await resolveGoogleNewsUrl(targetUrl);
            if (isResolvedPublisherUrl(resolvedUrl)) {
                targetUrl = resolvedUrl;

                try {
                    const duplicate = await query(
                        'SELECT id FROM news_articles WHERE url = $1 AND id != $2 LIMIT 1',
                        [resolvedUrl, article.id]
                    );

                    if (duplicate.rows.length === 0) {
                        await query(
                            'UPDATE news_articles SET url = $1 WHERE id = $2',
                            [resolvedUrl, article.id]
                        );
                    }
                } catch (updateError) {
                    console.warn(`Best-effort article URL update failed for ${article.id}: ${updateError.message}`);
                }
            }
        }

        if (!isResolvedPublisherUrl(targetUrl)) {
            // This captures broken Google News links (the 400 error sources).
            return res.redirect(302, buildNewsSearchFallbackUrl(article.title));
        }

        // This allows normal links (Reddit, Yahoo, specific publisher links) right through!
        return res.redirect(302, targetUrl);
    } catch (error) {
        console.error('Open news article error:', error);
        return res.status(500).type('html').send('<h1>Unable to open article</h1><p>An unexpected error occurred while resolving this link.</p>');
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

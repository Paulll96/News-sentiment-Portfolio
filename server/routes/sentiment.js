/**
 * Sentiment API Routes
 */

const express = require('express');
const { query } = require('../db');
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const {
    getAllStockSentiments,
    getStockSentimentsBySymbols,
    analyzeUnprocessedArticles,
    calculateWSS,
    classifySignal
} = require('../services/sentimentService');

const router = express.Router();

/**
 * GET /api/sentiment
 * Get sentiment scores for all stocks
 */
router.get('/', optionalAuth, async (req, res) => {
    try {
        const days = parseInt(req.query.days) || 7;
        const scope = String(req.query.scope || 'market').trim().toLowerCase();
        const includeIndiaRaw = req.query.includeIndia;
        const includeIndia = includeIndiaRaw === undefined
            ? false
            : String(includeIndiaRaw).trim().toLowerCase() === 'true';
        const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 200, 10), 500);

        if (scope === 'portfolio') {
            if (!req.user?.userId) {
                return res.status(401).json({ error: 'Authentication required for portfolio scope' });
            }

            const holdingsResult = await query(
                `SELECT DISTINCT s.symbol, s.name, s.exchange, s.country
                 FROM portfolio_holdings ph
                 JOIN stocks s ON ph.stock_id = s.id
                 WHERE ph.user_id = $1`,
                [req.user.userId]
            );

            const symbolNameMap = new Map(
                holdingsResult.rows.map(r => [
                    String(r.symbol || '').trim().toUpperCase(),
                    String(r.name || '').trim() || String(r.symbol || '').trim().toUpperCase()
                ])
            );
            const symbolMetaMap = new Map(
                holdingsResult.rows.map(r => [
                    String(r.symbol || '').trim().toUpperCase(),
                    {
                        exchange: String(r.exchange || '').trim().toUpperCase() || 'NSE',
                        country: String(r.country || '').trim().toUpperCase() || 'IN',
                    }
                ])
            );

            const heldSymbols = [...new Set(
                holdingsResult.rows
                    .map(r => String(r.symbol || '').trim().toUpperCase())
                    .filter(Boolean)
            )];

            let orderedSymbols = [...heldSymbols];

            if (includeIndia) {
                const maxExtra = 20;
                const nseCandidates = await query(
                    `SELECT s.symbol,
                            s.name,
                            COUNT(*)::int AS article_count,
                            AVG(ss.raw_score) AS avg_score
                     FROM stocks s
                     JOIN sentiment_scores ss ON ss.stock_id = s.id
                     WHERE s.exchange = 'NSE'
                       AND ss.analyzed_at >= NOW() - ($1 || ' days')::interval
                     GROUP BY s.symbol, s.name
                     ORDER BY article_count DESC, ABS(AVG(ss.raw_score)) DESC
                     LIMIT 40`,
                    [String(days)]
                );

                const extraSymbols = [];
                for (const row of nseCandidates.rows) {
                    const symbol = String(row.symbol || '').trim().toUpperCase();
                    if (!symbol || heldSymbols.includes(symbol) || extraSymbols.includes(symbol)) continue;
                    extraSymbols.push(symbol);
                    symbolNameMap.set(symbol, String(row.name || '').trim() || symbol);
                    if (extraSymbols.length >= maxExtra) break;
                }

                // Also include scored global symbols (outside holdings and outside NSE) so scope stays useful.
                const globalCandidates = await query(
                    `SELECT s.symbol,
                            s.name,
                            s.exchange,
                            s.country,
                            COUNT(*)::int AS article_count,
                            AVG(ss.raw_score) AS avg_score
                     FROM stocks s
                     JOIN sentiment_scores ss ON ss.stock_id = s.id
                     WHERE ss.analyzed_at >= NOW() - ($1 || ' days')::interval
                     GROUP BY s.symbol, s.name, s.exchange, s.country
                     ORDER BY article_count DESC, ABS(AVG(ss.raw_score)) DESC
                     LIMIT 80`,
                    [String(days)]
                );

                for (const row of globalCandidates.rows) {
                    const symbol = String(row.symbol || '').trim().toUpperCase();
                    if (!symbol || heldSymbols.includes(symbol) || extraSymbols.includes(symbol)) continue;
                    extraSymbols.push(symbol);
                    symbolNameMap.set(symbol, String(row.name || '').trim() || symbol);
                    symbolMetaMap.set(symbol, {
                        exchange: String(row.exchange || '').trim().toUpperCase() || '-',
                        country: String(row.country || '').trim().toUpperCase() || '-',
                    });
                    if (extraSymbols.length >= maxExtra) break;
                }

                orderedSymbols = [...heldSymbols, ...extraSymbols];
            }

            if (orderedSymbols.length === 0) {
                return res.json({
                    sentiments: [],
                    total: 0,
                    limited: false,
                    scope: 'portfolio',
                    includeIndia,
                    updated_at: new Date().toISOString()
                });
            }

            const sentiments = await getStockSentimentsBySymbols(orderedSymbols, days);
            const bySymbol = new Map(sentiments.map(s => [s.symbol, s]));

            const portfolioSentiments = orderedSymbols.map(symbol => {
                const found = bySymbol.get(symbol);
                if (found && parseInt(found.articleCount || 0, 10) > 0) {
                    return { ...found, isTracked: true, hasData: true };
                }
                if (found) {
                    return {
                        ...found,
                        wss: null,
                        signal: 'neutral',
                        isTracked: true,
                        hasData: false,
                    };
                }
                return {
                    symbol,
                    name: symbolNameMap.get(symbol) || symbol,
                    exchange: symbolMetaMap.get(symbol)?.exchange || 'NSE',
                    country: symbolMetaMap.get(symbol)?.country || 'IN',
                    wss: null,
                    articleCount: 0,
                    signal: 'neutral',
                    isTracked: heldSymbols.includes(symbol),
                    hasData: false,
                };
            });

            return res.json({
                sentiments: portfolioSentiments,
                total: portfolioSentiments.length,
                limited: false,
                scope: 'portfolio',
                includeIndia,
                updated_at: new Date().toISOString()
            });
        }

        const sentiments = await getAllStockSentiments(days);
        let marketSentiments = sentiments
            .filter(s => parseInt(s.articleCount || 0, 10) > 0)
            .sort((a, b) => parseInt(b.articleCount || 0, 10) - parseInt(a.articleCount || 0, 10))
            .map(s => ({ ...s, isTracked: true, hasData: true }));

        marketSentiments = marketSentiments.slice(0, limit);

        res.json({
            sentiments: marketSentiments,
            total: marketSentiments.length,
            limited: false,
            scope: 'market',
            includeIndia,
            updated_at: new Date().toISOString()
        });
    } catch (error) {
        console.error('Get sentiments error:', error);
        res.status(500).json({ error: 'Failed to get sentiment data' });
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
             AND ds.date >= CURRENT_DATE - ($2 || ' days')::interval
             ORDER BY ds.date ASC`,
            [symbol.toUpperCase(), String(days)]
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
            signal: classifySignal(wss),
            days,
            recentScores: scoresResult.rows
        });
    } catch (error) {
        console.error('Get stock sentiment error:', error);
        res.status(500).json({ error: 'Failed to get stock sentiment' });
    }
});

module.exports = router;

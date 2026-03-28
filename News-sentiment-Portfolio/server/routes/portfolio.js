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
    calculatePortfolioValue,
    refreshPortfolioQuotes,
    addHolding,
    removeHolding,
    importHoldings
} = require('../services/portfolioService');
const { classifySignal } = require('../services/sentimentService');

const router = express.Router();

/**
 * GET /api/portfolio
 * Get user's portfolio holdings
 */
router.get('/', authenticateToken, async (req, res) => {
    try {
        await refreshPortfolioQuotes(req.user.userId);
        const holdings = await getPortfolioHoldings(req.user.userId);
        const totalValue = holdings.reduce((sum, h) => sum + parseFloat(h.current_value || 0), 0);

        res.json({
            holdings: holdings.map(h => ({
                symbol: h.symbol,
                name: h.name,
                exchange: h.exchange,
                currency: h.currency || 'INR',
                shares: parseFloat(h.shares),
                avgCost: h.avg_cost !== null ? parseFloat(h.avg_cost) : null,
                currentValue: parseFloat(h.current_value),
                weight: parseFloat(h.weight) * 100,
                sentimentScore: parseFloat(h.sentiment_score),
                signal: classifySignal(h.sentiment_score)
            })),
            summary: {
                totalValue,
                holdingsCount: holdings.length,
                lastUpdated: holdings[0]?.updated_at || null,
                currency: 'INR',
            },
            currency: 'INR',
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
 * POST /api/portfolio/holdings
 * Add or increase a holding manually
 */
router.post('/holdings', authenticateToken, async (req, res) => {
    try {
        const result = await addHolding(req.user.userId, req.body || {});

        if (result.error) {
            return res.status(400).json(result);
        }

        res.status(201).json(result);
    } catch (error) {
        console.error('Add holding error:', error);
        res.status(500).json({ error: 'Failed to add holding' });
    }
});

/**
 * DELETE /api/portfolio/holdings/:symbol
 * Sell all shares and remove the holding from portfolio
 */
router.delete('/holdings/:symbol', authenticateToken, async (req, res) => {
    try {
        const symbol = String(req.params.symbol || '').trim();
        if (!symbol) {
            return res.status(400).json({ error: 'Symbol is required' });
        }

        // Best-effort refresh to improve sell ledger valuation.
        try {
            await refreshPortfolioQuotes(req.user.userId, { maxAgeMinutes: 0 });
        } catch {
            // Ignore refresh failures and continue with fallback valuation.
        }

        const result = await removeHolding(req.user.userId, symbol);

        if (result.error) {
            const status = result.error.toLowerCase().includes('not found') ? 404 : 400;
            return res.status(status).json({ error: result.error });
        }

        res.json(result);
    } catch (error) {
        console.error('Remove holding error:', error);
        res.status(500).json({ error: 'Failed to remove holding' });
    }
});

/**
 * POST /api/portfolio/import
 * Import holdings (dryRun preview by default)
 */
router.post('/import', authenticateToken, async (req, res) => {
    try {
        const result = await importHoldings(req.user.userId, req.body || {});

        if (result.error) {
            return res.status(400).json(result);
        }

        res.json(result);
    } catch (error) {
        console.error('Import holdings error:', error);
        res.status(500).json({ error: 'Failed to import holdings' });
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

        const response = {
            message: dryRun ? 'Rebalance preview (no trades executed)' : 'Rebalance executed',
            ...result
        };

        // On execute, format updated holdings in the same shape as GET /portfolio
        if (!dryRun && result.updatedHoldings) {
            const totalValue = result.updatedHoldings.reduce((sum, h) => sum + parseFloat(h.current_value || 0), 0);
            response.holdings = result.updatedHoldings.map(h => ({
                symbol: h.symbol,
                name: h.name,
                exchange: h.exchange,
                currency: h.currency || 'INR',
                shares: parseFloat(h.shares),
                avgCost: h.avg_cost !== null ? parseFloat(h.avg_cost) : null,
                currentValue: parseFloat(h.current_value),
                weight: parseFloat(h.weight) * 100,
                sentimentScore: parseFloat(h.sentiment_score),
                signal: classifySignal(h.sentiment_score)
            }));
            response.currency = 'INR';
            delete response.updatedHoldings; // Don't send raw DB rows
        }

        res.json(response);
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
        await refreshPortfolioQuotes(req.user.userId);
        const holdings = await getPortfolioHoldings(req.user.userId);
        const totalValue = holdings.reduce((sum, h) => sum + parseFloat(h.current_value || 0), 0);

        // Cost basis from live holdings: sum(shares * avg_cost)
        const costBasis = holdings.reduce((sum, h) => {
            const shares = parseFloat(h.shares || 0);
            const avgCost = parseFloat(h.avg_cost || 0);
            return sum + (shares * avgCost);
        }, 0);

        // Get transactions for history
        const txResult = await query(
            `SELECT type, total_value, executed_at
             FROM transactions
             WHERE user_id = $1
             ORDER BY executed_at DESC
             LIMIT 100`,
            [req.user.userId]
        );

        const transactions = txResult.rows;
        const totalReturn = costBasis > 0 ? ((totalValue - costBasis) / costBasis) * 100 : 0;

        res.json({
            currentValue: totalValue,
            costBasis,
            totalReturn: totalReturn.toFixed(2),
            transactions: transactions.length,
            holdings: holdings.length,
            currency: 'INR',
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
        await refreshPortfolioQuotes(req.user.userId);
        // 1. Portfolio holdings + value
        const holdings = await getPortfolioHoldings(req.user.userId);
        const totalValue = holdings.reduce((sum, h) => sum + parseFloat(h.current_value || 0), 0);

        // 2. Cost basis from live holdings: sum(shares * avg_cost)
        const costBasis = holdings.reduce((sum, h) => {
            const shares = parseFloat(h.shares || 0);
            const avgCost = parseFloat(h.avg_cost || 0);
            return sum + (shares * avgCost);
        }, 0);

        // 3. Allocation breakdown for pie chart
        const allocation = holdings.map(h => ({
            name: h.symbol,
            value: parseFloat((parseFloat(h.weight) * 100).toFixed(1)),
        }));

        // 4. Total articles analyzed
        const articlesResult = await query('SELECT COUNT(*) as total FROM news_articles WHERE processed = true');
        const totalArticles = parseInt(articlesResult.rows[0].total) || 0;

        // 5. Sentiment heatmap (held symbols only)
        const { getStockSentimentsBySymbols } = require('../services/sentimentService');
        const heldSymbols = [...new Set(
            holdings
                .map(h => String(h.symbol || '').trim().toUpperCase())
                .filter(Boolean)
        )];
        const sentiments = heldSymbols.length > 0
            ? await getStockSentimentsBySymbols(heldSymbols)
            : [];
        const sentimentBySymbol = new Map(sentiments.map(s => [s.symbol, s.wss]));
        const heatmap = heldSymbols.map(symbol => ({
            symbol,
            score: sentimentBySymbol.get(symbol) || 0,
        }));

        // 6. Performance history — True Mark-to-Market
        const txResult = await query(
            `SELECT t.type, t.shares, t.executed_at, s.symbol
             FROM transactions t
             JOIN stocks s ON t.stock_id = s.id
             WHERE t.user_id = $1
             ORDER BY t.executed_at ASC`,
            [req.user.userId]
        );

        const txHistory = txResult.rows;
        const uniqueSymbols = [...new Set(txHistory.map(tx => tx.symbol))];

        const { fetchHistoricalPrices } = require('../services/quoteService');
        const historicalPrices = uniqueSymbols.length > 0
            ? await fetchHistoricalPrices(uniqueSymbols, '1mo')
            : {};

        const perfHistory = [];
        const now = new Date();
        const dates30Days = [];
        for (let i = 29; i >= 0; i--) {
            const d = new Date(now);
            d.setDate(d.getDate() - i);
            dates30Days.push(d);
        }

        const lastKnownPrices = {};

        for (const date of dates30Days) {
            const dateStrYYYYMMDD = date.toISOString().split('T')[0];
            const endOfDay = new Date(date);
            endOfDay.setHours(23, 59, 59, 999);

            let dailyEquity = 0;
            const currentShares = {};

            // Accumulate share quantities up to this day
            for (const tx of txHistory) {
                if (new Date(tx.executed_at) <= endOfDay) {
                    const shares = parseFloat(tx.shares) || 0;
                    if (!currentShares[tx.symbol]) currentShares[tx.symbol] = 0;

                    if (tx.type === 'buy') {
                        currentShares[tx.symbol] += shares;
                    } else if (tx.type === 'sell') {
                        currentShares[tx.symbol] -= shares;
                    }
                }
            }

            // Calculate MTM value using historical prices
            let dayHasValidPrice = false;
            for (const [symbol, shares] of Object.entries(currentShares)) {
                if (shares <= 0.0001) continue; // Ignore negligible fractional dust

                let price = historicalPrices[symbol]?.[dateStrYYYYMMDD];
                if (price !== undefined && price > 0) {
                    lastKnownPrices[symbol] = price;
                    dayHasValidPrice = true;
                } else {
                    price = lastKnownPrices[symbol] || 0; // Use last known if weekend/holiday
                    if (price > 0) dayHasValidPrice = true;
                }

                if (price > 0) {
                    dailyEquity += (shares * price);
                }
            }

            // Only include days where we have real price data
            if (dayHasValidPrice && dailyEquity > 0) {
                perfHistory.push({
                    date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                    portfolio: Math.round(dailyEquity)
                });
            }
        }

        // Ensure at least today's actual value is in the chart
        if (perfHistory.length === 0 && totalValue > 0) {
            perfHistory.push({
                date: now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                portfolio: Math.round(totalValue)
            });
        }

        // 7. Calculate Total Return from cost basis
        const totalReturn = costBasis > 0 ? ((totalValue - costBasis) / costBasis * 100) : 0;

        // 8. Sharpe Ratio — only from valid daily equity points with non-zero prices
        // Need at least 3 valid data points to compute a meaningful ratio
        let sharpeRatio = null;
        if (perfHistory.length >= 3) {
            const dailyReturns = perfHistory
                .map((p, i) => i > 0 && perfHistory[i - 1].portfolio > 0
                    ? (p.portfolio - perfHistory[i - 1].portfolio) / perfHistory[i - 1].portfolio
                    : null)
                .filter(r => r !== null);

            if (dailyReturns.length >= 2) {
                const avgReturn = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length;
                const stdDev = Math.sqrt(
                    dailyReturns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / dailyReturns.length
                );

                if (stdDev > 0.0001) {
                    // Annualize: sqrt(252) for daily returns
                    sharpeRatio = parseFloat(((avgReturn / stdDev) * Math.sqrt(252)).toFixed(2));
                } else {
                    // Zero volatility — returns are flat, Sharpe is undefined
                    sharpeRatio = null;
                }
            }
        }

        res.json({
            stats: {
                totalValue: totalValue || 0,
                costBasis: costBasis || 0,
                totalReturn: totalReturn.toFixed(2),
                sharpeRatio,
                articlesAnalyzed: totalArticles,
                holdingsCount: holdings.length,
            },
            allocation,
            heatmap,
            perfHistory,
            hasPortfolio: holdings.length > 0,
            currency: 'INR',
        });
    } catch (error) {
        console.error('Dashboard data error:', error);
        res.status(500).json({ error: 'Failed to get dashboard data' });
    }
});

module.exports = router;

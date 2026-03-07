const { query, transaction } = require('../db');
const { getAllStockSentiments, getStockSentimentsBySymbols } = require('./sentimentService');
const { getQuoteForStock, getLiveQuoteBySymbol, getQuotesForStocks } = require('./quoteService');
const { ensureNseSymbolSuffix, findInstrument } = require('./instrumentService');

// Rebalancing parameters
const CONFIG = {
    maxPositionPercent: parseFloat(process.env.MAX_POSITION_PERCENT) || 25,
    rebalanceThreshold: parseFloat(process.env.REBALANCE_THRESHOLD) || 0.05,
    sentimentWeight: 0.6, // 60% sentiment, 40% equal weight
    minSentimentForBuy: 0.15, // Minimum WSS to increase position
    maxSentimentForSell: -0.15, // Maximum WSS before decreasing position
    quoteCacheMinutes: parseInt(process.env.QUOTE_CACHE_MINUTES || '5', 10),
};

/**
 * Calculate target portfolio weights based on sentiment
 * @param {Array} sentiments - Array of {symbol, wss, articleCount, ...}
 * @returns {Object} - { symbol: targetWeight }
 */
function calculateTargetWeights(sentiments) {
    if (!Array.isArray(sentiments) || sentiments.length === 0) {
        return {};
    }

    const activeStocks = sentiments.filter(s => s.articleCount > 0);

    if (activeStocks.length === 0) {
        const equalWeight = 1 / sentiments.length;
        return Object.fromEntries(sentiments.map(s => [s.symbol, equalWeight]));
    }

    // Normalize WSS to positive values for weighting
    const normalizedScores = activeStocks.map(s => ({
        symbol: s.symbol,
        score: (s.wss + 1) / 2, // Convert [-1, 1] to [0, 1]
    }));

    const totalScore = normalizedScores.reduce((sum, s) => sum + s.score, 0);

    // Calculate sentiment-based weights
    const sentimentWeights = {};
    normalizedScores.forEach(s => {
        sentimentWeights[s.symbol] = s.score / totalScore;
    });

    // Blend with equal weight
    const equalWeight = 1 / sentiments.length;
    const targetWeights = {};

    sentiments.forEach(s => {
        const sentWeight = sentimentWeights[s.symbol] || equalWeight;
        const blendedWeight = CONFIG.sentimentWeight * sentWeight +
            (1 - CONFIG.sentimentWeight) * equalWeight;

        // Apply max position limit
        targetWeights[s.symbol] = Math.min(blendedWeight, CONFIG.maxPositionPercent / 100);
    });

    // Normalize to sum to 1
    const totalWeight = Object.values(targetWeights).reduce((a, b) => a + b, 0);
    Object.keys(targetWeights).forEach(symbol => {
        targetWeights[symbol] /= totalWeight;
    });

    return targetWeights;
}

function toUpper(value) {
    return String(value || '').trim().toUpperCase();
}

function toOptionalPositiveNumber(value) {
    if (value === undefined || value === null || value === '') return null;
    const n = parseFloat(value);
    if (!Number.isFinite(n) || n <= 0) return null;
    return n;
}

function normalizeSymbolForExchange(symbol, exchange) {
    const clean = toUpper(symbol);
    if (!clean) return '';
    if (exchange === 'NSE') return ensureNseSymbolSuffix(clean);
    return clean;
}

function parseAndNormalizeHolding(raw, index = 0) {
    const exchange = toUpper(raw.exchange || 'NSE') || 'NSE';
    const symbol = normalizeSymbolForExchange(raw.symbol, exchange);

    if (!symbol) {
        return { ok: false, error: `Row ${index + 1}: symbol is required` };
    }

    const shares = Number(raw.shares);
    if (!Number.isInteger(shares) || shares <= 0) {
        return { ok: false, error: `Row ${index + 1}: shares must be a positive whole number` };
    }

    const avgCost = toOptionalPositiveNumber(raw.avgCost);

    if (raw.avgCost !== undefined && raw.avgCost !== null && raw.avgCost !== '' && avgCost === null) {
        return { ok: false, error: `Row ${index + 1}: avgCost must be a positive number when provided` };
    }

    return {
        ok: true,
        row: {
            symbol,
            exchange,
            shares,
            avgCost,
        },
    };
}

function aggregateRows(rows) {
    const byKey = new Map();

    for (const row of rows) {
        const key = `${row.exchange}|${row.symbol}`;
        const existing = byKey.get(key);

        if (!existing) {
            byKey.set(key, {
                ...row,
                _pricedShares: row.avgCost ? row.shares : 0,
                _pricedCost: row.avgCost ? row.avgCost * row.shares : 0,
            });
            continue;
        }

        existing.shares += row.shares;

        if (row.avgCost) {
            existing._pricedShares += row.shares;
            existing._pricedCost += row.avgCost * row.shares;
        }

        byKey.set(key, existing);
    }

    return [...byKey.values()].map(row => ({
        symbol: row.symbol,
        exchange: row.exchange,
        shares: row.shares,
        avgCost: row._pricedShares > 0 ? (row._pricedCost / row._pricedShares) : null,
    }));
}

function normalizeAndAggregateRows(rawRows) {
    const accepted = [];
    const rejected = [];

    rawRows.forEach((raw, idx) => {
        const normalized = parseAndNormalizeHolding(raw, idx);
        if (!normalized.ok) {
            rejected.push({ row: idx + 1, error: normalized.error, input: raw });
            return;
        }
        accepted.push(normalized.row);
    });

    return {
        rows: aggregateRows(accepted),
        rejected,
    };
}

async function getPortfolioHoldings(userId) {
    const result = await query(
        `SELECT ph.*, s.symbol, s.name, s.exchange, s.country, s.currency
         FROM portfolio_holdings ph
         JOIN stocks s ON ph.stock_id = s.id
         WHERE ph.user_id = $1`,
        [userId]
    );

    return result.rows;
}

async function recalcWeights(client, userId) {
    const result = await client.query(
        `SELECT id, current_value
         FROM portfolio_holdings
         WHERE user_id = $1`,
        [userId]
    );

    const totalValue = result.rows.reduce((sum, row) => sum + parseFloat(row.current_value || 0), 0);

    for (const row of result.rows) {
        const currentValue = parseFloat(row.current_value || 0);
        const weight = totalValue > 0 ? currentValue / totalValue : 0;

        await client.query(
            `UPDATE portfolio_holdings
             SET weight = $2, updated_at = NOW()
             WHERE id = $1`,
            [row.id, weight]
        );
    }

    return totalValue;
}

async function resolveStockRow(row, createIfMissing = false) {
    const existing = await query(
        `SELECT id, symbol, name, exchange, country, currency
         FROM stocks
         WHERE symbol = $1
         LIMIT 1`,
        [row.symbol]
    );

    if (existing.rows.length > 0) {
        return { stock: existing.rows[0], created: false };
    }

    const instrument = await findInstrument(row.symbol, row.exchange);
    if (!instrument) {
        return { stock: null, created: false, reason: 'Symbol not found in instrument master (NSE)' };
    }

    if (!createIfMissing) {
        return {
            stock: {
                id: null,
                symbol: instrument.symbol,
                name: instrument.name,
                exchange: instrument.exchange,
                country: instrument.country,
                currency: instrument.currency,
            },
            created: false,
            wouldCreate: true,
        };
    }

    const inserted = await query(
        `INSERT INTO stocks (symbol, name, sector, exchange, country, currency, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, true)
         ON CONFLICT (symbol)
         DO UPDATE SET
            name = EXCLUDED.name,
            exchange = EXCLUDED.exchange,
            country = EXCLUDED.country,
            currency = EXCLUDED.currency,
            is_active = true
         RETURNING id, symbol, name, exchange, country, currency`,
        [instrument.symbol, instrument.name, null, instrument.exchange, instrument.country, instrument.currency]
    );

    return {
        stock: inserted.rows[0],
        created: true,
        wouldCreate: false,
    };
}

async function evaluateHoldingRows(rawRows, options = {}) {
    const createMissingStocks = Boolean(options.createMissingStocks);
    const normalized = normalizeAndAggregateRows(rawRows || []);
    const accepted = [];
    const rejected = [...normalized.rejected];

    for (const row of normalized.rows) {
        const stockLookup = await resolveStockRow(row, createMissingStocks);

        if (!stockLookup.stock) {
            rejected.push({
                symbol: row.symbol,
                exchange: row.exchange,
                error: stockLookup.reason || 'Unable to resolve stock',
            });
            continue;
        }

        let quote = null;
        if (stockLookup.stock.id) {
            quote = await getQuoteForStock(stockLookup.stock, {
                maxAgeMinutes: CONFIG.quoteCacheMinutes,
            });
        } else {
            quote = await getLiveQuoteBySymbol(stockLookup.stock.symbol, stockLookup.stock.currency || 'INR');
        }

        const fallbackPrice = row.avgCost || null;
        const unitPrice = quote?.price || fallbackPrice;

        if (!unitPrice || unitPrice <= 0) {
            rejected.push({
                symbol: row.symbol,
                exchange: row.exchange,
                error: 'No quote available and avgCost missing',
            });
            continue;
        }

        accepted.push({
            symbol: stockLookup.stock.symbol,
            exchange: stockLookup.stock.exchange,
            stockId: stockLookup.stock.id,
            stockName: stockLookup.stock.name,
            shares: row.shares,
            avgCost: row.avgCost,
            unitPrice,
            value: row.shares * unitPrice,
            quoteSource: quote?.source || (row.avgCost ? 'avg_cost_fallback' : 'unknown'),
            currency: quote?.currency || stockLookup.stock.currency || 'INR',
            wouldCreateStock: Boolean(stockLookup.wouldCreate),
            createdStock: Boolean(stockLookup.created),
        });
    }

    const totalValue = accepted.reduce((sum, h) => sum + h.value, 0);

    return {
        accepted,
        rejected,
        summary: {
            accepted: accepted.length,
            rejected: rejected.length,
            totalValue,
            currency: 'INR',
            wouldCreateStocks: accepted.filter(a => a.wouldCreateStock).length,
        },
    };
}

async function refreshPortfolioQuotes(userId, options = {}) {
    const maxAgeMinutes = Number.isFinite(options.maxAgeMinutes)
        ? options.maxAgeMinutes
        : CONFIG.quoteCacheMinutes;

    const holdings = await query(
        `SELECT ph.id, ph.stock_id, ph.shares, ph.avg_cost, ph.current_value,
                s.id AS stock_row_id, s.symbol, s.currency, s.exchange
         FROM portfolio_holdings ph
         JOIN stocks s ON ph.stock_id = s.id
         WHERE ph.user_id = $1`,
        [userId]
    );

    if (holdings.rows.length === 0) {
        return [];
    }

    const stocks = holdings.rows.map(h => ({
        id: h.stock_row_id,
        symbol: h.symbol,
        currency: h.currency,
        exchange: h.exchange,
    }));

    const quotesById = await getQuotesForStocks(stocks, { maxAgeMinutes });

    await transaction(async (client) => {
        for (const holding of holdings.rows) {
            const quote = quotesById[holding.stock_row_id];
            const shares = parseFloat(holding.shares || 0);
            const avgCost = parseFloat(holding.avg_cost || 0);
            const existingValue = parseFloat(holding.current_value || 0);

            let unitPrice = quote?.price || null;
            if (!unitPrice && avgCost > 0) unitPrice = avgCost;
            if (!unitPrice && shares > 0 && existingValue > 0) unitPrice = existingValue / shares;

            if (!unitPrice || !Number.isFinite(unitPrice) || unitPrice <= 0) {
                continue;
            }

            const newValue = unitPrice * shares;

            await client.query(
                `UPDATE portfolio_holdings
                 SET current_value = $2, updated_at = NOW()
                 WHERE id = $1`,
                [holding.id, newValue]
            );
        }

        await recalcWeights(client, userId);
    });

    return getPortfolioHoldings(userId);
}

async function calculatePortfolioValue(userId) {
    await refreshPortfolioQuotes(userId);
    const holdings = await getPortfolioHoldings(userId);
    return holdings.reduce((total, h) => total + parseFloat(h.current_value || 0), 0);
}

async function addHolding(userId, payload) {
    const evaluation = await evaluateHoldingRows([payload], { createMissingStocks: true });

    if (evaluation.rejected.length > 0 || evaluation.accepted.length === 0) {
        return {
            error: evaluation.rejected[0]?.error || 'Invalid holding payload',
            details: evaluation.rejected,
        };
    }

    const row = evaluation.accepted[0];

    await transaction(async (client) => {
        const existing = await client.query(
            `SELECT id, shares, avg_cost
             FROM portfolio_holdings
             WHERE user_id = $1 AND stock_id = $2
             LIMIT 1`,
            [userId, row.stockId]
        );

        const addedShares = row.shares;
        const addPrice = row.avgCost || row.unitPrice;
        const addValue = addedShares * row.unitPrice;

        if (existing.rows.length > 0) {
            const prevShares = parseFloat(existing.rows[0].shares || 0);
            const prevAvg = parseFloat(existing.rows[0].avg_cost || 0);
            const newShares = prevShares + addedShares;

            let newAvgCost = prevAvg > 0 ? prevAvg : null;
            if (addPrice && addPrice > 0) {
                if (prevShares > 0 && prevAvg > 0) {
                    newAvgCost = ((prevShares * prevAvg) + (addedShares * addPrice)) / newShares;
                } else {
                    newAvgCost = addPrice;
                }
            }

            const newValue = newShares * row.unitPrice;

            await client.query(
                `UPDATE portfolio_holdings
                 SET shares = $3,
                     avg_cost = $4,
                     current_value = $5,
                     updated_at = NOW()
                 WHERE user_id = $1 AND stock_id = $2`,
                [userId, row.stockId, newShares, newAvgCost, newValue]
            );
        } else {
            await client.query(
                `INSERT INTO portfolio_holdings (user_id, stock_id, shares, avg_cost, current_value, weight, sentiment_score)
                 VALUES ($1, $2, $3, $4, $5, 0, 0)
                 ON CONFLICT (user_id, stock_id)
                 DO UPDATE SET shares = EXCLUDED.shares,
                               avg_cost = EXCLUDED.avg_cost,
                               current_value = EXCLUDED.current_value,
                               updated_at = NOW()`,
                [userId, row.stockId, addedShares, addPrice || null, addValue]
            );
        }

        await client.query(
            `INSERT INTO transactions (user_id, stock_id, type, shares, price, total_value, reason)
             VALUES ($1, $2, 'buy', $3, $4, $5, $6)`,
            [userId, row.stockId, addedShares, addPrice || row.unitPrice, addValue, 'Manual portfolio add']
        );

        await recalcWeights(client, userId);
    });

    const holdings = await getPortfolioHoldings(userId);
    const holding = holdings.find(h => h.symbol === row.symbol);

    return {
        message: 'Holding added',
        holding,
    };
}

async function importHoldings(userId, payload) {
    const dryRun = payload?.dryRun !== false;
    const mode = String(payload?.mode || 'replace').toLowerCase();
    const source = String(payload?.source || 'api').toLowerCase();
    const holdings = Array.isArray(payload?.holdings) ? payload.holdings : [];

    if (mode !== 'replace') {
        return { error: 'Only replace mode is supported in this release' };
    }

    const evaluation = await evaluateHoldingRows(holdings, { createMissingStocks: !dryRun });

    if (dryRun) {
        return {
            dryRun: true,
            imported: evaluation.accepted.length,
            rejected: evaluation.rejected.length,
            accepted: evaluation.accepted,
            rejectedRows: evaluation.rejected,
            summary: evaluation.summary,
        };
    }

    await transaction(async (client) => {
        await client.query('DELETE FROM portfolio_holdings WHERE user_id = $1', [userId]);
        await client.query('DELETE FROM transactions WHERE user_id = $1', [userId]);

        const totalValue = evaluation.accepted.reduce((sum, h) => sum + h.value, 0);

        for (const row of evaluation.accepted) {
            const weight = totalValue > 0 ? row.value / totalValue : 0;
            const avgCost = row.avgCost || row.unitPrice;

            await client.query(
                `INSERT INTO portfolio_holdings (user_id, stock_id, shares, avg_cost, current_value, weight, sentiment_score)
                 VALUES ($1, $2, $3, $4, $5, $6, 0)`,
                [userId, row.stockId, row.shares, avgCost, row.value, weight]
            );

            await client.query(
                `INSERT INTO transactions (user_id, stock_id, type, shares, price, total_value, reason)
                 VALUES ($1, $2, 'buy', $3, $4, $5, $6)`,
                [userId, row.stockId, row.shares, avgCost, row.value, `Imported via ${source}`]
            );
        }
    });

    await refreshPortfolioQuotes(userId);

    return {
        dryRun: false,
        imported: evaluation.accepted.length,
        rejected: evaluation.rejected.length,
        rejectedRows: evaluation.rejected,
        summary: {
            totalValue: evaluation.summary.totalValue,
            currency: 'INR',
        },
    };
}

/**
 * Execute rebalancing for a portfolio
 */
async function rebalancePortfolio(userId, dryRun = true) {
    console.log(`\nRebalancing portfolio for user ${userId}...\n`);

    await refreshPortfolioQuotes(userId);

    // Get current holdings
    const holdings = await getPortfolioHoldings(userId);
    const portfolioValue = holdings.reduce((total, h) => total + parseFloat(h.current_value || 0), 0);

    if (portfolioValue === 0) {
        return { error: 'Empty portfolio', trades: [] };
    }

    // Get current weights
    const currentWeights = {};
    holdings.forEach(h => {
        currentWeights[h.symbol] = parseFloat(h.current_value) / portfolioValue;
    });

    // Rebalance only across currently held symbols
    const symbols = holdings.map(h => h.symbol);
    let sentiments = await getStockSentimentsBySymbols(symbols);

    if (!sentiments || sentiments.length === 0) {
        sentiments = symbols.map(symbol => ({
            symbol,
            name: symbol,
            wss: 0,
            articleCount: 0,
            signal: 'neutral',
        }));
    }

    const targetWeights = calculateTargetWeights(sentiments);

    // Calculate required trades
    const trades = [];

    for (const sentiment of sentiments) {
        const symbol = sentiment.symbol;
        const currentWeight = currentWeights[symbol] || 0;
        const targetWeight = targetWeights[symbol] || 0;
        const weightDiff = targetWeight - currentWeight;

        // Only trade if difference exceeds threshold
        if (Math.abs(weightDiff) >= CONFIG.rebalanceThreshold) {
            const tradeValue = weightDiff * portfolioValue;
            const tradeType = tradeValue > 0 ? 'buy' : 'sell';

            trades.push({
                symbol,
                type: tradeType,
                currentWeight: (currentWeight * 100).toFixed(2) + '%',
                targetWeight: (targetWeight * 100).toFixed(2) + '%',
                tradeValue: Math.abs(tradeValue).toFixed(2),
                sentiment: sentiment.wss.toFixed(3),
                signal: sentiment.signal,
                reason: `WSS: ${sentiment.wss.toFixed(3)} (${sentiment.signal})`,
            });
        }
    }

    // Sort by absolute trade value (largest first)
    trades.sort((a, b) => parseFloat(b.tradeValue) - parseFloat(a.tradeValue));

    // Execute trades if not dry run
    if (!dryRun && trades.length > 0) {
        await executeTrades(userId, trades, portfolioValue);
    }

    return {
        portfolioValue,
        currentWeights,
        targetWeights,
        trades,
        dryRun,
    };
}

/**
 * Execute trades — creates explicit buy/sell transactions
 */
async function executeTrades(userId, trades, portfolioValue) {
    await transaction(async (client) => {
        for (const trade of trades) {
            // Get stock ID
            const stockResult = await client.query(
                'SELECT id FROM stocks WHERE symbol = $1',
                [trade.symbol]
            );

            if (stockResult.rows.length === 0) continue;

            const stockId = stockResult.rows[0].id;
            const tradeValue = parseFloat(trade.tradeValue);
            const approxPrice = tradeValue > 0 ? tradeValue : 1;
            const approxShares = tradeValue / approxPrice;

            await client.query(
                `INSERT INTO transactions (user_id, stock_id, type, shares, price, total_value, reason)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [userId, stockId, trade.type, approxShares, approxPrice, tradeValue,
                    `Rebalance: ${trade.reason}`]
            );

            const newWeight = parseFloat(trade.targetWeight) / 100;
            const newValue = portfolioValue * newWeight;

            await client.query(
                `INSERT INTO portfolio_holdings (user_id, stock_id, shares, current_value, weight, sentiment_score)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 ON CONFLICT (user_id, stock_id)
                 DO UPDATE SET current_value = $4, weight = $5, sentiment_score = $6, updated_at = NOW()`,
                [userId, stockId, approxShares, newValue, newWeight, parseFloat(trade.sentiment)]
            );
        }
    });

    console.log('\nTrades executed successfully');
}

/**
 * Initialize a new portfolio with default allocation
 * Creates both holdings AND corresponding buy transactions for ledger integrity
 */
async function initializePortfolio(userId, initialCapital = 10000) {
    const sentiments = await getAllStockSentiments();
    const targetWeights = calculateTargetWeights(sentiments);

    await transaction(async (client) => {
        for (const [symbol, weight] of Object.entries(targetWeights)) {
            const stockResult = await client.query(
                'SELECT id FROM stocks WHERE symbol = $1',
                [symbol]
            );

            if (stockResult.rows.length === 0) continue;

            const stockId = stockResult.rows[0].id;
            const value = initialCapital * weight;
            const sentiment = sentiments.find(s => s.symbol === symbol);
            const approxPrice = value > 0 ? value : 1;
            const approxShares = value / approxPrice;

            await client.query(
                `INSERT INTO portfolio_holdings (user_id, stock_id, shares, avg_cost, current_value, weight, sentiment_score)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)
                 ON CONFLICT (user_id, stock_id) DO NOTHING`,
                [userId, stockId, approxShares, approxPrice, value, weight, sentiment?.wss || 0]
            );

            await client.query(
                `INSERT INTO transactions (user_id, stock_id, type, shares, price, total_value, reason)
                 VALUES ($1, $2, 'buy', $3, $4, $5, 'Initial portfolio allocation')`,
                [userId, stockId, approxShares, approxPrice, value]
            );
        }
    });

    return { initialCapital, weights: targetWeights };
}

module.exports = {
    calculateTargetWeights,
    getPortfolioHoldings,
    calculatePortfolioValue,
    refreshPortfolioQuotes,
    addHolding,
    importHoldings,
    rebalancePortfolio,
    initializePortfolio,
    CONFIG,
};

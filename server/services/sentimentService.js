/**
 * FinBERT Sentiment Analysis Service
 * Uses Hugging Face Inference API for financial sentiment analysis
 */

const axios = require('axios');
const { query } = require('../db');
const { detectStockMentions } = require('../scrapers/newsScraper');

// Hugging Face Inference API endpoint for FinBERT
const FINBERT_API = 'https://router.huggingface.co/hf-inference/models/ProsusAI/finbert';

/**
 * Analyze sentiment of text using FinBERT via Hugging Face API
 * @param {string} text - Text to analyze
 * @returns {Object} - { sentiment, confidence, scores }
 */
let mockFallbackCount = 0;

async function analyzeSentiment(text) {
    const apiKey = process.env.HUGGINGFACE_API_KEY;

    if (!apiKey) {
        mockFallbackCount++;
        if (mockFallbackCount <= 3 || mockFallbackCount % 50 === 0) {
            console.warn(`⚠️  [MOCK SENTIMENT] No HUGGINGFACE_API_KEY set — using keyword fallback (${mockFallbackCount} articles so far)`);
        }
        return getMockSentiment(text);
    }

    try {
        const response = await axios.post(
            FINBERT_API,
            { inputs: text.substring(0, 512) }, // Limit to 512 chars for API
            {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                timeout: 30000
            }
        );

        const results = response.data[0];

        // FinBERT returns array of {label, score} sorted by score descending
        const topResult = results[0];
        const allScores = {};

        results.forEach(r => {
            allScores[r.label.toLowerCase()] = r.score;
        });

        return {
            sentiment: topResult.label.toLowerCase(),
            confidence: topResult.score,
            scores: allScores,
            raw_score: calculateRawScore(allScores),
            source: 'finbert'
        };
    } catch (error) {
        if (error.response?.status === 503) {
            const retryCount = arguments[1] || 0;
            if (retryCount >= 3) {
                console.log('⚠️  Model still loading after 3 retries, using mock sentiment');
                mockFallbackCount++;
                return getMockSentiment(text);
            }
            console.log(`⏳ Model loading, retry ${retryCount + 1}/3 in 20s...`);
            await new Promise(resolve => setTimeout(resolve, 20000));
            return analyzeSentiment(text, retryCount + 1);
        }

        console.error(`⚠️  [MOCK FALLBACK] FinBERT API error (${error.response?.status || 'network'}): ${error.message}`);
        mockFallbackCount++;
        return getMockSentiment(text);
    }
}

/**
 * Calculate raw sentiment score (-1 to 1)
 */
function calculateRawScore(scores) {
    const positive = scores.positive || 0;
    const negative = scores.negative || 0;
    const neutral = scores.neutral || 0;

    // Weighted score: positive adds, negative subtracts, neutral dampens
    return (positive - negative) * (1 - neutral * 0.5);
}

/**
 * Mock sentiment for development/testing
 */
function getMockSentiment(text) {
    const lowerText = text.toLowerCase();

    // Simple keyword-based mock
    const positiveWords = ['up', 'gain', 'rise', 'surge', 'profit', 'beat', 'growth', 'bullish', 'strong'];
    const negativeWords = ['down', 'fall', 'drop', 'loss', 'miss', 'decline', 'bearish', 'weak', 'crash'];

    let positiveCount = 0;
    let negativeCount = 0;

    positiveWords.forEach(word => {
        if (lowerText.includes(word)) positiveCount++;
    });

    negativeWords.forEach(word => {
        if (lowerText.includes(word)) negativeCount++;
    });

    let sentiment = 'neutral';
    let confidence = 0.5;

    if (positiveCount > negativeCount) {
        sentiment = 'positive';
        confidence = 0.6 + Math.min(positiveCount * 0.1, 0.35);
    } else if (negativeCount > positiveCount) {
        sentiment = 'negative';
        confidence = 0.6 + Math.min(negativeCount * 0.1, 0.35);
    }

    const scores = {
        positive: sentiment === 'positive' ? confidence : 0.2,
        negative: sentiment === 'negative' ? confidence : 0.2,
        neutral: sentiment === 'neutral' ? confidence : 0.3
    };

    return {
        sentiment,
        confidence,
        scores,
        raw_score: calculateRawScore(scores),
        source: 'mock'
    };
}

function normalizeCompanyNameForMatch(name) {
    return String(name || '')
        .toLowerCase()
        .replace(/[^a-z0-9&\s]/g, ' ')
        .replace(/\b(limited|ltd|incorporated|inc|corporation|corp|company|co|plc|holdings?)\b/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function buildNameAliases(stocks) {
    const aliases = [];

    for (const stock of stocks || []) {
        const symbol = String(stock.symbol || '').trim().toUpperCase();
        if (!symbol) continue;

        const fullName = normalizeCompanyNameForMatch(stock.name);
        if (fullName.length >= 4) {
            aliases.push({ symbol, alias: fullName });
        }

        const compact = fullName.split(' ').slice(0, 2).join(' ').trim();
        if (compact.length >= 4 && compact !== fullName) {
            aliases.push({ symbol, alias: compact });
        }
    }

    return aliases;
}

function resolveStockMentions(text, nameAliases) {
    const normalizedText = normalizeCompanyNameForMatch(text);
    const mentions = new Set(detectStockMentions(text));

    for (const entry of nameAliases || []) {
        if (entry.alias && normalizedText.includes(entry.alias)) {
            mentions.add(entry.symbol);
        }
    }

    return [...mentions];
}

function isIndiaMarketNews(text) {
    const t = String(text || '').toLowerCase();
    return (
        t.includes('nifty') ||
        t.includes('nifty50') ||
        t.includes('sensex') ||
        t.includes('nse') ||
        t.includes('bse') ||
        t.includes('bank nifty') ||
        t.includes('midcap') ||
        t.includes('smallcap') ||
        t.includes('rupee') ||
        t.includes('india equities') ||
        t.includes('indian stock') ||
        t.includes('india market')
    );
}

function normalizeSymbols(symbols = []) {
    return [...new Set(
        (symbols || [])
            .map(s => String(s || '').trim().toUpperCase())
            .filter(Boolean)
    )];
}

/**
 * Analyze all unprocessed articles
 */
async function analyzeUnprocessedArticles() {
    console.log('\n🧠 Analyzing unprocessed articles...\n');

    // Get pending articles plus processed articles that never received any score.
    const result = await query(
        `SELECT na.id, na.title, na.content
         FROM news_articles na
         WHERE na.processed = false
            OR (
                na.processed = true
                AND NOT EXISTS (
                    SELECT 1
                    FROM sentiment_scores ss
                    WHERE ss.article_id = na.id
                )
            )
         ORDER BY na.scraped_at DESC
         LIMIT 100`
    );

    const articles = result.rows;
    console.log(`📰 Found ${articles.length} unprocessed articles`);

    const trackedStocksResult = await query(
        'SELECT symbol, name, exchange FROM stocks WHERE is_active = true'
    );
    const trackedStocks = trackedStocksResult.rows;
    const nameAliases = buildNameAliases(trackedStocks);
    const stockMetaBySymbol = new Map(
        trackedStocks.map(row => [
            String(row.symbol || '').trim().toUpperCase(),
            { exchange: String(row.exchange || '').trim().toUpperCase() }
        ])
    );
    const trackedNseSymbols = trackedStocks
        .filter(row => String(row.exchange || '').toUpperCase() === 'NSE')
        .map(row => String(row.symbol || '').trim().toUpperCase())
        .filter(Boolean);
    const heldNseResult = await query(
        `SELECT s.symbol, COUNT(*)::int AS holders
         FROM portfolio_holdings ph
         JOIN stocks s ON s.id = ph.stock_id
         WHERE s.exchange = 'NSE'
         GROUP BY s.symbol
         ORDER BY holders DESC, s.symbol`
    );
    const heldNseSymbols = normalizeSymbols(heldNseResult.rows.map(r => r.symbol));
    const prioritizedNseSymbols = heldNseSymbols.length > 0
        ? normalizeSymbols([...heldNseSymbols, ...trackedNseSymbols])
        : normalizeSymbols(trackedNseSymbols);

    let analyzed = 0;

    for (const article of articles) {
        try {
            // Combine title and content for analysis
            const text = article.content
                ? `${article.title}. ${article.content}`
                : article.title;

            // Get sentiment
            const sentiment = await analyzeSentiment(text);

            // Detect stock mentions from ticker patterns and company-name aliases.
            let stockSymbols = normalizeSymbols(resolveStockMentions(text, nameAliases));
            const indiaMacro = isIndiaMarketNews(text);

            if (indiaMacro) {
                // India-market headlines should map to NSE symbols only.
                const nseMentions = stockSymbols.filter(symbol => stockMetaBySymbol.get(symbol)?.exchange === 'NSE');
                if (nseMentions.length > 0) {
                    stockSymbols = nseMentions;
                } else {
                    // No direct NSE mention: use prioritized held NSE symbols as proxy coverage.
                    stockSymbols = prioritizedNseSymbols.slice(0, 12);
                }
            }

            // Get stock IDs
            if (stockSymbols.length > 0) {
                const stockResult = await query(
                    'SELECT id, symbol FROM stocks WHERE symbol = ANY($1::text[])',
                    [stockSymbols]
                );

                // Save sentiment for each mentioned stock
                for (const stock of stockResult.rows) {
                    await query(
                        `INSERT INTO sentiment_scores 
                         (article_id, stock_id, sentiment, confidence, raw_score, source)
                         SELECT $1, $2, $3, $4, $5, $6
                         WHERE NOT EXISTS (
                            SELECT 1 FROM sentiment_scores
                            WHERE article_id = $1 AND stock_id = $2
                         )`,
                        [article.id, stock.id, sentiment.sentiment, sentiment.confidence, sentiment.raw_score, sentiment.source || 'unknown']
                    );
                }
            }

            // Mark article as processed
            await query(
                'UPDATE news_articles SET processed = true WHERE id = $1',
                [article.id]
            );

            analyzed++;
            console.log(`✅ Analyzed: "${article.title.substring(0, 50)}..." -> ${sentiment.sentiment} (${(sentiment.confidence * 100).toFixed(1)}%)`);

            // Rate limiting - wait between API calls
            if (process.env.HUGGINGFACE_API_KEY) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        } catch (error) {
            console.error(`Error analyzing article ${article.id}:`, error.message);
        }
    }

    console.log(`\n✅ Analyzed ${analyzed} articles`);
    return analyzed;
}

/**
 * Calculate Weighted Sentiment Score (WSS) for a stock
 * Recent news weighted higher than old news
 */
async function calculateWSS(stockId, days = 7) {
    const result = await query(
        `SELECT raw_score, analyzed_at
         FROM sentiment_scores
         WHERE stock_id = $1
         AND analyzed_at >= NOW() - ($2 || ' days')::interval
         ORDER BY analyzed_at DESC`,
        [stockId, String(days)]
    );

    if (result.rows.length === 0) {
        return { wss: 0, articleCount: 0 };
    }

    const now = Date.now();
    let weightedSum = 0;
    let weightSum = 0;

    for (const row of result.rows) {
        // Time decay: more recent = higher weight
        const hoursAgo = (now - new Date(row.analyzed_at).getTime()) / (1000 * 60 * 60);
        const weight = Math.exp(-hoursAgo / (24 * days)); // Exponential decay

        weightedSum += row.raw_score * weight;
        weightSum += weight;
    }

    const wss = weightSum > 0 ? weightedSum / weightSum : 0;

    return {
        wss: Math.max(-1, Math.min(1, wss)), // Clamp to [-1, 1]
        articleCount: result.rows.length
    };
}

/**
 * Get sentiment summary for all stocks
 */
async function getAllStockSentiments(days = 7) {
    const stocksResult = await query(
        `SELECT id, symbol, name, exchange, country, currency
         FROM stocks
         WHERE is_active = true`
    );
    const stocks = stocksResult.rows;

    const sentiments = [];

    for (const stock of stocks) {
        const { wss, articleCount } = await calculateWSS(stock.id, days);

        sentiments.push({
            symbol: stock.symbol,
            name: stock.name,
            exchange: stock.exchange,
            country: stock.country,
            currency: stock.currency,
            wss,
            articleCount,
            signal: wss > 0.2 ? 'bullish' : wss < -0.2 ? 'bearish' : 'neutral'
        });
    }

    // Sort by absolute WSS (strongest signals first)
    sentiments.sort((a, b) => Math.abs(b.wss) - Math.abs(a.wss));

    return sentiments;
}

/**
 * Get sentiment summary for a specific symbol set
 */
async function getStockSentimentsBySymbols(symbols = [], days = 7) {
    const normalized = [...new Set((symbols || [])
        .map(s => String(s || '').trim().toUpperCase())
        .filter(Boolean))];

    if (normalized.length === 0) return [];

    const stocksResult = await query(
        `SELECT id, symbol, name, exchange, country, currency
         FROM stocks
         WHERE symbol = ANY($1::text[])`,
        [normalized]
    );

    const sentiments = [];
    for (const stock of stocksResult.rows) {
        const { wss, articleCount } = await calculateWSS(stock.id, days);

        sentiments.push({
            symbol: stock.symbol,
            name: stock.name,
            exchange: stock.exchange,
            country: stock.country,
            currency: stock.currency,
            wss,
            articleCount,
            signal: wss > 0.2 ? 'bullish' : wss < -0.2 ? 'bearish' : 'neutral'
        });
    }

    sentiments.sort((a, b) => Math.abs(b.wss) - Math.abs(a.wss));
    return sentiments;
}

module.exports = {
    analyzeSentiment,
    analyzeUnprocessedArticles,
    calculateWSS,
    getAllStockSentiments,
    getStockSentimentsBySymbols,
    calculateRawScore
};

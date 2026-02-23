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
async function analyzeSentiment(text) {
    const apiKey = process.env.HUGGINGFACE_API_KEY;

    if (!apiKey) {
        // Return mock sentiment if no API key (for development)
        console.log('⚠️ No Hugging Face API key, using mock sentiment');
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
            raw_score: calculateRawScore(allScores)
        };
    } catch (error) {
        if (error.response?.status === 503) {
            console.log('⏳ Model loading, retrying in 20s...');
            await new Promise(resolve => setTimeout(resolve, 20000));
            return analyzeSentiment(text); // Retry
        }

        console.error('FinBERT API error:', error.message);
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
        raw_score: calculateRawScore(scores)
    };
}

/**
 * Analyze all unprocessed articles
 */
async function analyzeUnprocessedArticles() {
    console.log('\n🧠 Analyzing unprocessed articles...\n');

    // Get unprocessed articles
    const result = await query(
        `SELECT id, title, content FROM news_articles 
         WHERE processed = false 
         ORDER BY scraped_at DESC 
         LIMIT 50`
    );

    const articles = result.rows;
    console.log(`📰 Found ${articles.length} unprocessed articles`);

    let analyzed = 0;

    for (const article of articles) {
        try {
            // Combine title and content for analysis
            const text = article.content
                ? `${article.title}. ${article.content}`
                : article.title;

            // Get sentiment
            const sentiment = await analyzeSentiment(text);

            // Detect stock mentions
            const stockSymbols = detectStockMentions(text);

            // Get stock IDs
            if (stockSymbols.length > 0) {
                const stockResult = await query(
                    'SELECT id, symbol FROM stocks WHERE symbol = ANY($1)',
                    [stockSymbols]
                );

                // Save sentiment for each mentioned stock
                for (const stock of stockResult.rows) {
                    await query(
                        `INSERT INTO sentiment_scores 
                         (article_id, stock_id, sentiment, confidence, raw_score)
                         VALUES ($1, $2, $3, $4, $5)`,
                        [article.id, stock.id, sentiment.sentiment, sentiment.confidence, sentiment.raw_score]
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
         AND analyzed_at >= NOW() - INTERVAL '${days} days'
         ORDER BY analyzed_at DESC`,
        [stockId]
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
async function getAllStockSentiments() {
    const stocksResult = await query('SELECT id, symbol, name FROM stocks WHERE is_active = true');
    const stocks = stocksResult.rows;

    const sentiments = [];

    for (const stock of stocks) {
        const { wss, articleCount } = await calculateWSS(stock.id);

        sentiments.push({
            symbol: stock.symbol,
            name: stock.name,
            wss,
            articleCount,
            signal: wss > 0.2 ? 'bullish' : wss < -0.2 ? 'bearish' : 'neutral'
        });
    }

    // Sort by absolute WSS (strongest signals first)
    sentiments.sort((a, b) => Math.abs(b.wss) - Math.abs(a.wss));

    return sentiments;
}

module.exports = {
    analyzeSentiment,
    analyzeUnprocessedArticles,
    calculateWSS,
    getAllStockSentiments,
    calculateRawScore
};

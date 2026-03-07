/**
 * News Scraper using Cheerio
 * Scrapes financial news from multiple sources
 */

const axios = require('axios');
const cheerio = require('cheerio');
const { query } = require('../db');
const { scrapeStocktwits } = require('./stocktwitsScraper');

// Stock symbol to company name mapping for entity detection
const STOCK_KEYWORDS = {
    'AAPL': ['apple', 'iphone', 'ipad', 'mac', 'tim cook'],
    'MSFT': ['microsoft', 'windows', 'azure', 'xbox', 'satya nadella'],
    'GOOGL': ['google', 'alphabet', 'youtube', 'android', 'sundar pichai'],
    'AMZN': ['amazon', 'aws', 'prime', 'alexa', 'jeff bezos', 'andy jassy'],
    'TSLA': ['tesla', 'elon musk', 'cybertruck', 'model 3', 'model y', 'spacex'],
    'NVDA': ['nvidia', 'gpu', 'geforce', 'cuda', 'jensen huang'],
    'META': ['meta', 'facebook', 'instagram', 'whatsapp', 'mark zuckerberg', 'metaverse'],
    'JPM': ['jpmorgan', 'jp morgan', 'chase', 'jamie dimon'],
    'V': ['visa'],
    'JNJ': ['johnson & johnson', 'j&j']
};

/**
 * Scrape news from NewsAPI
 */
async function scrapeNewsAPI() {
    const apiKey = process.env.NEWS_API_KEY;
    if (!apiKey) {
        console.log('⚠️ NewsAPI key not configured');
        return [];
    }

    try {
        const response = await axios.get('https://newsapi.org/v2/top-headlines', {
            params: {
                category: 'business',
                language: 'en',
                pageSize: 50,
                apiKey
            }
        });

        const articles = response.data.articles.map(article => ({
            source: 'newsapi',
            title: article.title,
            content: article.description || article.content,
            url: article.url,
            published_at: article.publishedAt
        }));

        console.log(`📰 Scraped ${articles.length} articles from NewsAPI`);
        return articles;
    } catch (error) {
        console.error('NewsAPI scrape error:', error.message);
        return [];
    }
}

/**
 * Scrape news from Yahoo Finance using Cheerio
 */
async function scrapeYahooFinance() {
    try {
        const response = await axios.get('https://finance.yahoo.com/news/', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        const $ = cheerio.load(response.data);
        const articles = [];

        $('h3 a').each((i, el) => {
            if (articles.length >= 30) return;

            const title = $(el).text().trim();
            const href = $(el).attr('href');

            if (title && href) {
                articles.push({
                    source: 'yahoo_finance',
                    title,
                    content: null,
                    url: href.startsWith('http') ? href : `https://finance.yahoo.com${href}`,
                    published_at: new Date().toISOString()
                });
            }
        });

        console.log(`📈 Scraped ${articles.length} articles from Yahoo Finance`);
        return articles;
    } catch (error) {
        console.error('Yahoo Finance scrape error:', error.message);
        return [];
    }
}

/**
 * Scrape posts from Reddit (r/wallstreetbets, r/stocks)
 */
async function scrapeReddit() {
    const subreddits = ['wallstreetbets', 'stocks', 'investing'];
    const articles = [];

    for (const subreddit of subreddits) {
        try {
            const response = await axios.get(`https://www.reddit.com/r/${subreddit}/hot.json`, {
                params: { limit: 20 },
                headers: {
                    'User-Agent': process.env.REDDIT_USER_AGENT || 'SentinelQuant/1.0'
                }
            });

            const posts = response.data.data.children.map(post => ({
                source: `reddit_${subreddit}`,
                title: post.data.title,
                content: post.data.selftext || null,
                url: `https://reddit.com${post.data.permalink}`,
                published_at: new Date(post.data.created_utc * 1000).toISOString()
            }));

            articles.push(...posts);
            console.log(`🤖 Scraped ${posts.length} posts from r/${subreddit}`);
        } catch (error) {
            console.error(`Reddit r/${subreddit} scrape error:`, error.message);
        }
    }

    return articles;
}

/**
 * Detect stock mentions in article text
 */
function detectStockMentions(text) {
    if (!text) return [];

    const lowerText = text.toLowerCase();
    const mentions = [];

    for (const [symbol, keywords] of Object.entries(STOCK_KEYWORDS)) {
        for (const keyword of keywords) {
            if (lowerText.includes(keyword)) {
                mentions.push(symbol);
                break;
            }
        }
    }

    return [...new Set(mentions)]; // Remove duplicates
}

/**
 * Save articles to database
 */
async function saveArticles(articles) {
    let saved = 0;

    for (const article of articles) {
        try {
            // Skip if URL already exists
            const existing = await query(
                'SELECT id FROM news_articles WHERE url = $1',
                [article.url]
            );

            if (existing.rows.length > 0) continue;

            // Insert article
            await query(
                `INSERT INTO news_articles (source, title, content, url, published_at)
                 VALUES ($1, $2, $3, $4, $5)`,
                [article.source, article.title, article.content, article.url, article.published_at]
            );

            saved++;
        } catch (error) {
            // Ignore duplicate key errors
            if (!error.message.includes('duplicate')) {
                console.error('Save article error:', error.message);
            }
        }
    }

    console.log(`💾 Saved ${saved} new articles to database`);
    return saved;
}

/**
 * Run all scrapers
 */
async function runAllScrapers() {
    console.log('\n🔄 Starting news scraping...\n');

    const [newsApiArticles, yahooArticles, redditArticles, stocktwitsArticles] = await Promise.all([
        scrapeNewsAPI(),
        scrapeYahooFinance(),
        scrapeReddit(),
        scrapeStocktwits()
    ]);

    const allArticles = [...newsApiArticles, ...yahooArticles, ...redditArticles, ...stocktwitsArticles];
    console.log(`\n📊 Total articles scraped: ${allArticles.length}`);

    const saved = await saveArticles(allArticles);

    return {
        total: allArticles.length,
        new_articles: saved,
        analyzed_articles: 0,  // Scraper only saves — analysis happens in cron pipeline
        sources: {
            newsapi: newsApiArticles.length,
            yahoo_finance: yahooArticles.length,
            reddit: redditArticles.length,
            stocktwits: stocktwitsArticles.length
        }
    };
}

module.exports = {
    scrapeNewsAPI,
    scrapeYahooFinance,
    scrapeReddit,
    scrapeStocktwits,
    detectStockMentions,
    saveArticles,
    runAllScrapers,
    STOCK_KEYWORDS
};

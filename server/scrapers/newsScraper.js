/**
 * News scraper using multiple sources.
 */

const axios = require('axios');
const cheerio = require('cheerio');
const { query } = require('../db');
const { scrapeStocktwits } = require('./stocktwitsScraper');

// Baseline keyword map (US-heavy), supplemented by generic ticker parsing.
const STOCK_KEYWORDS = {
    AAPL: ['apple', 'iphone', 'ipad', 'mac', 'tim cook'],
    MSFT: ['microsoft', 'windows', 'azure', 'xbox', 'satya nadella'],
    GOOGL: ['google', 'alphabet', 'youtube', 'android', 'sundar pichai'],
    AMZN: ['amazon', 'aws', 'prime', 'alexa', 'jeff bezos', 'andy jassy'],
    TSLA: ['tesla', 'elon musk', 'cybertruck', 'model 3', 'model y', 'spacex'],
    NVDA: ['nvidia', 'gpu', 'geforce', 'cuda', 'jensen huang'],
    META: ['meta', 'facebook', 'instagram', 'whatsapp', 'mark zuckerberg', 'metaverse'],
    JPM: ['jpmorgan', 'jp morgan', 'chase', 'jamie dimon'],
    V: ['visa'],
    JNJ: ['johnson & johnson', 'j&j']
};

function normalizeCompanyToken(name) {
    return String(name || '')
        .replace(/\b(limited|ltd|incorporated|inc|corporation|corp|company|co|plc|holdings?)\b/ig, '')
        .replace(/[^a-zA-Z0-9\s&]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

async function buildIndiaNewsQuery() {
    const defaults = ['NSE', 'BSE', 'Nifty', 'Sensex', 'Indian stocks'];

    try {
        const result = await query(
            `SELECT symbol, name
             FROM stocks
             WHERE exchange = 'NSE' AND is_active = true
             ORDER BY symbol
             LIMIT 10`
        );

        const terms = [];
        for (const row of result.rows) {
            const symbol = String(row.symbol || '').toUpperCase().replace(/\.NS$/, '');
            const nameToken = normalizeCompanyToken(row.name).split(' ').slice(0, 2).join(' ').trim();
            if (symbol) terms.push(symbol);
            if (nameToken && nameToken.length >= 4) terms.push(nameToken);
        }

        const uniqueTerms = [...new Set([...defaults, ...terms])].slice(0, 12);
        return uniqueTerms.map(term => `"${term}"`).join(' OR ');
    } catch (error) {
        console.warn(`NewsAPI India query fallback: ${error.message}`);
        return defaults.map(term => `"${term}"`).join(' OR ');
    }
}

function mapNewsApiArticle(article, source) {
    return {
        source,
        title: article.title,
        content: article.description || article.content,
        url: article.url,
        published_at: article.publishedAt
    };
}

/**
 * Scrape news from NewsAPI.
 * Includes both generic business headlines and India-focused search.
 */
async function scrapeNewsAPI() {
    const apiKey = process.env.NEWS_API_KEY;
    if (!apiKey) {
        console.log('NewsAPI key not configured');
        return [];
    }

    try {
        const indiaQuery = await buildIndiaNewsQuery();

        const [topHeadlines, indiaEverything] = await Promise.all([
            axios.get('https://newsapi.org/v2/top-headlines', {
                params: {
                    category: 'business',
                    language: 'en',
                    pageSize: 50,
                    apiKey
                }
            }).catch(() => null),
            axios.get('https://newsapi.org/v2/everything', {
                params: {
                    q: indiaQuery,
                    language: 'en',
                    searchIn: 'title,description',
                    sortBy: 'publishedAt',
                    pageSize: 50,
                    apiKey
                }
            }).catch(() => null)
        ]);

        const merged = [];
        const seenUrls = new Set();
        const appendBatch = (batch, source) => {
            const list = batch?.data?.articles || [];
            for (const article of list) {
                if (!article?.url || seenUrls.has(article.url)) continue;
                seenUrls.add(article.url);
                merged.push(mapNewsApiArticle(article, source));
            }
        };

        appendBatch(topHeadlines, 'newsapi');
        appendBatch(indiaEverything, 'newsapi_india');

        console.log(`Scraped ${merged.length} articles from NewsAPI`);
        return merged;
    } catch (error) {
        console.error('NewsAPI scrape error:', error.message);
        return [];
    }
}

/**
 * Scrape India-focused finance headlines from Google News RSS (no API key required).
 */
async function scrapeGoogleNewsIndia() {
    try {
        const response = await axios.get(
            'https://news.google.com/rss/search?q=(NSE%20OR%20BSE%20OR%20Nifty%20OR%20Sensex%20OR%20Indian%20stocks)&hl=en-IN&gl=IN&ceid=IN:en',
            {
                timeout: 15000,
                headers: { 'User-Agent': 'Mozilla/5.0 SentinelQuant/1.0' }
            }
        );

        const $ = cheerio.load(response.data, { xmlMode: true });
        const articles = [];

        $('item').each((i, el) => {
            if (i >= 50) return false;
            const title = $(el).find('title').first().text().trim();
            const link = $(el).find('link').first().text().trim();
            const pubDate = $(el).find('pubDate').first().text().trim();
            const description = $(el).find('description').first().text().trim();

            if (!title || !link) return;

            articles.push({
                source: 'google_news_india',
                title,
                content: description || null,
                url: link,
                published_at: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString()
            });
        });

        console.log(`Scraped ${articles.length} articles from Google News India RSS`);
        return articles;
    } catch (error) {
        console.error('Google News India scrape error:', error.message);
        return [];
    }
}

/**
 * Scrape Yahoo Finance news headlines.
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

        console.log(`Scraped ${articles.length} articles from Yahoo Finance`);
        return articles;
    } catch (error) {
        console.error('Yahoo Finance scrape error:', error.message);
        return [];
    }
}

/**
 * Scrape Reddit posts from finance-focused communities.
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
            console.log(`Scraped ${posts.length} posts from r/${subreddit}`);
        } catch (error) {
            console.error(`Reddit r/${subreddit} scrape error:`, error.message);
        }
    }

    return articles;
}

/**
 * Detect stock mentions in article text.
 */
function detectStockMentions(text) {
    if (!text) return [];

    const rawText = String(text);
    const lowerText = rawText.toLowerCase();
    const mentions = new Set();

    for (const [symbol, keywords] of Object.entries(STOCK_KEYWORDS)) {
        for (const keyword of keywords) {
            if (lowerText.includes(keyword)) {
                mentions.add(symbol);
                break;
            }
        }
    }

    // Explicit ticker patterns: $AAPL, RELIANCE.NS, RELIANCE:NSE
    const explicitPatterns = [
        /\$([A-Z0-9]{1,12}(?:\.NS)?)/g,
        /\b([A-Z0-9]{1,12}\.NS|[A-Z0-9]{1,12}:NSE)\b/g
    ];

    for (const pattern of explicitPatterns) {
        for (const match of rawText.matchAll(pattern)) {
            const token = normalizeTickerCandidate(match[1] || match[0]);
            if (token) mentions.add(token);
        }
    }

    const tickerStopWords = new Set([
        'A', 'AN', 'AND', 'AS', 'AT', 'BE', 'BY', 'CEO', 'CFO', 'COO', 'CTO',
        'EPS', 'ETF', 'FED', 'FII', 'GDP', 'IPO', 'IT', 'NS', 'NSE', 'RBI', 'SEBI',
        'THE', 'TO', 'USD', 'US', 'YOY'
    ]);

    // Bare uppercase token fallback (AAPL/MSFT style)
    for (const match of rawText.matchAll(/\b([A-Z]{1,5})\b(?!\.)/g)) {
        const token = match[1];
        if (!tickerStopWords.has(token)) {
            mentions.add(token);
        }
    }

    return [...mentions];
}

function normalizeTickerCandidate(raw) {
    let token = String(raw || '').trim().toUpperCase();
    if (!token) return null;

    if (token.startsWith('$')) token = token.slice(1);
    if (token.endsWith(':NSE')) token = `${token.slice(0, -4)}.NS`;

    if (/^[A-Z]{1,5}$/.test(token)) return token;
    if (/^[A-Z0-9]{1,12}\.NS$/.test(token)) return token;
    return null;
}

/**
 * Save scraped articles to DB, skipping duplicate URLs.
 */
async function saveArticles(articles) {
    let saved = 0;

    for (const article of articles) {
        try {
            if (!article?.url) continue;
            const normalizedUrl = String(article.url).trim();
            const safeUrl = normalizedUrl.length > 500 ? normalizedUrl.slice(0, 500) : normalizedUrl;
            if (!safeUrl) continue;

            const existing = await query(
                'SELECT id FROM news_articles WHERE url = $1',
                [safeUrl]
            );

            if (existing.rows.length > 0) continue;

            await query(
                `INSERT INTO news_articles (source, title, content, url, published_at)
                 VALUES ($1, $2, $3, $4, $5)`,
                [article.source, article.title, article.content, safeUrl, article.published_at]
            );

            saved++;
        } catch (error) {
            if (!String(error.message || '').includes('duplicate')) {
                console.error('Save article error:', error.message);
            }
        }
    }

    console.log(`Saved ${saved} new articles to database`);
    return saved;
}

/**
 * Run all scrapers.
 */
async function runAllScrapers() {
    console.log('\nStarting news scraping...\n');

    const [newsApiArticles, googleIndiaArticles, yahooArticles, redditArticles, stocktwitsArticles] = await Promise.all([
        scrapeNewsAPI(),
        scrapeGoogleNewsIndia(),
        scrapeYahooFinance(),
        scrapeReddit(),
        scrapeStocktwits()
    ]);

    const allArticles = [...newsApiArticles, ...googleIndiaArticles, ...yahooArticles, ...redditArticles, ...stocktwitsArticles];
    console.log(`Total articles scraped: ${allArticles.length}`);

    const saved = await saveArticles(allArticles);

    return {
        total: allArticles.length,
        new_articles: saved,
        analyzed_articles: 0,
        sources: {
            newsapi: newsApiArticles.length,
            google_news_india: googleIndiaArticles.length,
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

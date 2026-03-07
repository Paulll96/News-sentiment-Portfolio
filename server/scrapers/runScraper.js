/**
 * Manual trigger script for SentinelQuant news scrapers
 * Run via: npm run scrape
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const { runAllScrapers } = require('./newsScraper');
const { analyzeUnprocessedArticles } = require('../services/sentimentService');

async function triggerScraping() {
    console.log('🚀 Manually triggering scraping + analysis pipeline...');
    try {
        const scrapeResult = await runAllScrapers();
        console.log(`\n📰 Scrape complete: ${scrapeResult.new_articles} new articles`);

        // Also run sentiment analysis
        const analyzed = await analyzeUnprocessedArticles();
        console.log(`🧠 Sentiment analysis complete: ${analyzed} articles analyzed`);

        console.log('\n✅ Pipeline Complete!');
        console.log(`📊 Statistics:`, { ...scrapeResult, analyzed_articles: analyzed });
        process.exit(0);
    } catch (error) {
        console.error('\n❌ Fatal error during pipeline:', error.message);
        process.exit(1);
    }
}

triggerScraping();

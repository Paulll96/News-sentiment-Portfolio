/**
 * Manual trigger script for SentinelQuant news scrapers
 * Run via: npm run scrape
 */
require('dotenv').config({ path: '../.env' });
const { runAllScrapers } = require('./newsScraper');

async function triggerScraping() {
    console.log('🚀 Manually triggering scraping process...');
    try {
        const result = await runAllScrapers();
        console.log('\n✅ Scraping Process Complete!');
        console.log(`📊 Statistics:`, result);
        process.exit(0);
    } catch (error) {
        console.error('\n❌ Fatal error during scraping:', error.message);
        process.exit(1);
    }
}

triggerScraping();

/**
 * SentinelQuant Scheduled Automation
 * Uses node-cron to run background tasks
 */

const cron = require('node-cron');
const { runAllScrapers } = require('./scrapers/newsScraper');

// Log that cron is starting
console.log('⏰ Initializing Automated Tasks (Cron Jobs)...');

// Read interval from env, default to every 15 minutes if not specified
// "*/15 * * * *" means "Every 15th minute"
const scrapeInterval = process.env.SCRAPE_INTERVAL_MINUTES || 15;
const cronSchedule = `*/${scrapeInterval} * * * *`;

// Define the scraping and analysis job
const scrapingJob = cron.schedule(cronSchedule, async () => {
    console.log(`\n==========================================`);
    console.log(`⏱️  [CRON TRIGGERED] Running automated scraper at ${new Date().toISOString()}`);
    console.log(`==========================================`);

    try {
        // This function handles fetching news, deduplicating, and sending to FinBERT
        const result = await runAllScrapers();

        console.log(`✅ Automated Scrape Complete:`);
        console.log(`   - New Articles: ${result.new_articles}`);
        console.log(`   - Analyzed: ${result.analyzed_articles}`);
        console.log(`==========================================\n`);

    } catch (error) {
        console.error(`❌ Automated Scrape Failed:`, error.message);
    }
}, {
    scheduled: false // Don't start immediately, wait for start() call
});

// Export a function to start all cron jobs
function startCronJobs() {
    console.log(`🕒 Scraping job scheduled to run every ${scrapeInterval} minutes.`);
    scrapingJob.start();
}

module.exports = { startCronJobs };

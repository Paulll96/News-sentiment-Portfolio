/**
 * SentinelQuant Scheduled Automation
 * Uses node-cron to run background tasks
 * Pipeline: scrape → analyze sentiment → aggregate daily → notify
 */

const cron = require('node-cron');
const { runAllScrapers } = require('./scrapers/newsScraper');
const { analyzeUnprocessedArticles } = require('./services/sentimentService');
const { syncInstrumentMaster } = require('./services/instrumentService');
const { query } = require('./db');
const { broadcastScrapeComplete, broadcastSentimentUpdate } = require('./socket');

// Log that cron is starting
console.log('⏰ Initializing Automated Tasks (Cron Jobs)...');

// Read interval from env, default to every 15 minutes if not specified
const scrapeInterval = process.env.SCRAPE_INTERVAL_MINUTES || 15;
const cronSchedule = `*/${scrapeInterval} * * * *`;

/**
 * Aggregate today's sentiment scores into the daily_sentiment table.
 * This enables the StockDetail history chart to display trends over time.
 */
async function aggregateDailySentiment() {
    try {
        await query(`
            INSERT INTO daily_sentiment (
                stock_id, date,
                avg_sentiment, weighted_sentiment,
                article_count,
                positive_count, negative_count, neutral_count
            )
            SELECT
                ss.stock_id,
                CURRENT_DATE,
                AVG(ss.raw_score),
                AVG(ss.raw_score),
                COUNT(*),
                COUNT(*) FILTER (WHERE ss.sentiment = 'positive'),
                COUNT(*) FILTER (WHERE ss.sentiment = 'negative'),
                COUNT(*) FILTER (WHERE ss.sentiment = 'neutral')
            FROM sentiment_scores ss
            WHERE DATE(ss.analyzed_at) = CURRENT_DATE
            GROUP BY ss.stock_id
            ON CONFLICT (stock_id, date) DO UPDATE SET
                avg_sentiment    = EXCLUDED.avg_sentiment,
                weighted_sentiment = EXCLUDED.weighted_sentiment,
                article_count    = EXCLUDED.article_count,
                positive_count   = EXCLUDED.positive_count,
                negative_count   = EXCLUDED.negative_count,
                neutral_count    = EXCLUDED.neutral_count
        `);
        console.log('📊 daily_sentiment aggregation complete.');
    } catch (err) {
        console.error('⚠️  daily_sentiment aggregation failed:', err.message);
    }
}

/**
 * Generate notifications for users based on sentiment changes.
 */
async function generateNotifications(scrapeResult) {
    try {
        // Check for notable sentiment changes today
        const extremes = await query(`
            SELECT ds.stock_id, s.symbol, s.name, ds.weighted_sentiment
            FROM daily_sentiment ds
            JOIN stocks s ON ds.stock_id = s.id
            WHERE ds.date = CURRENT_DATE
              AND (ds.weighted_sentiment > 0.5 OR ds.weighted_sentiment < -0.5)
        `);

        if (extremes.rows.length > 0) {
            const users = await query('SELECT id FROM users');

            for (const stock of extremes.rows) {
                const isSurge = stock.weighted_sentiment > 0;
                const type = isSurge ? 'sentiment_surge' : 'sentiment_drop';
                const title = isSurge
                    ? `📈 ${stock.symbol} sentiment surging`
                    : `📉 ${stock.symbol} sentiment dropping`;
                const message = `${stock.name} has a weighted sentiment score of ${(stock.weighted_sentiment * 100).toFixed(1)}%. ${isSurge ? 'Consider increasing allocation.' : 'Review your position.'}`;

                for (const user of users.rows) {
                    await query(`
                        INSERT INTO notifications (user_id, type, title, message)
                        SELECT $1, $2, $3, $4
                        WHERE NOT EXISTS (
                            SELECT 1 FROM notifications
                            WHERE user_id = $1 AND type = $2 AND title = $3
                              AND created_at >= CURRENT_DATE
                        )
                    `, [user.id, type, title, message]);
                }
            }
            console.log(`🔔 Generated notifications for ${extremes.rows.length} notable stocks.`);
        }

        // Notify pro users about scrape completion
        if (scrapeResult && scrapeResult.new_articles > 0) {
            const proUsers = await query("SELECT id FROM users WHERE tier IN ('pro', 'enterprise')");
            for (const user of proUsers.rows) {
                await query(`
                    INSERT INTO notifications (user_id, type, title, message)
                    VALUES ($1, 'scrape_complete', '🗞️ Pipeline complete',
                            $2)
                `, [
                    user.id,
                    `Scraped ${scrapeResult.new_articles} new articles, analyzed ${scrapeResult.analyzed_articles} for sentiment. Data updated.`
                ]);
            }
        }
    } catch (err) {
        console.error('⚠️  Notification generation failed:', err.message);
    }
}

// Define the full pipeline job: scrape → analyze → aggregate → notify
const pipelineJob = cron.schedule(cronSchedule, async () => {
    console.log(`\n==========================================`);
    console.log(`⏱️  [CRON TRIGGERED] Running full pipeline at ${new Date().toISOString()}`);
    console.log(`==========================================`);

    try {
        // Step 1: Scrape news from all sources
        const scrapeResult = await runAllScrapers();
        console.log(`📰 Scrape complete: ${scrapeResult.new_articles} new articles saved`);

        // Step 2: Run sentiment analysis on unprocessed articles
        let analyzedCount = 0;
        try {
            analyzedCount = await analyzeUnprocessedArticles();
            console.log(`🧠 Sentiment analysis complete: ${analyzedCount} articles analyzed`);
        } catch (analyzeErr) {
            console.error(`⚠️  Sentiment analysis failed: ${analyzeErr.message}`);
        }

        // Step 3: Aggregate into daily_sentiment for charting
        await aggregateDailySentiment();

        // Build truthful result summary
        const result = {
            ...scrapeResult,
            analyzed_articles: analyzedCount, // Actual analyzed count, not copied from saved
        };

        // Step 4: Generate notifications for users
        await generateNotifications(result);

        // Step 5: Broadcast via Socket.IO
        broadcastScrapeComplete(result);

        console.log(`✅ Full pipeline complete: scraped=${scrapeResult.new_articles}, analyzed=${analyzedCount}`);
        console.log(`==========================================\n`);

    } catch (error) {
        console.error(`❌ Pipeline Failed:`, error.message);
    }
}, {
    scheduled: false
});

// Daily instrument universe sync (NSE)
const instrumentSyncJob = cron.schedule('10 2 * * *', async () => {
    try {
        const result = await syncInstrumentMaster();
        console.log(`🗂️ Instrument sync completed: ${result.synced} rows`);
    } catch (error) {
        console.error('⚠️  Instrument sync failed:', error.message);
    }
}, {
    scheduled: false
});

// Export a function to start all cron jobs
function startCronJobs() {
    console.log(`🕒 Pipeline job scheduled to run every ${scrapeInterval} minutes.`);
    pipelineJob.start();
    instrumentSyncJob.start();

    // Attempt an initial sync on boot; fail softly if source unavailable.
    syncInstrumentMaster()
        .then(result => console.log(`🗂️ Initial instrument sync: ${result.synced} rows`))
        .catch(err => console.warn(`⚠️  Initial instrument sync skipped: ${err.message}`));
}

module.exports = { startCronJobs };

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { query } = require('./db/index');

async function verify() {
    try {
        const result = await query(
            `SELECT id, url, content, title, processed 
             FROM news_articles 
             WHERE source = 'google_news_india' 
             AND scraped_at >= NOW() - interval '30 days'
             LIMIT 5`
        );
        
        console.log('--- RECENT GOOGLE NEWS INDIA ARTICLES ---');
        result.rows.forEach(row => {
            console.log(`ID: ${row.id}`);
            console.log(`Title: ${row.title}`);
            console.log(`URL: ${row.url}`);
            console.log(`Processed: ${row.processed}`);
            console.log(`Snippet: ${row.content?.substring(0, 100)}...`);
            console.log('-----------------------------------------');
        });

        const scores = await query(
            `SELECT COUNT(*) FROM sentiment_scores ss
             JOIN news_articles na ON na.id = ss.article_id
             WHERE na.source = 'google_news_india'
             AND na.scraped_at >= NOW() - interval '30 days'`
        );
        console.log(`Total sentiment scores for recent Google News: ${scores.rows[0].count}`);

    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}

verify();

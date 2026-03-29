const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { query } = require('./db/index');

async function verify() {
    try {
        const result = await query(
            `SELECT na.title, s.symbol 
             FROM news_articles na 
             JOIN sentiment_scores ss ON ss.article_id = na.id 
             JOIN stocks s ON s.id = ss.stock_id 
             WHERE na.title LIKE '%JSW Steel%' 
             ORDER BY na.scraped_at DESC 
             LIMIT 10`
        );
        
        console.log('--- SENTIMENT TAGS FOR JSW STEEL NEWS ---');
        result.rows.forEach(row => {
            console.log(`Title: ${row.title.substring(0, 50)}...`);
            console.log(`Symbol: ${row.symbol}`);
            console.log('-----------------------------------------');
        });

        // Specifically check if any recent Google News India row has GOOGL
        const googlCheck = await query(
            `SELECT na.title 
             FROM news_articles na 
             JOIN sentiment_scores ss ON ss.article_id = na.id 
             JOIN stocks s ON s.id = ss.stock_id 
             WHERE na.source = 'google_news_india' 
             AND s.symbol = 'GOOGL'
             AND na.scraped_at >= NOW() - interval '2 days'`
        );
        
        if (googlCheck.rows.length === 0) {
            console.log('✅ Success: No false GOOGL tags found in recent Google News India articles.');
        } else {
            console.log(`❌ Found ${googlCheck.rows.length} Google News India articles incorrectly tagged as GOOGL.`);
            googlCheck.rows.slice(0, 3).forEach(r => console.log(` - ${r.title}`));
        }

    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}

verify();

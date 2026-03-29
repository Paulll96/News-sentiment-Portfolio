const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { query } = require('./db/index');
const axios = require('axios');

async function debugLinks() {
    try {
        // 1. Find articles that still have Google News URLs
        const result = await query(
            `SELECT id, title, url FROM news_articles 
             WHERE source = 'google_news_india' 
             AND url LIKE '%news.google.com%'
             LIMIT 10`
        );
        
        console.log(`Found ${result.rows.length} articles with unresolved Google URLs.\n`);
        
        if (result.rows.length === 0) {
            console.log('✅ All recent Google links in DB appear to be resolved.');
            return;
        }

        for (const row of result.rows) {
            console.log(`Testing: ${row.title}`);
            console.log(`URL: ${row.url}`);
            
            try {
                // Try to resolve manually with more detail
                const res = await axios.get(row.url, {
                    maxRedirects: 5,
                    timeout: 7000,
                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
                    validateStatus: (s) => true // Accept all statuses to debug
                });
                
                console.log(` - Status: ${res.status}`);
                console.log(` - Final URL: ${res.request.res.responseUrl || 'No final URL'}`);
                
                if (res.status >= 400) {
                  console.log(` - ❌ Error: Received ${res.status}`);
                }
            } catch (e) {
                console.log(` - ❌ Failed to resolve: ${e.message}`);
                if (e.response) {
                  console.log(` - Response Status: ${e.response.status}`);
                }
            }
            console.log('-----------------------------------------');
        }

    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}

debugLinks();

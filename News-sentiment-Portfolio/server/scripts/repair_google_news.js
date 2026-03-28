/**
 * One-off repair script for Google News India articles.
 * - Resolves broken redirect URLs.
 * - Sanitizes stored snippet content.
 * - Deletes stale sentiment scores for these articles.
 * - Resets 'processed' flag to trigger re-analysis with cleaned text.
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const { query } = require('../db');
const {
    resolveGoogleNewsUrl,
    sanitizeGoogleSnippet,
} = require('../services/googleNewsResolver');

async function repair() {
    console.log('🚀 Starting Google News repair (last 30 days)...');

    try {
        // 1. Fetch recent google_news_india articles
        const result = await query(
            `SELECT id, url, content, title FROM news_articles 
             WHERE source = 'google_news_india' 
             AND scraped_at >= NOW() - interval '30 days'
             ORDER BY scraped_at DESC`
        );

        const articles = result.rows;
        console.log(`Found ${articles.length} articles to check.`);

        let resolved = 0;
        let sanitized = 0;
        let duplicates = 0;

        // Process in batches of 4
        for (let i = 0; i < articles.length; i += 4) {
            const batch = articles.slice(i, i + 4);
            
            await Promise.all(batch.map(async (article) => {
                const finalUrl = await resolveGoogleNewsUrl(article.url);
                const cleanContent = sanitizeGoogleSnippet(article.content);

                // Check for URL collisions (unique constraint on 'url')
                if (finalUrl !== article.url) {
                    const existing = await query(
                        'SELECT id FROM news_articles WHERE url = $1 AND id != $2',
                        [finalUrl, article.id]
                    );

                    if (existing.rows.length > 0) {
                        console.log(`🗑️ Deleting duplicate Google row: ${article.id} (Final URL already exists)`);
                        await query('DELETE FROM sentiment_scores WHERE article_id = $1', [article.id]);
                        await query('DELETE FROM news_articles WHERE id = $1', [article.id]);
                        duplicates++;
                        return;
                    }
                    resolved++;
                }

                if (cleanContent !== article.content) sanitized++;

                // Update article and reset for re-analysis
                await query(
                    `UPDATE news_articles 
                     SET url = $1, content = $2, processed = false 
                     WHERE id = $3`,
                    [finalUrl, cleanContent, article.id]
                );

                // Clear old scores for this article
                await query('DELETE FROM sentiment_scores WHERE article_id = $1', [article.id]);
            }));

            if ((i + 4) % 20 === 0 || (i + 4) >= articles.length) {
                console.log(`Progress: ${Math.min(i + 4, articles.length)}/${articles.length} articles processed...`);
            }
        }

        console.log('\n✅ Repair complete!');
        console.log(`- Resolved URLs: ${resolved}`);
        console.log(`- Sanitized snippets: ${sanitized}`);
        console.log(`- Removed duplicates: ${duplicates}`);
        console.log('Articles have been reset for re-analysis. Run the analyzer next.');

    } catch (error) {
        console.error('❌ Repair failed:', error.message);
    } finally {
        process.exit();
    }
}

repair();

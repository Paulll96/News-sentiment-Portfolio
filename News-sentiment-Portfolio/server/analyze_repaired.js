const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { analyzeUnprocessedArticles } = require('./services/sentimentService');

async function main() {
    try {
        console.log('🚀 Triggering re-analysis of repaired articles...');
        const count = await analyzeUnprocessedArticles();
        console.log(`✅ Analyzed ${count} articles.`);
    } catch (e) {
        console.error('❌ Analysis failed:', e.message);
    } finally {
        process.exit();
    }
}

main();

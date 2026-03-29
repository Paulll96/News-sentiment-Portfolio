require('dotenv').config();
const { analyzeSentiment } = require('./server/services/sentimentService');
const { query } = require('./server/db');

async function verifyFinBERT() {
    console.log('--- Checking Database Logs ---');
    try {
        const dbResult = await query(
            `SELECT sentiment, confidence, source, analyzed_at
             FROM sentiment_scores
             ORDER BY analyzed_at DESC
             LIMIT 5`
        );
        console.log('Last 5 processed articles in DB:');
        console.table(dbResult.rows);
    } catch (e) {
        console.error('DB Check Failed:', e.message);
    }

    console.log('\n--- Running Live FinBERT Test ---');
    const apiKey = process.env.HUGGINGFACE_API_KEY;
    if (!apiKey || apiKey.startsWith('hf_xxxx')) {
        console.log('⚠️ WARNING: HUGGINGFACE_API_KEY is not set or is still a placeholder.');
        return;
    }

    const testHeadlines = [
        "Reliance Industries reports record breaking profits for Q3, shares jump 5%.",
        "Company XYZ facing a massive lawsuit and bankruptcy fears amid declining sales.",
        "The central bank held interest rates steady today, as expected by the market."
    ];

    for (const headline of testHeadlines) {
        console.log(`\nHeadline: "${headline}"`);
        try {
            const result = await analyzeSentiment(headline);
            console.log(`  -> Sentiment: ${result.sentiment.toUpperCase()}`);
            console.log(`  -> Confidence: ${(result.confidence * 100).toFixed(2)}%`);
            console.log(`  -> Source engine used: ${result.source}`);
            
            if (result.source === 'mock') {
                console.log('  ❌ FAILED: The system fell back to mock data instead of using FinBERT.');
            } else {
                console.log('  ✅ SUCCESS: Hugging Face API successfully analyzed this headline.');
            }
        } catch (error) {
            console.error('  -> Error:', error.message);
        }
    }
    
    console.log('\nDone.');
    process.exit(0);
}

verifyFinBERT();

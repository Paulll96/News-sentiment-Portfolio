const axios = require('axios');
const cheerio = require('cheerio');

async function testDDG(headline, domain) {
    console.log(`Testing search for: "${headline}" site:${domain}`);
    const searchTitle = headline.replace(/"/g, '');
    const query = domain ? `"${searchTitle}" site:${domain}` : `"${searchTitle}"`;
    
    try {
        const response = await axios.post('https://html.duckduckgo.com/html/', 
            new URLSearchParams({ q: query, b: '' }), // Post for html duckduckgo
            {
                headers: { 
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                timeout: 8000
            }
        );
        
        console.log("Response status:", response.status);
        const $ = cheerio.load(response.data);
        const candidates = [];
        
        $('.result__url').each((_, el) => {
            let href = $(el).attr('href');
            if (href) {
               if (href.startsWith('//duckduckgo.com/l/?')) {
                   try {
                       const u = new URL('https:' + href);
                       href = u.searchParams.get('uddg');
                   } catch { }
               }
               candidates.push(href.trim());
            }
        });
        
        console.log("Candidates found:", candidates);
        
    } catch (error) {
        console.error('DDG search error:', error.message);
    }
}

testDDG("JSW Steel, Coal India, Paytm, Sammaan Capital, Thermax among stocks in focus next week", "businesstoday.in");

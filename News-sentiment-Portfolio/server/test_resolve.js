const axios = require('axios');

async function testBatchexecute(id) {
    const url = "https://news.google.com/_/DotsSplashUi/data/batchexecute";
    
    // Construct the payload for garturlreq
    const innerPayload = JSON.stringify([
      "garturlreq",
      [
        ["en-IN","IN",["FINANCE_TOP_INDICES","WEB_TEST_1_0_0"],null,null,1,1,"IN:en",null,180,null,null,null,null,null,0,null,null,[1608992183,723341000]],
        "en-IN","IN",1,[2,3,4,8],1,0,"655000234",0,0,null,0
      ],
      id
    ]);
    
    const outerPayload = JSON.stringify([
      [
        ["Fbv4je", innerPayload, null, "generic"]
      ]
    ]);

    const formData = `f.req=${encodeURIComponent(outerPayload)}`;

    try {
        const response = await axios.post(url, formData, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://news.google.com/'
            },
            timeout: 10000
        });

        const data = response.data;
        console.log("Raw response received.");
        
        // The response from batchexecute is a weird JS-prefixed string
        // We need to parse it carefully.
        const match = data.match(/https?:\/\/[^\s"\\\]]+/g);
        if (match) {
            // Find the most likely destination URL (usually the longest or last one)
            const resolved = match.find(u => !u.includes('news.google.com') && !u.includes('gstatic.com'));
            console.log("Resolved URL:", resolved);
            return resolved;
        }
        
        console.log("No URL found in response.");
        return null;
    } catch (e) {
        console.error("Test failed:", e.message);
        return null;
    }
}

// Test with an ID from previous debug if possible, or a dummy
const testId = "CBMif0FVX3lxTE5iTDBVSHhRaGVCZ0lKS0lkaV9Dck9YVnpTWnpTdzVzM1ZzSjR6VnpTdnpTVnpTdnpTVnpTdnpTVnpTdnpTVnpTdnpTVnpTdnpTVnpTdnpTVnpTdnpTVnpTdnpTVnpTdnpTVnpTdnpTVnpTdnpTVnpTdnpTVnpTdnpTVnpTeHZ0W"; // Example ID
testBatchexecute(testId);

const CONFIG = { maxPositionPercent: 25, sentimentWeight: 0.6 };
function calculateTargetWeights(sentiments) {
    if (!Array.isArray(sentiments) || sentiments.length === 0) {
        return {};
    }

    const equalWeight = 1 / sentiments.length;
    const maxWeight = Math.max(0.01, CONFIG.maxPositionPercent / 100);
    const unnormalizedWeights = {};
    let totalUnnormalized = 0;

    sentiments.forEach(s => {
        // If no articles exist, sentiment should functionally be neutral (wss = 0)
        const effectiveWss = s.articleCount > 0 ? s.wss : 0;
        
        // Calculate scaling factor. e.g. WSS 1.0 => +60%, WSS -1.0 => -60%, WSS 0 => 0% change
        const factor = 1 + (effectiveWss * CONFIG.sentimentWeight);
        
        const weight = equalWeight * factor;
        unnormalizedWeights[s.symbol] = Math.max(0, weight);
        totalUnnormalized += unnormalizedWeights[s.symbol];
    });

    const targetWeights = {};

    // Initial normalization
    if (totalUnnormalized > 0) {
        Object.keys(unnormalizedWeights).forEach(symbol => {
            targetWeights[symbol] = unnormalizedWeights[symbol] / totalUnnormalized;
        });
    } else {
        return Object.fromEntries(sentiments.map(s => [s.symbol, equalWeight]));
    }

    // Iteratively enforce maxPositionPercent limit and redistribute excess proportionally
    let needsCapping = true;
    let iterations = 0;
    
    // Stop at 10 iterations to prevent infinite loops in impossible edge cases
    while (needsCapping && iterations < 10) {
        needsCapping = false;
        let excessWeight = 0;
        let uncappedSymbols = [];
        
        Object.keys(targetWeights).forEach(symbol => {
            if (targetWeights[symbol] > maxWeight) {
                // Excess logic
                excessWeight += (targetWeights[symbol] - maxWeight);
                targetWeights[symbol] = maxWeight;
                needsCapping = true;
            } else if (targetWeights[symbol] < maxWeight) {
                uncappedSymbols.push(symbol);
            }
        });
        
        if (needsCapping && uncappedSymbols.length > 0) {
            const sumUncapped = uncappedSymbols.reduce((sum, sym) => sum + targetWeights[sym], 0);
            if (sumUncapped > 0) {
                uncappedSymbols.forEach(sym => {
                    const proportion = targetWeights[sym] / sumUncapped;
                    targetWeights[sym] += excessWeight * proportion;
                });
            } else {
                // Fallback identical distribution
                uncappedSymbols.forEach(sym => {
                    targetWeights[sym] += excessWeight / uncappedSymbols.length;
                });
            }
        }
        iterations++;
    }

    // Final precision normalization to ensure exactly 100.0% sum
    const finalSum = Object.values(targetWeights).reduce((sum, w) => sum + w, 0);
    if (finalSum > 0) {
        Object.keys(targetWeights).forEach(symbol => {
            targetWeights[symbol] /= finalSum;
        });
    }

    return targetWeights;
}

const sentiments = [
    {symbol: 'RGL.NS', wss: -0.8, articleCount: 1}, // Very bearish
    {symbol: 'ABCAPITAL.NS', wss: -0.425, articleCount: 1}, // Moderately bearish
    {symbol: 'DGCONTENT.NS', wss: 0, articleCount: 0}, // Neutral (no articles)
    {symbol: 'RRKABEL.NS', wss: 0, articleCount: 1}, // Neutral (with articles)
    {symbol: 'HDFCBANK.NS', wss: 0.8, articleCount: 1}, // Very bullish
];

console.log("Weights:", JSON.stringify(calculateTargetWeights(sentiments), null, 2));

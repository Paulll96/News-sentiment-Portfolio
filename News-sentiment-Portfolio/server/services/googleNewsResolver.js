const axios = require('axios');

const GOOGLE_NEWS_HOST = 'news.google.com';
const GOOGLE_STATIC_HOSTS = new Set(['gstatic.com']);
const DEFAULT_USER_AGENT = 'Mozilla/5.0 SentinelQuant/1.0';

function safeParseUrl(value) {
    try {
        return new URL(String(value || '').trim());
    } catch {
        return null;
    }
}

function isGoogleNewsUrl(value) {
    const parsed = safeParseUrl(value);
    return Boolean(parsed && parsed.hostname.toLowerCase() === GOOGLE_NEWS_HOST);
}

function isResolvedPublisherUrl(value) {
    const parsed = safeParseUrl(value);
    if (!parsed) return false;
    if (!['http:', 'https:'].includes(parsed.protocol)) return false;

    const host = parsed.hostname.toLowerCase();
    if (!host || host === GOOGLE_NEWS_HOST) return false;
    if (GOOGLE_STATIC_HOSTS.has(host) || host.endsWith('.gstatic.com')) return false;

    return true;
}

async function followStandardRedirects(url) {
    if (!url) return null;

    try {
        const res = await axios.get(url, {
            maxRedirects: 3,
            timeout: 5000,
            headers: { 'User-Agent': DEFAULT_USER_AGENT },
            validateStatus: (status) => status >= 200 && status < 400,
        });

        return res?.request?.res?.responseUrl || url;
    } catch {
        return url;
    }
}

function extractGoogleNewsArticleToken(url) {
    const parsed = safeParseUrl(url);
    if (!parsed) return null;

    const articleMatch = parsed.pathname.match(/\/(?:rss\/)?articles\/([^/?#]+)/i);
    if (articleMatch?.[1]) {
        return decodeURIComponent(articleMatch[1]);
    }

    const readMatch = parsed.pathname.match(/\/read\/([^/?#]+)/i);
    if (readMatch?.[1]) {
        return decodeURIComponent(readMatch[1]);
    }

    return null;
}

function normalizeBatchExecuteResponse(data) {
    return String(data || '')
        .replace(/\\u003d/gi, '=')
        .replace(/\\u0026/gi, '&')
        .replace(/\\u002f/gi, '/')
        .replace(/\\\//g, '/');
}

function extractPublisherUrlCandidates(data) {
    const normalized = normalizeBatchExecuteResponse(data);
    const matches = normalized.match(/https?:\/\/[^\s"'\\\]]+/g) || [];
    const unique = [];
    const seen = new Set();

    for (const match of matches) {
        if (seen.has(match)) continue;
        seen.add(match);
        if (isResolvedPublisherUrl(match)) {
            unique.push(match);
        }
    }

    return unique;
}

async function decodeGoogleNewsToken(token) {
    if (!token) return null;

    const innerPayload = JSON.stringify([
        'garturlreq',
        [
            ['en-IN', 'IN', ['FINANCE_TOP_INDICES', 'WEB_TEST_1_0_0'], null, null, 1, 1, 'IN:en', null, 180, null, null, null, null, null, 0, null, null, [1608992183, 723341000]],
            'en-IN',
            'IN',
            1,
            [2, 3, 4, 8],
            1,
            0,
            '655000234',
            0,
            0,
            null,
            0,
        ],
        token,
    ]);

    const outerPayload = JSON.stringify([
        [
            ['Fbv4je', innerPayload, null, 'generic'],
        ],
    ]);

    try {
        const response = await axios.post(
            'https://news.google.com/_/DotsSplashUi/data/batchexecute',
            `f.req=${encodeURIComponent(outerPayload)}`,
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Referer': 'https://news.google.com/',
                },
                timeout: 10000,
                validateStatus: (status) => status >= 200 && status < 300,
            }
        );

        const candidates = extractPublisherUrlCandidates(response.data);
        return candidates[0] || null;
    } catch {
        return null;
    }
}

async function resolveGoogleNewsUrl(url) {
    if (!isGoogleNewsUrl(url)) return url;

    const redirectedUrl = await followStandardRedirects(url);
    if (isResolvedPublisherUrl(redirectedUrl)) {
        return redirectedUrl;
    }

    const token = extractGoogleNewsArticleToken(redirectedUrl) || extractGoogleNewsArticleToken(url);
    if (!token) {
        return redirectedUrl || url;
    }

    const decodedUrl = await decodeGoogleNewsToken(token);
    if (!decodedUrl) {
        return redirectedUrl || url;
    }

    const finalizedUrl = await followStandardRedirects(decodedUrl);
    if (isResolvedPublisherUrl(finalizedUrl)) {
        return finalizedUrl;
    }

    return decodedUrl;
}

function sanitizeGoogleSnippet(text) {
    if (!text) return null;

    return String(text)
        .replace(/<[^>]*>/g, ' ')
        .replace(/https?:\/\/[^\s]+/g, ' ')
        .replace(/&[a-z0-9]+;/gi, ' ')
        .replace(/Google News/gi, '')
        .replace(/&middot;/gi, '|')
        .replace(/\s+/g, ' ')
        .trim() || null;
}

function extractPublisherHintFromTitle(title) {
    if (!title) return null;
    const parts = title.split(' - ');
    if (parts.length > 1) {
        return parts.pop().trim();
    }
    return null;
}

function mapPublisherHintToDomain(hint) {
    if (!hint) return null;

    if (hint.includes('.') && !hint.includes(' ')) {
        return hint.toLowerCase();
    }

    const map = {
        'business today': 'businesstoday.in',
        'the economic times': 'economictimes.indiatimes.com',
        'mint': 'livemint.com',
        'news18': 'news18.com',
        'moneycontrol': 'moneycontrol.com',
        'ndtv profit': 'ndtvprofit.com',
        'bq prime': 'bqprime.com',
        'cnbc tv18': 'cnbctv18.com',
        'business standard': 'business-standard.com',
        'financial express': 'financialexpress.com',
        'zeebiz': 'zeebiz.com',
        'goodreturns': 'goodreturns.in'
    };

    const lowerHint = hint.toLowerCase();
    for (const [key, domain] of Object.entries(map)) {
        if (lowerHint.includes(key)) {
            return domain;
        }
    }

    return null;
}

function buildNewsSearchFallbackUrl(title) {
    if (!title) return 'https://news.google.com';

    const parts = title.split(' - ');
    const searchTitle = parts.length > 1 ? parts.slice(0, -1).join(' - ') : title;

    const hint = extractPublisherHintFromTitle(title);
    const domain = mapPublisherHintToDomain(hint);

    let query = `"${searchTitle.replace(/"/g, '')}"`;
    if (domain) {
        query += ` site:${domain}`;
    }

    return `https://www.google.com/search?btnI=I&q=${encodeURIComponent(query)}`;
}

module.exports = {
    extractGoogleNewsArticleToken,
    isGoogleNewsUrl,
    isResolvedPublisherUrl,
    resolveGoogleNewsUrl,
    sanitizeGoogleSnippet,
    extractPublisherHintFromTitle,
    mapPublisherHintToDomain,
    buildNewsSearchFallbackUrl,
};

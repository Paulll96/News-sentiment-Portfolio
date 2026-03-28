// API utility for SentinelQuant
const API_URL = '/api';

export async function apiRequest(endpoint, options = {}) {
    const token = localStorage.getItem('token');
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    let res;
    try {
        res = await fetch(`${API_URL}${endpoint}`, { ...options, headers });
    } catch (error) {
        if (error?.name === 'AbortError') {
            throw error;
        }
        const networkError = new Error('Network error. Please try again.');
        networkError.status = 0;
        networkError.code = 'NETWORK_ERROR';
        throw networkError;
    }

    const contentType = res.headers.get('content-type') || '';
    const isJson = contentType.includes('application/json');
    const data = isJson
        ? await res.json().catch(() => ({}))
        : { error: await res.text().catch(() => '') };

    if (!res.ok) {
        const err = new Error(data?.error || data?.message || `Request failed (${res.status})`);
        err.status = res.status;
        err.statusText = res.statusText;
        err.code = data?.code;
        err.details = data?.details;
        err.payload = data;
        throw err;
    }
    return data;
}

export function formatCurrency(v, currency = 'INR', locale = 'en-IN') {
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(v);
}

export function formatPercent(v) {
    return (v * 100).toFixed(2) + '%';
}

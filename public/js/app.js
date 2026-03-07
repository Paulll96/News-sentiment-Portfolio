/**
 * SentinelQuant - Frontend JavaScript Application
 * News-Sentiment-Driven Quant Portfolio
 */

// API Base URL
const API_URL = '/api';

// State
let currentUser = null;
let authToken = localStorage.getItem('token');

// =========================================
// Utility Functions
// =========================================

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <span>${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}</span>
        <span>${message}</span>
    `;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
}

async function apiRequest(endpoint, options = {}) {
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };

    if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
    }

    try {
        const response = await fetch(`${API_URL}${endpoint}`, {
            ...options,
            headers
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Request failed');
        }

        return data;
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}

function formatCurrency(value) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(value);
}

function formatPercent(value) {
    return (value * 100).toFixed(2) + '%';
}

// =========================================
// Navigation
// =========================================

document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const section = link.dataset.section;

        // Update active states
        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        link.classList.add('active');

        // Show section
        document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
        document.getElementById(section).classList.add('active');

        // Load section data
        loadSectionData(section);
    });
});

function loadSectionData(section) {
    switch (section) {
        case 'dashboard':
            initDashboard();
            break;
        case 'sentiment':
            loadSentimentData();
            break;
        case 'portfolio':
            loadPortfolioData();
            break;
        case 'news':
            loadNewsData();
            break;
    }
}

// =========================================
// Authentication
// =========================================

const authModal = document.getElementById('authModal');
const loginBtn = document.getElementById('loginBtn');
const signupBtn = document.getElementById('signupBtn');
const closeModal = document.getElementById('closeModal');
const authForm = document.getElementById('authForm');
const authSwitchLink = document.getElementById('authSwitchLink');

let isLoginMode = true;

loginBtn.addEventListener('click', () => {
    isLoginMode = true;
    updateAuthModal();
    authModal.classList.add('active');
});

signupBtn.addEventListener('click', () => {
    isLoginMode = false;
    updateAuthModal();
    authModal.classList.add('active');
});

closeModal.addEventListener('click', () => {
    authModal.classList.remove('active');
});

authSwitchLink.addEventListener('click', (e) => {
    e.preventDefault();
    isLoginMode = !isLoginMode;
    updateAuthModal();
});

function updateAuthModal() {
    document.getElementById('authModalTitle').textContent = isLoginMode ? 'Login' : 'Sign Up';
    document.getElementById('nameGroup').style.display = isLoginMode ? 'none' : 'block';
    document.getElementById('authSubmitBtn').textContent = isLoginMode ? 'Login' : 'Sign Up';
    document.getElementById('authSwitchText').textContent = isLoginMode ? "Don't have an account?" : "Already have an account?";
    document.getElementById('authSwitchLink').textContent = isLoginMode ? 'Sign up' : 'Login';
}

authForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('authEmail').value;
    const password = document.getElementById('authPassword').value;
    const name = document.getElementById('authName').value;

    try {
        const endpoint = isLoginMode ? '/auth/login' : '/auth/register';
        const body = isLoginMode ? { email, password } : { email, password, name };

        const data = await apiRequest(endpoint, {
            method: 'POST',
            body: JSON.stringify(body)
        });

        authToken = data.token;
        localStorage.setItem('token', authToken);
        currentUser = data.user;

        showToast(`Welcome${currentUser.name ? ', ' + currentUser.name : ''}!`, 'success');
        authModal.classList.remove('active');
        updateAuthUI();

    } catch (error) {
        showToast(error.message, 'error');
    }
});

function updateAuthUI() {
    const authDiv = document.querySelector('.nav-auth');
    if (currentUser) {
        authDiv.innerHTML = `
            <span style="color: var(--text-secondary)">👤 ${currentUser.email}</span>
            <button class="btn btn-outline" onclick="logout()">Logout</button>
        `;
    } else {
        authDiv.innerHTML = `
            <button id="loginBtn" class="btn btn-outline">Login</button>
            <button id="signupBtn" class="btn btn-primary">Sign Up</button>
        `;
    }
}

function logout() {
    localStorage.removeItem('token');
    authToken = null;
    currentUser = null;
    updateAuthUI();
    showToast('Logged out successfully', 'info');
}

// =========================================
// Dashboard Charts
// =========================================

let performanceChart = null;
let allocationChart = null;

function initDashboard() {
    initPerformanceChart();
    initAllocationChart();
    initHeatmap();
    updateTickerContent();
}

function initPerformanceChart() {
    const ctx = document.getElementById('performanceChart');
    if (!ctx) return;

    if (performanceChart) performanceChart.destroy();

    // Generate sample data
    const labels = [];
    const portfolioData = [];
    const benchmarkData = [];

    let portfolioValue = 10000;
    let benchmarkValue = 10000;

    for (let i = 0; i < 24; i++) {
        const date = new Date();
        date.setMonth(date.getMonth() - (23 - i));
        labels.push(date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }));

        portfolioValue *= 1 + (Math.random() * 0.04 - 0.01);
        benchmarkValue *= 1 + (Math.random() * 0.03 - 0.01);

        portfolioData.push(Math.round(portfolioValue));
        benchmarkData.push(Math.round(benchmarkValue));
    }

    performanceChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [
                {
                    label: 'Portfolio',
                    data: portfolioData,
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    fill: true,
                    tension: 0.4
                },
                {
                    label: 'S&P 500',
                    data: benchmarkData,
                    borderColor: '#64748b',
                    borderDash: [5, 5],
                    fill: false,
                    tension: 0.4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    ticks: { color: '#64748b' }
                },
                y: {
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    ticks: {
                        color: '#64748b',
                        callback: value => '$' + value.toLocaleString()
                    }
                }
            }
        }
    });
}

function initAllocationChart() {
    const ctx = document.getElementById('allocationChart');
    if (!ctx) return;

    if (allocationChart) allocationChart.destroy();

    allocationChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['AAPL', 'MSFT', 'GOOGL', 'TSLA', 'NVDA', 'Others'],
            datasets: [{
                data: [22, 18, 15, 14, 12, 19],
                backgroundColor: [
                    '#3b82f6',
                    '#8b5cf6',
                    '#10b981',
                    '#f59e0b',
                    '#06b6d4',
                    '#64748b'
                ],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '65%',
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { color: '#94a3b8', padding: 15 }
                }
            }
        }
    });
}

function initHeatmap() {
    const grid = document.getElementById('heatmapGrid');
    if (!grid) return;

    const stocks = [
        { symbol: 'AAPL', score: 0.72 },
        { symbol: 'MSFT', score: 0.45 },
        { symbol: 'GOOGL', score: 0.55 },
        { symbol: 'AMZN', score: 0.38 },
        { symbol: 'TSLA', score: -0.32 },
        { symbol: 'NVDA', score: 0.88 },
        { symbol: 'META', score: -0.18 },
        { symbol: 'JPM', score: 0.12 },
        { symbol: 'V', score: 0.25 },
        { symbol: 'JNJ', score: -0.05 }
    ];

    grid.innerHTML = stocks.map(stock => {
        const sentiment = stock.score > 0.2 ? 'bullish' : stock.score < -0.2 ? 'bearish' : 'neutral';
        return `
            <div class="heatmap-cell ${sentiment}">
                <span class="symbol">${stock.symbol}</span>
                <span class="score">${stock.score > 0 ? '+' : ''}${stock.score.toFixed(2)}</span>
            </div>
        `;
    }).join('');
}

function updateTickerContent() {
    // Duplicate ticker content for seamless scrolling
    const ticker = document.getElementById('tickerContent');
    if (ticker) {
        ticker.innerHTML += ticker.innerHTML;
    }
}

// =========================================
// Sentiment Section
// =========================================

async function loadSentimentData() {
    const tbody = document.getElementById('sentimentTableBody');
    if (!tbody) return;

    try {
        const data = await apiRequest('/sentiment');

        tbody.innerHTML = data.sentiments.map(s => `
            <tr>
                <td><strong>${s.symbol}</strong></td>
                <td>${s.name}</td>
                <td style="color: ${s.wss > 0 ? 'var(--accent-green)' : s.wss < 0 ? 'var(--accent-red)' : 'inherit'}">
                    ${s.wss > 0 ? '+' : ''}${s.wss.toFixed(3)}
                </td>
                <td>
                    <span class="signal-badge ${s.signal}">${s.signal.toUpperCase()}</span>
                </td>
                <td>${s.articleCount}</td>
                <td>${s.wss > 0 ? '📈' : s.wss < 0 ? '📉' : '➡️'}</td>
            </tr>
        `).join('');

    } catch (error) {
        // Load mock data if API fails
        loadMockSentimentData();
    }
}

function loadMockSentimentData() {
    const tbody = document.getElementById('sentimentTableBody');
    const mockData = [
        { symbol: 'NVDA', name: 'NVIDIA Corporation', wss: 0.88, signal: 'bullish', articles: 245 },
        { symbol: 'AAPL', name: 'Apple Inc.', wss: 0.72, signal: 'bullish', articles: 312 },
        { symbol: 'GOOGL', name: 'Alphabet Inc.', wss: 0.55, signal: 'bullish', articles: 189 },
        { symbol: 'MSFT', name: 'Microsoft Corporation', wss: 0.45, signal: 'bullish', articles: 267 },
        { symbol: 'AMZN', name: 'Amazon.com Inc.', wss: 0.38, signal: 'bullish', articles: 198 },
        { symbol: 'JPM', name: 'JPMorgan Chase', wss: 0.12, signal: 'neutral', articles: 134 },
        { symbol: 'JNJ', name: 'Johnson & Johnson', wss: -0.05, signal: 'neutral', articles: 87 },
        { symbol: 'META', name: 'Meta Platforms', wss: -0.18, signal: 'neutral', articles: 156 },
        { symbol: 'TSLA', name: 'Tesla Inc.', wss: -0.32, signal: 'bearish', articles: 423 },
        { symbol: 'V', name: 'Visa Inc.', wss: 0.25, signal: 'bullish', articles: 78 }
    ];

    tbody.innerHTML = mockData.map(s => `
        <tr>
            <td><strong>${s.symbol}</strong></td>
            <td>${s.name}</td>
            <td style="color: ${s.wss > 0 ? 'var(--accent-green)' : s.wss < 0 ? 'var(--accent-red)' : 'inherit'}">
                ${s.wss > 0 ? '+' : ''}${s.wss.toFixed(3)}
            </td>
            <td>
                <span class="signal-badge ${s.signal}">${s.signal.toUpperCase()}</span>
            </td>
            <td>${s.articles}</td>
            <td>${s.wss > 0 ? '📈' : s.wss < 0 ? '📉' : '➡️'}</td>
        </tr>
    `).join('');
}

document.getElementById('refreshSentiment')?.addEventListener('click', loadSentimentData);

// =========================================
// Portfolio Section
// =========================================

async function loadPortfolioData() {
    const holdingsList = document.getElementById('holdingsList');
    if (!holdingsList) return;

    if (!authToken) {
        holdingsList.innerHTML = '<p class="empty-state">Please login to view your portfolio</p>';
        return;
    }

    try {
        const data = await apiRequest('/portfolio');

        if (data.holdings.length === 0) {
            holdingsList.innerHTML = '<p class="empty-state">No holdings yet. Click "Initialize Portfolio" to start.</p>';
            return;
        }

        holdingsList.innerHTML = data.holdings.map(h => `
            <div class="holding-item">
                <div class="holding-info">
                    <div>
                        <div class="holding-symbol">${h.symbol}</div>
                        <div class="holding-name">${h.name}</div>
                    </div>
                </div>
                <div class="holding-value">
                    <div class="holding-amount">${formatCurrency(h.currentValue)}</div>
                    <div class="holding-weight">${h.weight.toFixed(1)}%</div>
                </div>
            </div>
        `).join('');

    } catch (error) {
        loadMockPortfolioData();
    }
}

function loadMockPortfolioData() {
    const holdingsList = document.getElementById('holdingsList');
    const mockHoldings = [
        { symbol: 'NVDA', name: 'NVIDIA', value: 2800, weight: 22.5 },
        { symbol: 'AAPL', name: 'Apple', value: 2450, weight: 19.7 },
        { symbol: 'MSFT', name: 'Microsoft', value: 2100, weight: 16.9 },
        { symbol: 'GOOGL', name: 'Alphabet', value: 1850, weight: 14.9 },
        { symbol: 'AMZN', name: 'Amazon', value: 1600, weight: 12.9 },
        { symbol: 'TSLA', name: 'Tesla', value: 1650, weight: 13.3 }
    ];

    holdingsList.innerHTML = mockHoldings.map(h => `
        <div class="holding-item">
            <div class="holding-info">
                <div>
                    <div class="holding-symbol">${h.symbol}</div>
                    <div class="holding-name">${h.name}</div>
                </div>
            </div>
            <div class="holding-value">
                <div class="holding-amount">${formatCurrency(h.value)}</div>
                <div class="holding-weight">${h.weight}%</div>
            </div>
        </div>
    `).join('');
}

document.getElementById('initPortfolioBtn')?.addEventListener('click', async () => {
    if (!authToken) {
        showToast('Please login first', 'error');
        return;
    }

    try {
        await apiRequest('/portfolio/initialize', { method: 'POST' });
        showToast('Portfolio initialized!', 'success');
        loadPortfolioData();
    } catch (error) {
        showToast(error.message, 'error');
    }
});

document.getElementById('rebalanceBtn')?.addEventListener('click', async () => {
    if (!authToken) {
        showToast('Please login first', 'error');
        return;
    }

    try {
        const data = await apiRequest('/portfolio/rebalance', {
            method: 'POST',
            body: JSON.stringify({ dryRun: true })
        });

        const tradesList = document.getElementById('tradesList');
        if (data.trades.length === 0) {
            tradesList.innerHTML = '<p class="empty-state">Portfolio is already balanced!</p>';
        } else {
            tradesList.innerHTML = data.trades.map(t => `
                <div class="trade-item" style="border-left: 3px solid ${t.type === 'buy' ? 'var(--accent-green)' : 'var(--accent-red)'}">
                    <div>
                        <strong>${t.type.toUpperCase()}</strong> ${t.symbol}
                        <div style="font-size: 0.75rem; color: var(--text-secondary)">${t.currentWeight} → ${t.targetWeight}</div>
                    </div>
                    <div style="text-align: right">
                        <div>${formatCurrency(t.tradeValue)}</div>
                        <div style="font-size: 0.75rem">${t.signal}</div>
                    </div>
                </div>
            `).join('');
        }

        showToast('Rebalance preview generated', 'success');
    } catch (error) {
        showToast(error.message, 'error');
    }
});

// =========================================
// Backtest Section
// =========================================

let equityCurveChart = null;

document.getElementById('backtestEnd').value = new Date().toISOString().split('T')[0];

document.getElementById('runBacktestBtn')?.addEventListener('click', async () => {
    const startDate = document.getElementById('backtestStart').value;
    const endDate = document.getElementById('backtestEnd').value;
    const initialCapital = document.getElementById('backtestCapital').value;

    try {
        showToast('Running backtest...', 'info');

        // Simulate backtest locally if not authenticated
        const result = authToken ?
            await apiRequest('/backtest/run', {
                method: 'POST',
                body: JSON.stringify({ startDate, endDate, initialCapital })
            }) : simulateBacktest(startDate, endDate, initialCapital);

        // Show results
        document.getElementById('backtestResults').style.display = 'block';
        document.getElementById('btFinalValue').textContent = formatCurrency(result.summary.finalValue);
        document.getElementById('btTotalReturn').textContent = result.summary.totalReturn;
        document.getElementById('btCAGR').textContent = result.summary.cagr;
        document.getElementById('btSharpe').textContent = result.summary.sharpeRatio;
        document.getElementById('btAlpha').textContent = result.summary.alpha;
        document.getElementById('btDrawdown').textContent = result.summary.maxDrawdown;

        // Draw equity curve
        drawEquityCurve(result.equityCurve);

        showToast('Backtest completed!', 'success');
    } catch (error) {
        showToast(error.message, 'error');
    }
});

function simulateBacktest(startDate, endDate, initialCapital) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const years = (end - start) / (365 * 24 * 60 * 60 * 1000);

    const cagr = 0.15 + Math.random() * 0.10;
    const finalValue = initialCapital * Math.pow(1 + cagr, years);

    const equityCurve = [];
    const months = Math.floor(years * 12);
    let value = parseFloat(initialCapital);
    const monthlyReturn = Math.pow(1 + cagr, 1 / 12) - 1;

    for (let i = 0; i <= months; i++) {
        const date = new Date(start);
        date.setMonth(date.getMonth() + i);
        value *= (1 + monthlyReturn + (Math.random() - 0.5) * 0.02);
        equityCurve.push({
            date: date.toISOString().split('T')[0],
            value: Math.round(value * 100) / 100,
            benchmark: initialCapital * Math.pow(1.10, i / 12)
        });
    }

    return {
        summary: {
            finalValue: finalValue.toFixed(2),
            totalReturn: ((finalValue / initialCapital - 1) * 100).toFixed(2) + '%',
            cagr: (cagr * 100).toFixed(2) + '%',
            sharpeRatio: (1.2 + Math.random() * 0.5).toFixed(2),
            alpha: (0.02 + Math.random() * 0.03).toFixed(2) + '%',
            maxDrawdown: (0.10 + Math.random() * 0.15).toFixed(2) + '%'
        },
        equityCurve
    };
}

function drawEquityCurve(data) {
    const ctx = document.getElementById('equityCurveChart');
    if (!ctx) return;

    if (equityCurveChart) equityCurveChart.destroy();

    equityCurveChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.map(d => d.date),
            datasets: [
                {
                    label: 'Portfolio',
                    data: data.map(d => d.value),
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    fill: true,
                    tension: 0.4
                },
                {
                    label: 'Benchmark',
                    data: data.map(d => d.benchmark),
                    borderColor: '#64748b',
                    borderDash: [5, 5],
                    fill: false,
                    tension: 0.4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: { color: '#94a3b8' }
                }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    ticks: { color: '#64748b', maxTicksLimit: 12 }
                },
                y: {
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    ticks: {
                        color: '#64748b',
                        callback: value => '$' + value.toLocaleString()
                    }
                }
            }
        }
    });
}

// =========================================
// News Section
// =========================================

async function loadNewsData() {
    const feed = document.getElementById('newsFeed');
    if (!feed) return;

    try {
        const data = await apiRequest('/news/live');

        if (data.articles.length === 0) {
            loadMockNewsData();
            return;
        }

        feed.innerHTML = data.articles.map(article => {
            const sentiment = article.sentiment || 'neutral';
            const icon = sentiment === 'positive' ? '📈' : sentiment === 'negative' ? '📉' : '📰';

            return `
                <div class="news-item">
                    <div class="news-sentiment ${sentiment}">${icon}</div>
                    <div class="news-content">
                        <div class="news-title">
                            <a href="${article.url}" target="_blank">${article.title}</a>
                        </div>
                        <div class="news-meta">
                            <span class="news-source">${article.source}</span>
                            <span>${new Date(article.published_at).toLocaleString()}</span>
                            ${article.symbol ? `<span>📌 ${article.symbol}</span>` : ''}
                        </div>
                    </div>
                </div>
            `;
        }).join('');

    } catch (error) {
        loadMockNewsData();
    }
}

function loadMockNewsData() {
    const feed = document.getElementById('newsFeed');
    const mockNews = [
        { title: 'NVIDIA Announces Record-Breaking Q4 Earnings, AI Demand Soars', source: 'Reuters', sentiment: 'positive', time: '2 hours ago', symbol: 'NVDA' },
        { title: 'Apple Vision Pro Sales Exceed Expectations in First Month', source: 'Bloomberg', sentiment: 'positive', time: '3 hours ago', symbol: 'AAPL' },
        { title: 'Tesla Faces Production Delays at Berlin Factory', source: 'WSJ', sentiment: 'negative', time: '4 hours ago', symbol: 'TSLA' },
        { title: 'Microsoft Azure Growth Accelerates Amid AI Integration', source: 'CNBC', sentiment: 'positive', time: '5 hours ago', symbol: 'MSFT' },
        { title: 'Reddit IPO Filing Reveals Growing User Base', source: 'TechCrunch', sentiment: 'neutral', time: '6 hours ago', symbol: null },
        { title: 'Amazon Web Services Announces New AI Features', source: 'Yahoo Finance', sentiment: 'positive', time: '7 hours ago', symbol: 'AMZN' },
        { title: 'Meta Stock Drops on Advertising Revenue Concerns', source: 'MarketWatch', sentiment: 'negative', time: '8 hours ago', symbol: 'META' },
        { title: 'Google DeepMind Achieves Breakthrough in Protein Folding', source: 'Nature', sentiment: 'positive', time: '10 hours ago', symbol: 'GOOGL' }
    ];

    feed.innerHTML = mockNews.map(article => {
        const icon = article.sentiment === 'positive' ? '📈' : article.sentiment === 'negative' ? '📉' : '📰';

        return `
            <div class="news-item">
                <div class="news-sentiment ${article.sentiment}">${icon}</div>
                <div class="news-content">
                    <div class="news-title">
                        <a href="#">${article.title}</a>
                    </div>
                    <div class="news-meta">
                        <span class="news-source">${article.source}</span>
                        <span>${article.time}</span>
                        ${article.symbol ? `<span>📌 ${article.symbol}</span>` : ''}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

document.getElementById('scrapeNewsBtn')?.addEventListener('click', async () => {
    try {
        showToast('Scraping news...', 'info');
        await apiRequest('/news/scrape', { method: 'POST' });
        showToast('News scraped successfully!', 'success');
        loadNewsData();
    } catch (error) {
        showToast(error.message, 'error');
    }
});

document.getElementById('analyzeNewsBtn')?.addEventListener('click', async () => {
    try {
        showToast('Analyzing sentiment...', 'info');
        await apiRequest('/sentiment/analyze', { method: 'POST' });
        showToast('Analysis complete!', 'success');
        loadNewsData();
        loadSentimentData();
    } catch (error) {
        showToast(error.message, 'error');
    }
});

// =========================================
// Initialize Application
// =========================================

document.addEventListener('DOMContentLoaded', () => {
    // Check for existing auth
    if (authToken) {
        apiRequest('/auth/me')
            .then(data => {
                currentUser = data.user;
                updateAuthUI();
            })
            .catch(() => {
                localStorage.removeItem('token');
                authToken = null;
            });
    }

    // Initialize dashboard
    initDashboard();
    loadSentimentData();
});

// Export for global access
window.logout = logout;

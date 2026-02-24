/**
 * SentinelQuant - News-Sentiment-Driven Quant Portfolio
 * Main Express Server
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const rateLimit = require('express-rate-limit');

// Import routes
const authRoutes = require('./routes/auth');
const portfolioRoutes = require('./routes/portfolio');
const sentimentRoutes = require('./routes/sentiment');
const newsRoutes = require('./routes/news');
const backtestRoutes = require('./routes/backtest');
const stocksRoutes = require('./routes/stocks');
const adminRoutes = require('./routes/admin');
const usersRoutes = require('./routes/users');
const watchlistRoutes = require('./routes/watchlist');
const notificationsRoutes = require('./routes/notifications');
const twoFactorRoutes = require('./routes/twoFactor');

// Import database and socket
const db = require('./db');
const { initializeSocket } = require('./socket');

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware — enable CSP with necessary directives for charts/fonts
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "blob:"],
            connectSrc: ["'self'", "ws:", "wss:", process.env.FRONTEND_URL || "http://localhost:5173"],
        }
    }
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: { error: 'Too many requests, please try again later.' }
});
app.use('/api/', limiter);

// CORS configuration
const allowedOrigins = process.env.FRONTEND_URL
    ? process.env.FRONTEND_URL.split(',').map(s => s.trim())
    : ['http://localhost:5173', 'http://localhost:3000'];
app.use(cors({
    origin: allowedOrigins,
    credentials: true
}));

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging
app.use(morgan('dev'));

// API Routes (registered BEFORE static files so /api/* always resolves to JSON)
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/portfolio', portfolioRoutes);
app.use('/api/sentiment', sentimentRoutes);
app.use('/api/news', newsRoutes);
app.use('/api/backtest', backtestRoutes);
app.use('/api/stocks', stocksRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/watchlist', watchlistRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/2fa', twoFactorRoutes);

// Health check endpoint — checks real dependency state
app.get('/api/health', async (req, res) => {
    let dbStatus = 'unreachable';
    try {
        await db.query('SELECT 1');
        dbStatus = 'operational';
    } catch { /* leave as unreachable */ }

    const healthy = dbStatus === 'operational';
    res.status(healthy ? 200 : 503).json({
        status: healthy ? 'healthy' : 'degraded',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        services: {
            api: 'operational',
            database: dbStatus,
            sentiment_engine: process.env.HUGGINGFACE_API_KEY ? 'configured' : 'mock_mode'
        }
    });
});

// API documentation endpoint
app.get('/api', (req, res) => {
    res.json({
        name: 'SentinelQuant API',
        version: '1.0.0',
        description: 'News-Sentiment-Driven Quant Portfolio API',
        endpoints: {
            auth: '/api/auth',
            users: '/api/users',
            portfolio: '/api/portfolio',
            sentiment: '/api/sentiment',
            news: '/api/news',
            backtest: '/api/backtest',
            stocks: '/api/stocks',
            watchlist: '/api/watchlist',
            notifications: '/api/notifications',
            admin: '/api/admin (requires admin role)'
        }
    });
});

// Catch-all for unknown /api/* routes → return JSON 404, NOT HTML
app.all('/api/*', (req, res) => {
    res.status(404).json({ error: `API endpoint not found: ${req.method} ${req.path}` });
});

// Serve React production build (client/dist) if it exists, otherwise fallback info
const clientDistPath = path.join(__dirname, '../client/dist');
app.use(express.static(clientDistPath));

// SPA fallback — serves React index.html for all non-API routes
app.get('*', (req, res) => {
    const indexPath = path.join(clientDistPath, 'index.html');
    const fs = require('fs');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.status(200).send(`
            <h2>SentinelQuant API is running</h2>
            <p>React app not built yet. Run <code>cd client && npm run build</code> to generate production build.</p>
            <p>API docs: <a href="/api">/api</a> | Health: <a href="/api/health">/api/health</a></p>
        `);
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err.message);
    res.status(err.status || 500).json({
        error: err.message || 'Internal Server Error',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
});

// Start server with Socket.IO
const http = require('http');
const httpServer = http.createServer(app);

// Initialize Socket.IO on the HTTP server
const io = initializeSocket(httpServer);

httpServer.listen(PORT, () => {
    console.log(`
    ╔═══════════════════════════════════════════════════════╗
    ║                                                       ║
    ║   🚀 SentinelQuant Server Started                     ║
    ║                                                       ║
    ║   📊 News-Sentiment-Driven Quant Portfolio            ║
    ║   🌐 http://localhost:${PORT}                           ║
    ║   📡 API: http://localhost:${PORT}/api                  ║
    ║   ⚡ WebSocket: Socket.IO active                      ║
    ║                                                       ║
    ╚═══════════════════════════════════════════════════════╝
    `);

    // Start automated background tasks
    require('./cron').startCronJobs();
});

module.exports = app;

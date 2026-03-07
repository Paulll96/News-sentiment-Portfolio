/**
 * Socket.IO — Real-time WebSocket server
 * Broadcasts live events: sentiment updates, scrape status, notifications
 */

const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

let io = null;

/**
 * Initialize Socket.IO on an existing HTTP server
 * @param {http.Server} httpServer
 * @returns {Server} Socket.IO server instance
 */
function initializeSocket(httpServer) {
    io = new Server(httpServer, {
        cors: {
            origin: process.env.FRONTEND_URL || 'http://localhost:5173',
            methods: ['GET', 'POST'],
            credentials: true,
        },
        pingTimeout: 60000,
        pingInterval: 25000,
    });

    // Authentication middleware — verify JWT on connection
    io.use((socket, next) => {
        const token = socket.handshake.auth?.token;
        if (!token) {
            // Allow unauthenticated connections (public feed)
            socket.user = null;
            return next();
        }

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            socket.user = decoded;
            next();
        } catch {
            // Invalid token — still allow public feed
            socket.user = null;
            next();
        }
    });

    io.on('connection', (socket) => {
        const userId = socket.user?.userId;
        console.log(`🔌 Socket connected: ${socket.id}${userId ? ` (user: ${userId})` : ' (anonymous)'}`);

        // Join user-specific room for targeted notifications
        if (userId) {
            socket.join(`user:${userId}`);
        }

        // Join public rooms for live feeds
        socket.join('sentiment-feed');

        // Handle stock symbol subscription
        socket.on('subscribe:stock', (symbol) => {
            socket.join(`stock:${symbol.toUpperCase()}`);
            console.log(`📊 ${socket.id} subscribed to stock:${symbol.toUpperCase()}`);
        });

        socket.on('unsubscribe:stock', (symbol) => {
            socket.leave(`stock:${symbol.toUpperCase()}`);
        });

        socket.on('disconnect', (reason) => {
            console.log(`🔌 Socket disconnected: ${socket.id} (${reason})`);
        });
    });

    console.log('⚡ Socket.IO initialized');
    return io;
}

/**
 * Get the Socket.IO instance
 * @returns {Server|null}
 */
function getIO() {
    return io;
}

/**
 * Broadcast a sentiment update to the public feed
 * @param {Object} data - Sentiment data { symbol, wss, signal, articleCount }
 */
function broadcastSentimentUpdate(data) {
    if (!io) return;
    io.to('sentiment-feed').emit('sentiment:update', data);
    if (data.symbol) {
        io.to(`stock:${data.symbol}`).emit('stock:sentiment', data);
    }
}

/**
 * Broadcast a scrape completion event
 * @param {Object} result - Scrape result { total, new_articles, sources }
 */
function broadcastScrapeComplete(result) {
    if (!io) return;
    io.to('sentiment-feed').emit('scrape:complete', {
        ...result,
        timestamp: new Date().toISOString(),
    });
}

/**
 * Send a notification to a specific user via their socket
 * @param {string} userId - UUID of the user
 * @param {Object} notification - { type, title, message }
 */
function sendUserNotification(userId, notification) {
    if (!io) return;
    io.to(`user:${userId}`).emit('notification:new', notification);
}

module.exports = {
    initializeSocket,
    getIO,
    broadcastSentimentUpdate,
    broadcastScrapeComplete,
    sendUserNotification,
};

const jwt = require('jsonwebtoken');

/**
 * Verify JWT token
 */
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }

        req.user = user;
        next();
    });
}

/**
 * Optional authentication
 */
function optionalAuth(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return next();

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (!err) req.user = user;
        next();
    });
}

/**
 * Require Pro tier
 */
function requirePro(req, res, next) {
    if (req.user?.tier !== 'pro') {
        return res.status(403).json({ error: 'Pro subscription required' });
    }
    next();
}

/**
 * Require Admin role
 */
function requireAdmin(req, res, next) {
    if (req.user?.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
}

module.exports = {
    authenticateToken,
    optionalAuth,
    requirePro,
    requireAdmin
};
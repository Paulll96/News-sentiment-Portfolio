/**
 * Authentication Routes
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();


router.post('/register', async (req, res) => {
    try {
        const { email, password, name } = req.body;

        // Validate input
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        // Check if user already exists
        const existingUser = await query('SELECT id FROM users WHERE email = $1', [email]);
        if (existingUser.rows.length > 0) {
            return res.status(409).json({ error: 'User already exists' });
        }

        // Hash password
        const salt = await bcrypt.genSalt(12);
        const passwordHash = await bcrypt.hash(password, salt);

        // Create user (default role is 'user')
        const result = await query(
            'INSERT INTO users (email, password_hash, name, role) VALUES ($1, $2, $3, $4) RETURNING id, email, name, tier, role, created_at',
            [email, passwordHash, name || null, 'user']
        );

        const user = result.rows[0];

        // Generate JWT token (includes role for admin check)
        const token = jwt.sign(
            { userId: user.id, email: user.email, tier: user.tier, role: user.role || 'user' },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
        );

        res.status(201).json({
            message: 'User registered successfully',
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                tier: user.tier
            },
            token
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Failed to register user' });
    }
});

/**
 * POST /api/auth/login
 * Login user
 */
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        // Find user (include role + 2FA status)
        const result = await query(
            'SELECT id, email, name, password_hash, tier, role, totp_enabled FROM users WHERE email = $1',
            [email]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const user = result.rows[0];

        // Verify password
        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Update last login
        await query('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);

        // If 2FA is enabled, return temp token requiring TOTP validation
        if (user.totp_enabled) {
            const tempToken = jwt.sign(
                { userId: user.id, purpose: '2fa-challenge' },
                process.env.JWT_SECRET,
                { expiresIn: '5m' }
            );
            return res.json({
                requires2FA: true,
                tempToken,
                message: 'Two-factor authentication required',
            });
        }

        // Generate JWT token (includes role for admin check)
        const token = jwt.sign(
            { userId: user.id, email: user.email, tier: user.tier, role: user.role || 'user' },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
        );

        res.json({
            message: 'Login successful',
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                tier: user.tier,
                role: user.role || 'user'
            },
            token
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Failed to login' });
    }
});

/**
 * GET /api/auth/me
 * Get current user profile
 */
router.get('/me', authenticateToken, async (req, res) => {
    try {
        const result = await query(
            'SELECT id, email, name, tier, created_at, last_login FROM users WHERE id = $1',
            [req.user.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({ user: result.rows[0] });
    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({ error: 'Failed to get profile' });
    }
});


router.post('/logout', authenticateToken, (req, res) => {
    res.json({ message: 'Logged out successfully' });
});

/**
 * POST /api/auth/forgot-password
 * Request a password reset — generates token, logs reset URL (demo mode)
 */
router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ error: 'Email is required' });

        const user = await query('SELECT id FROM users WHERE email = $1', [email]);
        // Always return success to prevent email enumeration
        if (user.rows.length === 0) {
            return res.json({ message: 'If an account with that email exists, a reset link has been sent.' });
        }

        // Generate a secure token
        const crypto = require('crypto');
        const token = crypto.randomBytes(32).toString('hex');
        const hashedToken = await bcrypt.hash(token, 10);
        const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

        // Store hashed token in DB
        await query(
            `UPDATE users SET reset_token = $1, reset_token_expiry = $2 WHERE id = $3`,
            [hashedToken, expiry, user.rows[0].id]
        );

        // In production, send email via nodemailer. For demo, log the URL.
        const resetURL = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${token}&email=${encodeURIComponent(email)}`;
        console.log(`\n🔑 PASSWORD RESET LINK (demo mode):\n   ${resetURL}\n`);

        res.json({ message: 'If an account with that email exists, a reset link has been sent.' });
    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({ error: 'Failed to process request' });
    }
});

/**
 * POST /api/auth/reset-password
 * Reset password using a valid token
 */
router.post('/reset-password', async (req, res) => {
    try {
        const { email, token, newPassword } = req.body;
        if (!email || !token || !newPassword) {
            return res.status(400).json({ error: 'Email, token, and new password are required' });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }

        const user = await query(
            'SELECT id, reset_token, reset_token_expiry FROM users WHERE email = $1',
            [email]
        );

        if (user.rows.length === 0 || !user.rows[0].reset_token) {
            return res.status(400).json({ error: 'Invalid or expired reset token' });
        }

        const { id, reset_token, reset_token_expiry } = user.rows[0];

        // Check expiry
        if (new Date() > new Date(reset_token_expiry)) {
            return res.status(400).json({ error: 'Reset token has expired. Please request a new one.' });
        }

        // Verify token
        const valid = await bcrypt.compare(token, reset_token);
        if (!valid) {
            return res.status(400).json({ error: 'Invalid or expired reset token' });
        }

        // Hash new password and clear token
        const salt = await bcrypt.genSalt(12);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        await query(
            `UPDATE users SET password_hash = $1, reset_token = NULL, reset_token_expiry = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
            [hashedPassword, id]
        );

        res.json({ message: 'Password reset successfully. You can now log in.' });
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ error: 'Failed to reset password' });
    }
});

module.exports = router;

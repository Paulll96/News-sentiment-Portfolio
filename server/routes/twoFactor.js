/**
 * Two-Factor Authentication (2FA) Routes
 * Implements TOTP (Time-Based One-Time Password) with QR code generation
 * Uses otplib for TOTP and qrcode for QR generation
 */

const express = require('express');
const { query } = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Lazy-load 2FA libraries (optional deps)
let authenticator, toDataURL;

function load2FALibs() {
    if (!authenticator) {
        try {
            const otplib = require('otplib');
            authenticator = otplib.authenticator;
            const qrcode = require('qrcode');
            toDataURL = qrcode.toDataURL;
        } catch (err) {
            console.error('⚠️  2FA libraries not installed. Run: npm install otplib qrcode');
            throw new Error('2FA libraries not available');
        }
    }
}

/**
 * POST /api/2fa/setup
 * Generate a TOTP secret and QR code for the user to scan
 */
router.post('/setup', authenticateToken, async (req, res) => {
    try {
        load2FALibs();

        const secret = authenticator.generateSecret();
        const otpauthUrl = authenticator.keyuri(
            req.user.email || req.user.userId,
            'SentinelQuant',
            secret
        );

        // Generate QR code as data URL
        const qrCodeDataUrl = await toDataURL(otpauthUrl);

        // Store the secret temporarily (not enabled yet until verified)
        await query(
            `UPDATE users SET totp_secret = $1, totp_enabled = false WHERE id = $2`,
            [secret, req.user.userId]
        );

        res.json({
            secret,
            qrCode: qrCodeDataUrl,
            message: 'Scan the QR code with your authenticator app, then verify with a code.',
        });
    } catch (error) {
        console.error('2FA setup error:', error);
        res.status(500).json({ error: error.message || 'Failed to setup 2FA' });
    }
});

/**
 * POST /api/2fa/verify
 * Verify a TOTP code and enable 2FA for the user
 */
router.post('/verify', authenticateToken, async (req, res) => {
    try {
        load2FALibs();

        const { code } = req.body;
        if (!code) return res.status(400).json({ error: 'Verification code is required' });

        // Get the user's pending secret
        const user = await query(
            'SELECT totp_secret FROM users WHERE id = $1',
            [req.user.userId]
        );

        if (user.rows.length === 0 || !user.rows[0].totp_secret) {
            return res.status(400).json({ error: 'No 2FA setup found. Please setup first.' });
        }

        const isValid = authenticator.verify({
            token: code,
            secret: user.rows[0].totp_secret,
        });

        if (!isValid) {
            return res.status(400).json({ error: 'Invalid code. Please try again.' });
        }

        // Enable 2FA
        await query(
            `UPDATE users SET totp_enabled = true WHERE id = $1`,
            [req.user.userId]
        );

        // Generate backup codes
        const crypto = require('crypto');
        const backupCodes = Array.from({ length: 6 }, () =>
            crypto.randomBytes(4).toString('hex').toUpperCase()
        );

        await query(
            `UPDATE users SET totp_backup_codes = $1 WHERE id = $2`,
            [JSON.stringify(backupCodes), req.user.userId]
        );

        res.json({
            message: '2FA enabled successfully!',
            backupCodes,
            warning: 'Save these backup codes in a safe place. They can only be shown once.',
        });
    } catch (error) {
        console.error('2FA verify error:', error);
        res.status(500).json({ error: 'Failed to verify 2FA' });
    }
});

/**
 * POST /api/2fa/validate
 * Validate a TOTP code during login (called after email/password auth)
 * Accepts tempToken from login challenge + TOTP code, issues full session JWT
 */
router.post('/validate', async (req, res) => {
    try {
        load2FALibs();
        const jwt = require('jsonwebtoken');

        const { tempToken, code } = req.body;
        if (!tempToken || !code) {
            return res.status(400).json({ error: 'tempToken and code are required' });
        }

        // Verify the temp token
        let decoded;
        try {
            decoded = jwt.verify(tempToken, process.env.JWT_SECRET);
        } catch (err) {
            return res.status(401).json({ error: 'Invalid or expired 2FA session. Please login again.' });
        }

        if (decoded.purpose !== '2fa-challenge') {
            return res.status(401).json({ error: 'Invalid token purpose' });
        }

        const userId = decoded.userId;

        const user = await query(
            'SELECT id, email, name, tier, role, totp_secret, totp_enabled, totp_backup_codes FROM users WHERE id = $1',
            [userId]
        );

        if (user.rows.length === 0 || !user.rows[0].totp_enabled) {
            return res.status(400).json({ error: '2FA is not enabled for this account' });
        }

        const { totp_secret, totp_backup_codes } = user.rows[0];
        const u = user.rows[0];

        // Try TOTP code first
        const isValid = authenticator.verify({ token: code, secret: totp_secret });

        if (!isValid) {
            // Try backup code
            let backupCodes = [];
            try { backupCodes = JSON.parse(totp_backup_codes || '[]'); } catch { }

            const backupIndex = backupCodes.indexOf(code.toUpperCase());
            if (backupIndex === -1) {
                return res.status(401).json({ valid: false, error: 'Invalid 2FA code' });
            }

            // Remove used backup code
            backupCodes.splice(backupIndex, 1);
            await query(
                'UPDATE users SET totp_backup_codes = $1 WHERE id = $2',
                [JSON.stringify(backupCodes), userId]
            );
        }

        // 2FA passed — issue full session token
        const token = jwt.sign(
            { userId: u.id, email: u.email, tier: u.tier, role: u.role || 'user' },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
        );

        res.json({
            valid: true,
            token,
            user: {
                id: u.id,
                email: u.email,
                name: u.name,
                tier: u.tier,
            },
        });
    } catch (error) {
        console.error('2FA validate error:', error);
        res.status(500).json({ error: 'Failed to validate 2FA' });
    }
});

/**
 * POST /api/2fa/disable
 * Disable 2FA for the user
 */
router.post('/disable', authenticateToken, async (req, res) => {
    try {
        const { code } = req.body;

        // Code is REQUIRED to disable 2FA
        if (!code) {
            return res.status(400).json({ error: 'A valid 2FA code is required to disable two-factor authentication' });
        }

        load2FALibs();
        const user = await query('SELECT totp_secret, totp_enabled FROM users WHERE id = $1', [req.user.userId]);
        if (!user.rows[0]?.totp_enabled) {
            return res.status(400).json({ error: '2FA is not enabled on this account' });
        }

        const isValid = authenticator.verify({ token: code, secret: user.rows[0].totp_secret });
        if (!isValid) {
            return res.status(400).json({ error: 'Invalid code. Cannot disable 2FA.' });
        }

        await query(
            `UPDATE users SET totp_secret = NULL, totp_enabled = false, totp_backup_codes = NULL WHERE id = $1`,
            [req.user.userId]
        );

        res.json({ message: '2FA has been disabled.' });
    } catch (error) {
        console.error('2FA disable error:', error);
        res.status(500).json({ error: 'Failed to disable 2FA' });
    }
});

/**
 * GET /api/2fa/status
 * Check if 2FA is enabled for the current user
 */
router.get('/status', authenticateToken, async (req, res) => {
    try {
        const user = await query(
            'SELECT totp_enabled FROM users WHERE id = $1',
            [req.user.userId]
        );

        res.json({ enabled: user.rows[0]?.totp_enabled || false });
    } catch (error) {
        console.error('2FA status error:', error);
        res.status(500).json({ error: 'Failed to check 2FA status' });
    }
});

module.exports = router;

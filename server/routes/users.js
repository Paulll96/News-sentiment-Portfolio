/**
 * Users API Routes
 */

const express = require('express');
const { query } = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/users/profile
 * Get user profile
 */
router.get('/profile', authenticateToken, async (req, res) => {
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

/**
 * PUT /api/users/profile
 * Update user profile
 */
router.put('/profile', authenticateToken, async (req, res) => {
    try {
        const { name } = req.body;

        const result = await query(
            `UPDATE users SET name = $1, updated_at = CURRENT_TIMESTAMP
             WHERE id = $2
             RETURNING id, email, name, tier`,
            [name, req.user.userId]
        );

        res.json({
            message: 'Profile updated',
            user: result.rows[0]
        });
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

/**
 * POST /api/users/upgrade
 * Upgrade to Pro tier (mock)
 */
router.post('/upgrade', authenticateToken, async (req, res) => {
    try {
        const result = await query(
            `UPDATE users SET tier = 'pro', updated_at = CURRENT_TIMESTAMP
             WHERE id = $1
             RETURNING id, email, name, tier`,
            [req.user.userId]
        );

        res.json({
            message: 'Upgraded to Pro!',
            user: result.rows[0]
        });
    } catch (error) {
        console.error('Upgrade error:', error);
        res.status(500).json({ error: 'Failed to upgrade' });
    }
});

module.exports = router;

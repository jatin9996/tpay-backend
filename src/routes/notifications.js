import express from 'express';
import { Op } from 'sequelize';
import Notification from '../models/Notification.js';

const router = express.Router();

// Map frontend tab names to categories
const CATEGORY_MAP = {
    all: null,
    transactions: 'TRANSACTION',
    governance: 'GOVERNANCE',
    'system-alerts': 'SYSTEM',
    promotions: 'PROMOTION'
};

// GET /notifications
// Query params: userAddress (optional), tab=all|transactions|governance|system-alerts|promotions, limit, offset
router.get('/', async (req, res) => {
    try {
        const { userAddress, tab = 'all', limit = 50, offset = 0 } = req.query;

        const where = {};
        const category = CATEGORY_MAP[String(tab).toLowerCase()] ?? null;
        if (category) where.category = category;

        // Return global + specific when userAddress provided
        if (userAddress) {
            where[Op.or] = [{ userAddress: userAddress.toLowerCase() }, { userAddress: null }];
        }

        const rows = await Notification.findAll({
            where,
            order: [['createdAt', 'DESC']],
            limit: Math.min(parseInt(limit), 200),
            offset: parseInt(offset)
        });

        res.json({ success: true, items: rows });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// POST /notifications
// Body: { userAddress?, category, severity?, title, message?, actionLabel?, actionUrl?, txHash?, metadata? }
router.post('/', async (req, res) => {
    try {
        const payload = req.body || {};
        if (!payload.category || !payload.title) {
            return res.status(400).json({ success: false, error: 'category and title are required' });
        }

        if (payload.userAddress) payload.userAddress = payload.userAddress.toLowerCase();

        const created = await Notification.create({
            userAddress: payload.userAddress ?? null,
            category: payload.category,
            severity: payload.severity || 'info',
            title: payload.title,
            message: payload.message,
            actionLabel: payload.actionLabel,
            actionUrl: payload.actionUrl,
            txHash: payload.txHash,
            metadata: payload.metadata || {}
        });

        res.status(201).json({ success: true, item: created });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// PATCH /notifications/:id/read -> mark single as read
router.patch('/:id/read', async (req, res) => {
    try {
        const { id } = req.params;
        const notif = await Notification.findByPk(id);
        if (!notif) return res.status(404).json({ success: false, error: 'Not found' });
        await notif.update({ read: true });
        res.json({ success: true, item: notif });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// POST /notifications/mark-all-read
// Body: { userAddress?, tab? }
router.post('/mark-all-read', async (req, res) => {
    try {
        const { userAddress, tab = 'all' } = req.body || {};
        const where = { read: false };
        const category = CATEGORY_MAP[String(tab).toLowerCase()] ?? null;
        if (category) where.category = category;
        if (userAddress) {
            where[Op.or] = [{ userAddress: userAddress.toLowerCase() }, { userAddress: null }];
        }
        const [count] = await Notification.update({ read: true }, { where });
        res.json({ success: true, updated: count });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// POST /notifications/clear-all
// Body: { userAddress?, tab? } -> deletes user-specific; keeps global unless no userAddress
router.post('/clear-all', async (req, res) => {
    try {
        const { userAddress, tab = 'all' } = req.body || {};
        const where = {};
        const category = CATEGORY_MAP[String(tab).toLowerCase()] ?? null;
        if (category) where.category = category;
        if (userAddress) {
            // Clear only user-specific notifications
            where.userAddress = userAddress.toLowerCase();
        }
        const deleted = await Notification.destroy({ where });
        res.json({ success: true, deleted });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

export default router;



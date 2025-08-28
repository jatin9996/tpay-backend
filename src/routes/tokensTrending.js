import express from "express";
import TokenStats24h from "../models/TokenStats24h.js";

const router = express.Router();

// GET /tokens/trending?window=24h&limit=10
router.get("/trending", async (req, res) => {
    try {
        const { window = '24h', limit = 10 } = req.query;
        const parsedLimit = Math.min(Math.max(parseInt(limit) || 10, 1), 100);

        if (window !== '24h') {
            return res.status(400).json({ success: false, error: "Only 24h window is supported currently" });
        }

        const docs = await TokenStats24h.find({})
            .sort({ volume24hUSD: -1 })
            .limit(parsedLimit)
            .lean();

        return res.json({ success: true, window, tokens: docs, count: docs.length });
    } catch (e) {
        console.error('trending tokens error', e);
        return res.status(500).json({ success: false, error: e.message });
    }
});

export default router;



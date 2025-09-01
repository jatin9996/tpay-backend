import express from "express";
import rateLimiter from "../middleware/rateLimiter.js";
import quoteService from "../services/quoteService.js";
import { serializeBigInts } from "../utils/bigIntSerializer.js";
import Quote from "../models/Quote.js";
import QuoteRequest from "../models/QuoteRequest.js";
import QuoteCache from "../models/QuoteCache.js";

const router = express.Router();

/**
 * POST /quote
 * Main quote endpoint with database integration, caching, and rate limiting
 */
router.post("/", rateLimiter, async (req, res) => {
    try {
        const requestInfo = {
            ipAddress: req.rateLimitInfo?.ipAddress || req.ip,
            userAgent: req.get('User-Agent'),
            userId: req.body.userId || null,
            userAddress: req.body.userAddress || null,
            rateLimitKey: req.rateLimitInfo?.ipRateLimitKey || null
        };

        const quote = await quoteService.generateQuote(req.body, requestInfo);
        
        // Add rate limit headers
        res.set('X-RateLimit-Limit', '30');
        res.set('X-RateLimit-Window', '1m');
        
        return res.json(serializeBigInts(quote));
    } catch (error) {
        console.error("/quote failed:", error);
        
        if (error.message.includes("No executable route")) {
            return res.status(400).json({ 
                error: "No executable route/liquidity for this pair",
                details: error.message 
            });
        }
        
        return res.status(500).json({ 
            error: "Internal error", 
            details: error.message 
        });
    }
});

/**
 * POST /quote/best
 * Legacy endpoint for exact-in quotes (maintains backward compatibility)
 */
router.post("/best", rateLimiter, async (req, res) => {
    try {
        const requestInfo = {
            ipAddress: req.rateLimitInfo?.ipAddress || req.ip,
            userAgent: req.get('User-Agent'),
            userId: req.body.userId || null,
            userAddress: req.body.userAddress || null,
            rateLimitKey: req.rateLimitInfo?.ipRateLimitKey || null
        };

        const quote = await quoteService.generateQuote({
            ...req.body,
            mode: 'EXACT_IN'
        }, requestInfo);
        
        res.set('X-RateLimit-Limit', '30');
        res.set('X-RateLimit-Window', '1m');
        
        return res.json(serializeBigInts(quote));
    } catch (error) {
        console.error("/quote/best failed:", error);
        
        if (error.message.includes("No executable route")) {
            return res.status(400).json({ 
                error: "No executable route/liquidity for this pair",
                details: error.message 
            });
        }
        
        return res.status(500).json({ 
            error: "Internal error", 
            details: error.message 
        });
    }
});

/**
 * POST /quote/exact-out
 * Exact-out quote endpoint
 */
router.post("/exact-out", rateLimiter, async (req, res) => {
    try {
        const requestInfo = {
            ipAddress: req.rateLimitInfo?.ipAddress || req.ip,
            userAgent: req.get('User-Agent'),
            userId: req.body.userId || null,
            userAddress: req.body.userAddress || null,
            rateLimitKey: req.rateLimitInfo?.ipRateLimitKey || null
        };

        const quote = await quoteService.generateQuote({
            ...req.body,
            mode: 'EXACT_OUT'
        }, requestInfo);
        
        res.set('X-RateLimit-Limit', '30');
        res.set('X-RateLimit-Window', '1m');
        
        return res.json(serializeBigInts(quote));
    } catch (error) {
        console.error("/quote/exact-out failed:", error);
        
        if (error.message.includes("No executable route")) {
            return res.status(400).json({ 
                error: "No executable route/liquidity for this pair",
                details: error.message 
            });
        }
        
        return res.status(500).json({ 
            error: "Internal error", 
            details: error.message 
        });
    }
});

/**
 * GET /quote/stats
 * Get quote statistics from database
 */
router.get("/stats", async (req, res) => {
    try {
        const { chainId, timeRange = '24h' } = req.query;
        
        const [quoteStats] = await Quote.getStats(chainId, timeRange);
        const [requestStats] = await QuoteRequest.getStats(chainId, timeRange);
        const [cacheStats] = await QuoteCache.getStats(chainId, timeRange);
        
        return res.json({
            quotes: quoteStats,
            requests: requestStats,
            cache: cacheStats,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error("/quote/stats failed:", error);
        return res.status(500).json({ 
            error: "Internal error", 
            details: error.message 
        });
    }
});

/**
 * GET /quote/:quoteId
 * Get specific quote by ID
 */
router.get("/:quoteId", async (req, res) => {
    try {
        const { quoteId } = req.params;
        
        const quote = await Quote.findOne({
            where: { quoteId }
        });
        
        if (!quote) {
            return res.status(404).json({ 
                error: "Quote not found",
                quoteId 
            });
        }
        
        if (quote.isExpired()) {
            return res.status(410).json({ 
                error: "Quote expired",
                quoteId,
                expiredAt: quote.expiresAt
            });
        }
        
        return res.json(serializeBigInts(quote));
    } catch (error) {
        console.error(`/quote/${req.params.quoteId} failed:`, error);
        return res.status(500).json({ 
            error: "Internal error", 
            details: error.message 
        });
    }
});

/**
 * GET /quote/requests/stats
 * Get quote request statistics for monitoring
 */
router.get("/requests/stats", async (req, res) => {
    try {
        const { chainId, timeRange = '24h' } = req.query;
        
        const [stats] = await QuoteRequest.getStats(chainId, timeRange);
        
        return res.json({
            ...stats,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error("/quote/requests/stats failed:", error);
        return res.status(500).json({ 
            error: "Internal error", 
            details: error.message 
        });
    }
});

/**
 * GET /quote/cache/stats
 * Get cache statistics for monitoring
 */
router.get("/cache/stats", async (req, res) => {
    try {
        const { chainId, timeRange = '24h' } = req.query;
        
        const [stats] = await QuoteCache.getStats(chainId, timeRange);
        
        return res.json({
            ...stats,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error("/quote/cache/stats failed:", error);
        return res.status(500).json({ 
            error: "Internal error", 
            details: error.message 
        });
    }
});

export default router;



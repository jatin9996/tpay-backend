import express from "express";
import axios from "axios";
import rateLimiter from "../middleware/rateLimiter.js";
import quoteService from "../services/quoteService.js";
import priceFeedService from "../services/priceFeedService.js";
import securityService from "../services/securityService.js";
import swapDatabaseService from "../services/swapDatabase.js";
import { getDefaultTokens } from "../services/tokenRegistry.js";
import { validateToken } from "../services/tokenValidation.js";
import { serializeBigInts } from "../utils/bigIntSerializer.js";
import { ethers } from "ethers";
import config from "../config/env.js";
import Pool from "../models/Pool.js";
import MetricsPoolDay from "../models/MetricsPoolDay.js";
import { Op } from "sequelize";

const router = express.Router();

/**
 * Frontend-Optimized API Endpoints
 * These endpoints are specifically designed for frontend integration
 * with simplified responses and optimized data structures
 */

/**
 * GET /frontend/tokens
 * Get all supported tokens with prices and metadata
 */
router.get("/tokens", rateLimiter, async (req, res) => {
    try {
        const { chainId = config.DEFAULT_CHAIN_ID } = req.query;
        
        // Get tokens from database
        let tokens = await swapDatabaseService.getSupportedTokens(chainId);

        // If DB has very few tokens, enrich with curated defaults (without duplicates)
        const curated = getDefaultTokens(chainId);
        if (curated.length) {
            const has = new Set(tokens.map(t => t.address.toLowerCase()));
            const enriched = curated
              .filter(ct => !has.has(ct.address.toLowerCase()))
              .map(ct => ({
                ...ct,
                address: ct.address.toLowerCase(),
                chainId: parseInt(chainId),
                name: ct.name,
                symbol: ct.symbol,
                decimals: ct.decimals,
                logoURI: undefined,
                isStablecoin: ['USDC','USDT','DAI'].includes(ct.symbol),
                verified: true,
                volume24h: 0
              }));
            tokens = [...tokens, ...enriched];
        }
        
        // Get prices for all tokens
        const tokenAddresses = tokens.map(token => token.address);
        const prices = await priceFeedService.getMultipleTokenPrices(tokenAddresses, chainId);
        
        // Format response for frontend
        const formattedTokens = tokens.map(token => ({
            address: token.address,
            symbol: token.symbol,
            name: token.name,
            decimals: token.decimals,
            logoURI: token.logoURI || `https://tokens.1inch.io/${token.address}.png`,
            priceUSD: prices[token.address.toLowerCase()] || 0,
            volume24h: token.volume24h || 0,
            isStablecoin: token.isStablecoin || false,
            verified: token.verified || false
        }));

        res.json({
            success: true,
            tokens: formattedTokens,
            chainId: parseInt(chainId),
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error("Get tokens error:", error);
        res.status(500).json({
            success: false,
            error: "Failed to fetch tokens",
            details: error.message
        });
    }
});

/**
 * GET /frontend/token/:address
 * Get specific token information with current price
 */
router.get("/token/:address", rateLimiter, async (req, res) => {
    try {
        const { address } = req.params;
        const { chainId = config.DEFAULT_CHAIN_ID } = req.query;
        
        const token = await swapDatabaseService.getTokenByAddress(address, chainId);
        if (!token) {
            return res.status(404).json({
                success: false,
                error: "Token not found"
            });
        }

        const price = await priceFeedService.getTokenPrice(address, chainId);
        
        res.json({
            success: true,
            token: {
                address: token.address,
                symbol: token.symbol,
                name: token.name,
                decimals: token.decimals,
                logoURI: token.logoURI || `https://tokens.1inch.io/${token.address}.png`,
                priceUSD: price,
                volume24h: token.volume24h || 0,
                marketCap: token.marketCap || 0,
                isStablecoin: token.isStablecoin || false,
                verified: token.verified || false
            },
            chainId: parseInt(chainId),
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error("Get token error:", error);
        res.status(500).json({
            success: false,
            error: "Failed to fetch token",
            details: error.message
        });
    }
});

/**
 * POST /frontend/quote
 * Get optimized quote for frontend display
 */
router.post("/quote", rateLimiter, async (req, res) => {
    try {
        const requestInfo = {
            ipAddress: req.rateLimitInfo?.ipAddress || req.ip,
            userAgent: req.get('User-Agent'),
            userId: req.body.userId || null,
            userAddress: req.body.userAddress || null,
            rateLimitKey: req.rateLimitInfo?.ipRateLimitKey || null
        };

        const quote = await quoteService.generateQuote(req.body, requestInfo);
        
        // Format response for frontend
        const frontendQuote = {
            quoteId: quote.quoteId,
            tokenIn: {
                address: req.body.tokenIn,
                amount: req.body.amountIn
            },
            tokenOut: {
                address: req.body.tokenOut,
                amount: quote.amountOut
            },
            priceImpact: quote.priceImpactPct ? Number(quote.priceImpactPct) : 0,
            slippage: req.body.slippagePct || 0.5,
            route: quote.route,
            estimatedGas: quote.estimatedGas || "0",
            expiresAt: quote.expiresAt,
            fromCache: quote.fromCache || false
        };

        res.json({
            success: true,
            quote: frontendQuote,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error("Quote error:", error);
        
        if (error.message.includes("No executable route")) {
            return res.status(400).json({
                success: false,
                error: "No liquidity available for this trade",
                details: error.message
            });
        }
        
        res.status(500).json({
            success: false,
            error: "Failed to generate quote",
            details: error.message
        });
    }
});

/**
 * POST /frontend/swap/validate
 * Validate swap parameters before execution
 */
router.post("/swap/validate", rateLimiter, async (req, res) => {
    try {
        const requestInfo = {
            ipAddress: req.rateLimitInfo?.ipAddress || req.ip,
            userAgent: req.get('User-Agent')
        };

        const validation = await securityService.validateSwap(req.body, requestInfo);
        
        res.json({
            success: validation.valid,
            valid: validation.valid,
            errors: validation.errors || [],
            warnings: validation.warnings || [],
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error("Swap validation error:", error);
        res.status(500).json({
            success: false,
            error: "Validation failed",
            details: error.message
        });
    }
});

/**
 * POST /frontend/swap/execute
 * Execute swap with enhanced security and error handling
 */
router.post("/swap/execute", rateLimiter, async (req, res) => {
    try {
        const requestInfo = {
            ipAddress: req.rateLimitInfo?.ipAddress || req.ip,
            userAgent: req.get('User-Agent'),
            userId: req.body.userId || null,
            userAddress: req.body.userAddress || null,
            rateLimitKey: req.rateLimitInfo?.ipRateLimitKey || null
        };

        // Security validation
        const securityCheck = await securityService.validateSwap(req.body, requestInfo);
        if (!securityCheck.valid) {
            return res.status(400).json({
                success: false,
                error: "Security validation failed",
                details: securityCheck.errors
            });
        }

        // Execute swap using existing swap service
        const swapResult = await swapDatabaseService.executeSwap(req.body, requestInfo);
        
        res.json({
            success: true,
            swap: {
                id: swapResult.id,
                status: swapResult.status,
                txHash: swapResult.txHash,
                tokenIn: {
                    address: swapResult.tokenIn,
                    amount: swapResult.amountIn
                },
                tokenOut: {
                    address: swapResult.tokenOut,
                    amount: swapResult.expectedOut
                },
                gasUsed: swapResult.gasUsed,
                blockNumber: swapResult.blockNumber
            },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error("Swap execution error:", error);
        res.status(500).json({
            success: false,
            error: "Swap execution failed",
            details: error.message
        });
    }
});

/**
 * GET /frontend/swap/:swapId
 * Get swap status and details
 */
router.get("/swap/:swapId", rateLimiter, async (req, res) => {
    try {
        const { swapId } = req.params;
        
        const swap = await swapDatabaseService.getSwapById(swapId);
        if (!swap) {
            return res.status(404).json({
                success: false,
                error: "Swap not found"
            });
        }

        res.json({
            success: true,
            swap: {
                id: swap.id,
                status: swap.status,
                txHash: swap.txHash,
                tokenIn: {
                    address: swap.tokenIn,
                    amount: swap.amountIn
                },
                tokenOut: {
                    address: swap.tokenOut,
                    amount: swap.expectedOut
                },
                slippage: swap.slippagePct,
                gasUsed: swap.gasUsed,
                blockNumber: swap.blockNumber,
                createdAt: swap.createdAt,
                updatedAt: swap.updatedAt
            },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error("Get swap error:", error);
        res.status(500).json({
            success: false,
            error: "Failed to fetch swap",
            details: error.message
        });
    }
});

/**
 * GET /frontend/user/:address/swaps
 * Get user's swap history
 */
router.get("/user/:address/swaps", rateLimiter, async (req, res) => {
    try {
        const { address } = req.params;
        const { limit = 20, offset = 0, status } = req.query;
        
        const swaps = await swapDatabaseService.getUserSwaps(address, {
            limit: parseInt(limit),
            offset: parseInt(offset),
            status
        });

        const formattedSwaps = swaps.rows.map(swap => ({
            id: swap.id,
            status: swap.status,
            txHash: swap.txHash,
            tokenIn: {
                address: swap.tokenIn,
                amount: swap.amountIn
            },
            tokenOut: {
                address: swap.tokenOut,
                amount: swap.expectedOut
            },
            slippage: swap.slippagePct,
            gasUsed: swap.gasUsed,
            createdAt: swap.createdAt
        }));

        res.json({
            success: true,
            swaps: formattedSwaps,
            pagination: {
                total: swaps.count,
                limit: parseInt(limit),
                offset: parseInt(offset),
                hasMore: swaps.count > parseInt(offset) + swaps.rows.length
            },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error("Get user swaps error:", error);
        res.status(500).json({
            success: false,
            error: "Failed to fetch user swaps",
            details: error.message
        });
    }
});

/**
 * GET /frontend/stats
 * Get platform statistics for dashboard
 */
router.get("/stats", rateLimiter, async (req, res) => {
    try {
        const { chainId = config.DEFAULT_CHAIN_ID, timeRange = '24h' } = req.query;
        
        const [swapStats, tokenStats, quoteStats] = await Promise.all([
            swapDatabaseService.getSwapStats(chainId, timeRange),
            swapDatabaseService.getTokenStats(chainId, timeRange),
            swapDatabaseService.getQuoteStats(chainId, timeRange)
        ]);

        res.json({
            success: true,
            stats: {
                swaps: swapStats,
                tokens: tokenStats,
                quotes: quoteStats,
                timeRange,
                chainId: parseInt(chainId)
            },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error("Get stats error:", error);
        res.status(500).json({
            success: false,
            error: "Failed to fetch statistics",
            details: error.message
        });
    }
});

/**
 * GET /frontend/pools/analytics
 * Returns pool analytics suitable for the Pool Analytics UI
 * Data source: Our platform DB (pools + metrics_pool_day)
 * Query params:
 * - poolAddress (optional): focus on a specific pool
 * - chainId (optional)
 * - range: 1d|7d|30d|1y (default 7d)
 */
router.get("/pools/analytics", rateLimiter, async (req, res) => {
    try {
        const { poolAddress, chainId = config.DEFAULT_CHAIN_ID, range = '7d' } = req.query;

        // Map UI range to day bucket
        const rangeToDays = { '1d': 1, '7d': 7, '30d': 30, '1y': 365 };
        const days = rangeToDays[range] ?? 7;

        // 1) Find pool in our DB
        let pool;
        if (poolAddress) {
            pool = await Pool.findOne({
                where: { poolAddress: poolAddress.toLowerCase(), chainId: parseInt(chainId) }
            });
        } else {
            pool = await Pool.findOne({
                where: { chainId: parseInt(chainId), isActive: true },
                order: [["tvl", "DESC"]]
            });
        }

        if (!pool) {
            return res.status(404).json({ success: false, error: "No pool found in database" });
        }

        // 2) Load daily metrics for selected range
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days + 1);
        const metrics = await MetricsPoolDay.findAll({
            where: {
                poolId: pool.poolAddress,
                date: { [Op.gte]: startDate }
            },
            order: [["date", "ASC"]]
        });

        const daySeries = metrics.map(m => ({
            date: new Date(m.date).toISOString(),
            volumeUsd: Number(m.volumeUsd || 0),
            tvlUsd: Number(m.tvlUsd || 0),
            feesUsd: Number(m.feesUsd || 0)
        }));

        const totalLiquidity = daySeries.length ? daySeries[daySeries.length - 1].tvlUsd : Number(pool.tvl || 0);
        const volume24h = daySeries.length ? daySeries[daySeries.length - 1].volumeUsd : Number(pool.volume24h || 0);
        const volume7d = daySeries.slice(-7).reduce((s, x) => s + x.volumeUsd, 0);
        const fees7d = daySeries.slice(-7).reduce((s, x) => s + x.feesUsd, 0);
        const apr = totalLiquidity > 0 ? ((fees7d / totalLiquidity) * 52) * 100 : 0;

        res.json({
            success: true,
            pool: {
                id: pool.id,
                token0: { id: pool.token0 },
                token1: { id: pool.token1 },
                totalLiquidityUSD: totalLiquidity,
                volume24hUSD: volume24h,
                volume7dUSD: volume7d,
                aprPct: Number(apr.toFixed(2))
            },
            series: daySeries,
            chainId: parseInt(chainId),
            range,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error("/frontend/pools/analytics error:", error.message);
        res.status(500).json({ success: false, error: "Failed to fetch pool analytics", details: error.message });
    }
});

/**
 * GET /frontend/health
 * Health check endpoint for frontend
 */
router.get("/health", async (req, res) => {
    try {
        const health = {
            status: "healthy",
            timestamp: new Date().toISOString(),
            services: {
                database: "connected",
                priceFeeds: "active",
                security: "enabled",
                rateLimit: "active"
            },
            version: "1.0.0"
        };

        res.json(health);
    } catch (error) {
        res.status(500).json({
            status: "unhealthy",
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

export default router;

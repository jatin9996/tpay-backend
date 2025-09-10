import { ethers } from 'ethers';
import Quote from '../models/Quote.js';
import QuoteRequest from '../models/QuoteRequest.js';
import QuoteCache from '../models/QuoteCache.js';
import Token from '../models/Token.js';
import { validateToken } from './tokenValidation.js';
import { getUniswapAddresses } from '../config/chains.js';
import config from '../config/env.js';

/**
 * Comprehensive Quote Service
 * Handles quote generation, caching, and database integration
 */

class QuoteService {
    constructor() {
        this.provider = null;
        this.quoter = null;
        this.VALID_FEES = [500, 3000, 10000];
    }

    async ensureProvider() {
        if (!this.provider || !this.quoter) {
            this.provider = new ethers.JsonRpcProvider(config.RPC_URL);
            const network = await this.provider.getNetwork();
            const chainId = (config.FORCE_CHAIN_ID || network.chainId.toString());
            const addresses = getUniswapAddresses(chainId);
            
            // Minimal Quoter ABI for single and multi-hop quoting
            const quoterABI = {
                abi: [
                    {
                        inputs: [
                            { internalType: "address", name: "tokenIn", type: "address" },
                            { internalType: "address", name: "tokenOut", type: "address" },
                            { internalType: "uint24", name: "fee", type: "uint24" },
                            { internalType: "uint256", name: "amountIn", type: "uint256" },
                            { internalType: "uint160", name: "sqrtPriceLimitX96", type: "uint160" }
                        ],
                        name: "quoteExactInputSingle",
                        outputs: [{ internalType: "uint256", name: "amountOut", type: "uint256" }],
                        stateMutability: "nonpayable",
                        type: "function"
                    },
                    {
                        inputs: [{ internalType: "bytes", name: "path", type: "bytes" }, { internalType: "uint256", name: "amountIn", type: "uint256" }],
                        name: "quoteExactInput",
                        outputs: [{ internalType: "uint256", name: "amountOut", type: "uint256" }],
                        stateMutability: "nonpayable",
                        type: "function"
                    },
                    {
                        inputs: [
                            { internalType: "address", name: "tokenIn", type: "address" },
                            { internalType: "address", name: "tokenOut", type: "address" },
                            { internalType: "uint24", name: "fee", type: "uint24" },
                            { internalType: "uint256", name: "amountOut", type: "uint256" },
                            { internalType: "uint160", name: "sqrtPriceLimitX96", type: "uint160" }
                        ],
                        name: "quoteExactOutputSingle",
                        outputs: [{ internalType: "uint256", name: "amountIn", type: "uint256" }],
                        stateMutability: "nonpayable",
                        type: "function"
                    },
                    {
                        inputs: [{ internalType: "bytes", name: "path", type: "bytes" }, { internalType: "uint256", name: "amountOut", type: "uint256" }],
                        name: "quoteExactOutput",
                        outputs: [{ internalType: "uint256", name: "amountIn", type: "uint256" }],
                        stateMutability: "nonpayable",
                        type: "function"
                    }
                ]
            };
            
            this.quoter = new ethers.Contract(addresses.quoter, quoterABI.abi, this.provider);
        }
    }

    async getTokenDecimals(token) {
        try {
            // First try to get from database
            const dbToken = await Token.findOne({
                where: { address: token.toLowerCase(), isActive: true }
            });
            
            if (dbToken) {
                return dbToken.decimals;
            }
            
            // Fallback to on-chain call
            const erc20 = new ethers.Contract(token, ["function decimals() view returns (uint8)"], this.provider);
            return await erc20.decimals();
        } catch {
            return 18; // Default fallback
        }
    }

    encodeV3Path(hops) {
        const types = [];
        const values = [];
        for (let i = 0; i < hops.length; i++) {
            if (typeof hops[i] === 'string' && ethers.isAddress(hops[i])) {
                types.push("address");
                values.push(hops[i]);
            } else {
                types.push("uint24");
                values.push(hops[i]);
            }
        }
        return ethers.solidityPacked(types, values);
    }

    calcMinOutFromSlippage(amountOut, slippagePct = 0.5, isExactOut = false) {
        // Normalize percent to basis points
        const pct = Number(slippagePct);
        const bps = Number.isFinite(pct) ? Math.floor(pct * 100) : 0;
        const DENOM = 10_000n;
        if (isExactOut) {
            return (BigInt(amountOut) * (DENOM + BigInt(bps))) / DENOM;
        }
        return (BigInt(amountOut) * (DENOM - BigInt(bps))) / DENOM;
    }

    getAnchors() {
        return [config.WETH_ADDRESS, config.USDC_ADDRESS, config.USDT_ADDRESS].filter(Boolean);
    }

    async generateRouteCandidates(tokenIn, tokenOut) {
        const candidates = [];

        // Single-hop candidates across all fee tiers
        for (const fee of this.VALID_FEES) {
            candidates.push({ 
                kind: 'single', 
                route: [{ tokenIn, tokenOut, fee }], 
                pathTokens: [tokenIn, fee, tokenOut] 
            });
        }

        // Two-hop via anchors
        const anchors = this.getAnchors().map(a => ethers.getAddress(a));
        for (const mid of anchors) {
            if (mid.toLowerCase() === tokenIn.toLowerCase() || mid.toLowerCase() === tokenOut.toLowerCase()) continue;
            for (const feeA of this.VALID_FEES) {
                for (const feeB of this.VALID_FEES) {
                    candidates.push({ 
                        kind: 'multi', 
                        route: [
                            { tokenIn, tokenOut: mid, fee: feeA },
                            { tokenIn: mid, tokenOut, fee: feeB }
                        ], 
                        pathTokens: [tokenIn, feeA, mid, feeB, tokenOut] 
                    });
                }
            }
        }

        return candidates;
    }

    async evaluateRoutes(candidates, amountIn, mode = 'EXACT_IN') {
        const evals = [];
        
        for (const candidate of candidates) {
            try {
                let result;
                
                if (candidate.kind === 'single') {
                    if (mode === 'EXACT_IN') {
                        result = await this.quoter.quoteExactInputSingle.staticCall(
                            candidate.route[0].tokenIn, 
                            candidate.route[0].tokenOut, 
                            candidate.route[0].fee, 
                            amountIn, 
                            0
                        );
                    } else {
                        result = await this.quoter.quoteExactOutputSingle.staticCall(
                            candidate.route[0].tokenIn, 
                            candidate.route[0].tokenOut, 
                            candidate.route[0].fee, 
                            amountIn, 
                            0
                        );
                    }
                } else {
                    const encodedPath = this.encodeV3Path(candidate.pathTokens);
                    if (mode === 'EXACT_IN') {
                        result = await this.quoter.quoteExactInput.staticCall(encodedPath, amountIn);
                    } else {
                        result = await this.quoter.quoteExactOutput.staticCall(encodedPath, amountIn);
                    }
                }
                
                if (mode === 'EXACT_IN') {
                    evals.push({ ...candidate, amountOut: result });
                } else {
                    evals.push({ ...candidate, amountIn: result });
                }
            } catch (error) {
                // Ignore failing routes
                console.debug(`Route evaluation failed for ${candidate.kind}:`, error.message);
            }
        }
        
        return evals;
    }

    async getCachedQuote(chainId, tokenIn, tokenOut, fee, amountIn, mode) {
        try {
            return await QuoteCache.findCachedQuote(chainId, tokenIn, tokenOut, fee, amountIn, mode);
        } catch (error) {
            console.error('Cache lookup failed:', error);
            return null;
        }
    }

    async cacheQuote(quoteData, ttlMinutes = 5) {
        try {
            return await QuoteCache.storeQuote(quoteData, ttlMinutes);
        } catch (error) {
            console.error('Quote caching failed:', error);
            return null;
        }
    }

    async logQuoteRequest(requestData) {
        try {
            const requestId = `req_${ethers.hexlify(ethers.randomBytes(8)).slice(2)}`;
            
            await QuoteRequest.create({
                requestId,
                ...requestData
            });
            
            return requestId;
        } catch (error) {
            console.error('Quote request logging failed:', error);
            return null;
        }
    }

    async updateQuoteRequest(requestId, updateData) {
        try {
            await QuoteRequest.update(updateData, {
                where: { requestId }
            });
        } catch (error) {
            console.error('Quote request update failed:', error);
        }
    }

    async createQuote(quoteData) {
        try {
            return await Quote.create(quoteData);
        } catch (error) {
            console.error('Quote creation failed:', error);
            throw error;
        }
    }

    async generateQuote(params, requestInfo) {
        const startTime = Date.now();
        let requestId = null;
        
        try {
            const { tokenIn, tokenOut, amountIn, slippagePct = 0.5, ttlSec = 600, mode = 'EXACT_IN' } = params;
            
            // Validate inputs
            if (!tokenIn || !tokenOut || !amountIn) {
                throw new Error("tokenIn, tokenOut, amountIn are required");
            }
            
            const tIn = ethers.getAddress(tokenIn);
            const tOut = ethers.getAddress(tokenOut);
            
            // Validate tokens
            validateToken(tIn);
            validateToken(tOut);
            
            if (tIn.toLowerCase() === tOut.toLowerCase()) {
                throw new Error("tokenIn and tokenOut must differ");
            }
            
            // Get chain info
            await this.ensureProvider();
            const network = await this.provider.getNetwork();
            const chainId = (config.FORCE_CHAIN_ID || network.chainId.toString());
            
            // Log request start
            requestId = await this.logQuoteRequest({
                chainId,
                tokenIn: tIn.toLowerCase(),
                tokenOut: tOut.toLowerCase(),
                amountIn: String(amountIn),
                mode,
                slippagePct,
                ipAddress: requestInfo.ipAddress,
                userAgent: requestInfo.userAgent,
                userId: requestInfo.userId,
                userAddress: requestInfo.userAddress ? requestInfo.userAddress.toLowerCase() : null,
                rateLimitKey: requestInfo.rateLimitKey
            });
            
            // Check cache first
            const cachedQuote = await this.getCachedQuote(chainId, tIn, tOut, 3000, amountIn, mode);
            if (cachedQuote) {
                await this.updateQuoteRequest(requestId, {
                    success: true,
                    responseTime: Date.now() - startTime,
                    cacheHit: true,
                    quoteId: cachedQuote.quoteId
                });
                
                return {
                    ...cachedQuote.toJSON(),
                    fromCache: true,
                    requestId
                };
            }
            
            // Generate quote
            const candidates = await this.generateRouteCandidates(tIn, tOut);
            // Get token decimals and convert amountIn to proper format for ethers.js v6
            const decIn = await this.getTokenDecimals(tIn);
            const amountInBigInt = ethers.parseUnits(amountIn.toString(), decIn);
            const evals = await this.evaluateRoutes(candidates, amountInBigInt, mode);
            
            if (evals.length === 0) {
                throw new Error("No executable route/liquidity for this pair");
            }
            
            // Pick best route
            let best;
            if (mode === 'EXACT_IN') {
                evals.sort((a, b) => (a.amountOut > b.amountOut ? -1 : a.amountOut < b.amountOut ? 1 : 0));
                best = evals[0];
            } else {
                evals.sort((a, b) => (a.amountIn < b.amountIn ? -1 : a.amountIn > b.amountIn ? 1 : 0));
                best = evals[0];
            }
            
            // Format amounts
            const decOut = await this.getTokenDecimals(tOut);
            
            let amountOutStr, amountOutMinimum, amountInStr, amountInMaximum;
            
            if (mode === 'EXACT_IN') {
                amountOutStr = ethers.formatUnits(best.amountOut, decOut);
                amountOutMinimum = ethers.formatUnits(
                    this.calcMinOutFromSlippage(best.amountOut, slippagePct), 
                    decOut
                );
            } else {
                amountInStr = ethers.formatUnits(best.amountIn, decIn);
                amountInMaximum = ethers.formatUnits(
                    this.calcMinOutFromSlippage(best.amountIn, slippagePct, true), 
                    decIn
                );
            }
            
            const encodedPath = this.encodeV3Path(best.pathTokens);

            // Basic price impact approximation using external price feeds
            // Fetch priceIn and priceOut (USD) when available
            let priceImpactPct = "0";
            try {
                // Lazy import to avoid circular deps
                const { default: priceFeedService } = await import('./priceFeedService.js');
                const priceIn = await priceFeedService.getTokenPrice(tIn, chainId);
                const priceOut = await priceFeedService.getTokenPrice(tOut, chainId);
                if (priceIn > 0 && priceOut > 0) {
                    const inputValueUsd = Number(amountIn) * priceIn;
                    const outAmount = mode === 'EXACT_IN' ? Number(ethers.formatUnits(best.amountOut, decOut)) : Number(ethers.formatUnits(BigInt(amountIn), decOut));
                    const expectedOutFromUsd = inputValueUsd / priceOut;
                    const impact = expectedOutFromUsd > 0 ? Math.max(0, ((expectedOutFromUsd - outAmount) / expectedOutFromUsd) * 100) : 0;
                    priceImpactPct = impact.toFixed(4);
                }
            } catch {}
            const nowSec = Math.floor(Date.now() / 1000);
            const expiresAtSec = nowSec + Math.min(Math.max(1, Number(ttlSec || 600)), 24 * 60 * 60);
            const quoteId = `q_${ethers.hexlify(ethers.randomBytes(8)).slice(2)}`;
            
            // Prepare response
            const response = {
                route: best.route,
                path: encodedPath,
                quoteId,
                expiresAt: expiresAtSec,
                mode,
                priceImpactPct,
                estimatedGas: "0",
                fromCache: false
            };
            
            if (mode === 'EXACT_IN') {
                response.amountOut = amountOutStr;
                response.amountOutMinimum = amountOutMinimum;
            } else {
                response.amountIn = amountInStr;
                response.amountInMaximum = amountInMaximum;
                response.amountOut = String(amountIn);
            }
            
            // Store in database
            const quoteData = {
                chainId: Number(chainId),
                tokenIn: tIn.toLowerCase(),
                tokenOut: tOut.toLowerCase(),
                amountIn: mode === 'EXACT_IN' ? String(amountIn) : amountInStr,
                amountOut: mode === 'EXACT_IN' ? amountOutStr : String(amountIn),
                mode,
                route: best.route,
                path: encodedPath,
                amountOutMinimum: mode === 'EXACT_IN' ? amountOutMinimum : String(amountIn),
                priceImpactPct: response.priceImpactPct,
                estimatedGas: response.estimatedGas,
                quoteId,
                expiresAt: new Date(expiresAtSec * 1000),
                slippageTolerance: slippagePct
            };
            
            await this.createQuote(quoteData);
            
            // Cache the quote
            await this.cacheQuote({
                ...quoteData,
                slippagePct
            }, 5); // 5 minutes TTL
            
            // Update request log
            await this.updateQuoteRequest(requestId, {
                success: true,
                responseTime: Date.now() - startTime,
                cacheHit: false,
                quoteId
            });
            
            return { ...response, requestId };
            
        } catch (error) {
            // Log failed request
            if (requestId) {
                await this.updateQuoteRequest(requestId, {
                    success: false,
                    responseTime: Date.now() - startTime,
                    errorMessage: error.message
                });
            }
            
            throw error;
        }
    }
}

export default new QuoteService();

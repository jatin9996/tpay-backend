/**
 * Swap Router - Handles token swapping functionality using Uniswap V3
 * Provides endpoints for getting quotes, executing swaps, and managing token operations
 * 
 * ARCHITECTURE NOTE:
 * This router provides both custodial and non-custodial swap options:
 * 
 * 1. POST /swap - Custodial swap (executes from backend private key)
 *    - RISK: Backend controls user funds
 *    - REQUIRES: Operational limits, daily caps, withdrawal policies
 *    - USE CASE: High-frequency trading, institutional clients
 * 
 * 2. POST /swap/populate - Non-custodial swap (returns transaction for user to sign)
 *    - SAFER: User maintains control of their funds
 *    - NO RISK: Backend never touches user tokens
 *    - USE CASE: Retail users, self-custody preferred
 * 
 * RECOMMENDATION: Use non-custodial approach for most use cases to eliminate
 * custodial risk and regulatory complexity.
 */

import express from "express";
import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import config from "../config/env.js";
import { getUniswapAddresses } from "../config/chains.js";
import { validateToken } from "../services/tokenValidation.js";
import { validateOperationalLimits, getOperationalStatus } from "../config/operationalLimits.js";
import { serializeBigInts } from "../utils/bigIntSerializer.js";
import swapDatabaseService from "../services/swapDatabase.js";
import { v4 as uuidv4 } from 'uuid';

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read Uniswap V3 contract ABIs for swap operations
const routerABI = JSON.parse(fs.readFileSync(path.join(__dirname, "../../node_modules/@uniswap/v3-periphery/artifacts/contracts/SwapRouter.sol/SwapRouter.json"), 'utf8'));

// Create a minimal Quoter ABI since it's not included in the standard package
// Include both single-hop and multi-hop quoting functions used below
const quoterABI = {
  abi: [
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "tokenIn",
          "type": "address"
        },
        {
          "internalType": "address",
          "name": "tokenOut",
          "type": "address"
        },
        {
          "internalType": "uint24",
          "name": "fee",
          "type": "uint24"
        },
        {
          "internalType": "uint256",
          "name": "amountIn",
          "type": "uint256"
        },
        {
          "internalType": "uint160",
          "name": "sqrtPriceLimitX96",
          "type": "uint160"
        }
      ],
      "name": "quoteExactInputSingle",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "amountOut",
          "type": "uint256"
        }
      ],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        { "internalType": "bytes", "name": "path", "type": "bytes" },
        { "internalType": "uint256", "name": "amountIn", "type": "uint256" }
      ],
      "name": "quoteExactInput",
      "outputs": [
        { "internalType": "uint256", "name": "amountOut", "type": "uint256" }
      ],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "tokenIn",
          "type": "address"
        },
        {
          "internalType": "address",
          "name": "tokenOut",
          "type": "address"
        },
        {
          "internalType": "uint24",
          "name": "fee",
          "type": "uint24"
        },
        {
          "internalType": "uint256",
          "name": "amountOut",
          "type": "uint256"
        },
        {
          "internalType": "uint160",
          "name": "sqrtPriceLimitX96",
          "type": "uint160"
        }
      ],
      "name": "quoteExactOutputSingle",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "amountIn",
          "type": "uint256"
        }
      ],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        { "internalType": "bytes", "name": "path", "type": "bytes" },
        { "internalType": "uint256", "name": "amountOut", "type": "uint256" }
      ],
      "name": "quoteExactOutput",
      "outputs": [
        { "internalType": "uint256", "name": "amountIn", "type": "uint256" }
      ],
      "stateMutability": "nonpayable",
      "type": "function"
    }
  ]
};

const router = express.Router();

// Initialize Ethereum provider and wallet for blockchain interactions
let provider, wallet, uniswapRouter, quoter;

// Valid fee tiers for Uniswap V3 pools
const VALID_FEES = new Set([500, 3000, 10000]);

// Maximum TTL for swap deadlines (24 hours in seconds)
const MAX_TTL_SECONDS = 24 * 60 * 60;

// Async function to initialize blockchain connections
async function initializeBlockchain() {
    try {
        provider = new ethers.JsonRpcProvider(config.RPC_URL);
        wallet = new ethers.Wallet(config.PRIVATE_KEY, provider);
        
        // Get Uniswap addresses for the current chain
        const network = await provider.getNetwork();
        const addresses = getUniswapAddresses(network.chainId);
        uniswapRouter = new ethers.Contract(addresses.router, routerABI.abi, wallet);
        quoter = new ethers.Contract(addresses.quoter, quoterABI.abi, wallet);
        
        console.log('✅ Blockchain connections initialized');
    } catch (error) {
        console.error('❌ Failed to initialize blockchain connections:', error);
        throw error;
    }
}

// Initialize blockchain connections on startup
initializeBlockchain().catch(console.error);

/**
 * Validate TTL against maximum allowed value
 */
function validateTTL(ttl) {
    if (ttl > MAX_TTL_SECONDS) {
        throw new Error(`TTL exceeds maximum allowed value of ${MAX_TTL_SECONDS} seconds (24 hours)`);
    }
    if (ttl <= 0) {
        throw new Error('TTL must be greater than 0');
    }
}

/**
 * Validate fee tier
 */
function validateFeeTier(fee) {
    if (!VALID_FEES.has(fee)) {
        throw new Error(`Invalid fee tier. Must be one of: ${Array.from(VALID_FEES).join(', ')}`);
    }
}

/**
 * Encode V3 path for multi-hop swaps
 */
function encodeV3Path(pathTokens) {
    const types = [];
    const values = [];
    
    for (let i = 0; i < pathTokens.length; i++) {
        if (typeof pathTokens[i] === 'string' && ethers.isAddress(pathTokens[i])) {
            types.push("address");
            values.push(pathTokens[i]);
        } else {
            types.push("uint24");
            values.push(pathTokens[i]);
        }
    }
    
    return ethers.solidityPacked(types, values);
}

/**
 * Reverse a V3 path token-fee sequence for exactOutput
 * Example: [A,fee1,B,fee2,C] -> [C,fee2,B,fee1,A]
 */
function reverseV3Path(pathTokens) {
    const tokens = [];
    const fees = [];
    for (let i = 0; i < pathTokens.length; i++) {
        if (typeof pathTokens[i] === 'string' && ethers.isAddress(pathTokens[i])) {
            tokens.push(pathTokens[i]);
        } else {
            fees.push(pathTokens[i]);
        }
    }
    const reversed = [];
    for (let i = tokens.length - 1; i >= 0; i--) {
        reversed.push(tokens[i]);
        if (i > 0) {
            reversed.push(fees[i - 1]);
        }
    }
    return reversed;
}

/**
 * Normalize slippage to basis points (0-10000)
 * - Prefers slippagePct as percent value (e.g. 0.5 => 50 bps)
 * - Fallback to slippageTolerance: if <=1 treat as fraction (e.g. 0.005 => 50 bps); else as percent
 */
function getSlippageBps(slippagePct, slippageTolerance) {
    if (slippagePct !== undefined && slippagePct !== null) {
        const pct = Number(slippagePct);
        if (!Number.isFinite(pct) || pct <= 0) return 0;
        return Math.min(10000, Math.max(0, Math.floor(pct * 100)));
    }
    if (slippageTolerance !== undefined && slippageTolerance !== null) {
        const tol = Number(slippageTolerance);
        if (!Number.isFinite(tol) || tol <= 0) return 0;
        if (tol <= 1) {
            return Math.min(10000, Math.max(0, Math.floor(tol * 10000)));
        }
        return Math.min(10000, Math.max(0, Math.floor(tol * 100)));
    }
    return 0;
}

/**
 * Generate route candidates for smart order routing
 */
async function generateRouteCandidates(tokenIn, tokenOut, chainId) {
    const candidates = [];
    
    // Single-hop candidates across all fee tiers
    for (const fee of VALID_FEES) {
        candidates.push({
            kind: 'single',
            route: [{ tokenIn, tokenOut, fee }],
            pathTokens: [tokenIn, fee, tokenOut],
            hops: 1
        });
    }
    
    // Two-hop via anchor tokens (smart order routing)
    const anchors = [config.WETH_ADDRESS, config.USDC_ADDRESS, config.USDT_ADDRESS].filter(Boolean);
    for (const mid of anchors) {
        if (mid.toLowerCase() === tokenIn.toLowerCase() || mid.toLowerCase() === tokenOut.toLowerCase()) {
            continue;
        }
        
        for (const feeA of VALID_FEES) {
            for (const feeB of VALID_FEES) {
                candidates.push({
                    kind: 'multi',
                    route: [
                        { tokenIn, tokenOut: mid, fee: feeA },
                        { tokenIn: mid, tokenOut, fee: feeB }
                    ],
                    pathTokens: [tokenIn, feeA, mid, feeB, tokenOut],
                    hops: 2
                });
            }
        }
    }
    
    return candidates;
}

/**
 * Evaluate routes and find the best one
 */
async function evaluateRoutes(candidates, amountIn, mode = 'EXACT_IN') {
    const evals = [];
    
    for (const candidate of candidates) {
        try {
            let result;
            
            if (candidate.kind === 'single') {
                if (mode === 'EXACT_IN') {
                    result = await quoter.quoteExactInputSingle.staticCall(
                        candidate.route[0].tokenIn,
                        candidate.route[0].tokenOut,
                        candidate.route[0].fee,
                        amountIn,
                        0
                    );
                } else {
                    result = await quoter.quoteExactOutputSingle.staticCall(
                        candidate.route[0].tokenIn,
                        candidate.route[0].tokenOut,
                        candidate.route[0].fee,
                        amountIn,
                        0
                    );
                }
            } else {
                const encodedPath = encodeV3Path(candidate.pathTokens);
                if (mode === 'EXACT_IN') {
                    result = await quoter.quoteExactInput.staticCall(encodedPath, amountIn);
                } else {
                    result = await quoter.quoteExactOutput.staticCall(encodedPath, amountIn);
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
    
    // Sort by best output (EXACT_IN) or lowest input (EXACT_OUT)
    if (mode === 'EXACT_IN') {
        evals.sort((a, b) => Number(b.amountOut - a.amountOut));
    } else {
        evals.sort((a, b) => Number(a.amountIn - b.amountIn));
    }
    
    return evals;
}

/**
 * Calculate price impact
 */
function calculatePriceImpact(amountIn, amountOut, tokenInDecimals, tokenOutDecimals, spotPrice) {
    const inputValue = parseFloat(ethers.formatUnits(amountIn, tokenInDecimals));
    const outputValue = parseFloat(ethers.formatUnits(amountOut, tokenOutDecimals));
    
    if (spotPrice && spotPrice > 0) {
        const expectedOutput = inputValue * spotPrice;
        const priceImpact = ((expectedOutput - outputValue) / expectedOutput) * 100;
        return Math.max(0, priceImpact);
    }
    
    return 0;
}

/**
 * POST /swap - Custodial swap execution
 * Executes swap from backend wallet (requires operational limits)
 */
router.post("/swap", async (req, res) => {
    try {
        // Check if custodial mode is enabled
        const custodialEnabled = await swapDatabaseService.isFeatureEnabled('CUSTODIAL_MODE');
        if (!custodialEnabled) {
            return res.status(403).json({
                success: false,
                error: 'Custodial swaps are currently disabled for security reasons'
            });
        }

        // Check if swaps are enabled globally
        const swapsEnabled = await swapDatabaseService.isFeatureEnabled('SWAP_ENABLED');
        if (!swapsEnabled) {
            return res.status(503).json({
                success: false,
                error: 'Swap service is temporarily unavailable'
            });
        }

        const {
            tokenIn,
            tokenOut,
            amountIn,
            amountOutMinimum,
            recipient,
            fee,
            slippageTolerance,
            slippagePct,
            ttl,
            mode = 'EXACT_IN',
            clientRequestId = uuidv4(),
            userAddress,
            path: providedPath,
            route: providedRoute,
            pathTokens: providedPathTokens
        } = req.body;

        // Validate required fields
        if (!tokenIn || !tokenOut || !recipient || !fee || (!slippageTolerance && slippagePct === undefined) || !ttl) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: tokenIn, tokenOut, recipient, fee, slippageTolerance, ttl'
            });
        }

        // Validate mode
        if (!['EXACT_IN', 'EXACT_OUT'].includes(mode)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid mode. Must be EXACT_IN or EXACT_OUT'
            });
        }

        // Check for duplicate request
        const existingRequest = await swapDatabaseService.checkClientRequestId(clientRequestId);
        if (existingRequest.swapExists) {
            return res.status(409).json({
                success: false,
                error: 'Duplicate request detected',
                existingSwap: existingRequest.existingSwap
            });
        }

        // Get chain ID
        const network = await provider.getNetwork();
        const chainId = Number(network.chainId);

        // Get risk policy for the chain
        const riskPolicy = await swapDatabaseService.getRiskPolicy(chainId);

        // Validate operational limits
        const operationalStatus = await validateOperationalLimits({
            amountIn: mode === 'EXACT_IN' ? amountIn : undefined,
            amountOut: mode === 'EXACT_OUT' ? amountOutMinimum : undefined,
            slippageTolerance,
            ttl,
            fee,
            chainId
        });

        if (!operationalStatus.allowed) {
            return res.status(400).json({
                success: false,
                error: 'Operational limits exceeded',
                details: operationalStatus.reasons
            });
        }

        // Validate tokens
        const [tokenInValid, tokenOutValid] = await Promise.all([
            validateToken(tokenIn, chainId),
            validateToken(tokenOut, chainId)
        ]);

        if (!tokenInValid.valid || !tokenOutValid.valid) {
            return res.status(400).json({
                success: false,
                error: 'Invalid token(s)',
                details: {
                    tokenIn: tokenInValid.reasons,
                    tokenOut: tokenOutValid.reasons
                }
            });
        }

        // Calculate amounts based on mode
        let amountInWei, expectedOut, minOut, requiredIn, maxIn;
        let deadline;
        const slippageBps = getSlippageBps(slippagePct, slippageTolerance);

        if (mode === 'EXACT_IN') {
            if (!amountIn) {
                return res.status(400).json({
                    success: false,
                    error: 'amountIn is required for EXACT_IN mode'
                });
            }

            amountInWei = ethers.parseUnits(amountIn, tokenInValid.decimals);
            deadline = Math.floor(Date.now() / 1000) + ttl;

            // Build or select route and quote
            try {
                let routeInfo;
                if (providedPath) {
                    routeInfo = { kind: 'multi', path: providedPath, pathTokens: providedPathTokens || null };
                    expectedOut = await quoter.quoteExactInput.staticCall(providedPath, amountInWei);
                } else if (providedRoute && Array.isArray(providedRoute) && providedRoute.length > 1) {
                    const pathTokens = [];
                    for (let i = 0; i < providedRoute.length; i++) {
                        const hop = providedRoute[i];
                        pathTokens.push(hop.tokenIn);
                        pathTokens.push(hop.fee);
                        if (i === providedRoute.length - 1) {
                            pathTokens.push(hop.tokenOut);
                        }
                    }
                    const path = encodeV3Path(pathTokens);
                    routeInfo = { kind: 'multi', path, pathTokens };
                    expectedOut = await quoter.quoteExactInput.staticCall(path, amountInWei);
                } else if (providedRoute && Array.isArray(providedRoute) && providedRoute.length === 1) {
                    const hop = providedRoute[0];
                    routeInfo = { kind: 'single', fee: hop.fee };
                    expectedOut = await quoter.quoteExactInputSingle.staticCall(
                        hop.tokenIn, hop.tokenOut, hop.fee, amountInWei, 0
                    );
                } else {
                    // Auto-route selection
                    const candidates = await generateRouteCandidates(tokenIn, tokenOut, chainId);
                    const evals = await evaluateRoutes(candidates, amountInWei, 'EXACT_IN');
                    if (evals.length === 0) throw new Error('No executable route');
                    const best = evals[0];
                    expectedOut = best.amountOut;
                    routeInfo = best;
                }

                // Compute minOut using bps
                minOut = (expectedOut * BigInt(10000 - slippageBps)) / 10000n;

                // Persist chosen route in context for execution
                req._tpayRouteInfo = routeInfo;
            } catch (error) {
                console.error('Quote failed:', error);
                return res.status(400).json({
                    success: false,
                    error: 'Failed to get quote for swap'
                });
            }
        } else { // EXACT_OUT
            if (!amountOutMinimum) {
                return res.status(400).json({
                    success: false,
                    error: 'amountOutMinimum is required for EXACT_OUT mode'
                });
            }

            const amountOutWei = ethers.parseUnits(amountOutMinimum, tokenOutValid.decimals);
            deadline = Math.floor(Date.now() / 1000) + ttl;

            // Build or select route and quote
            try {
                let routeInfo;
                if (providedPath) {
                    // For exactOutput, path must be reversed (tokenOut->tokenIn)
                    routeInfo = { kind: 'multi', path: providedPath, pathTokens: providedPathTokens || null };
                    requiredIn = await quoter.quoteExactOutput.staticCall(providedPath, amountOutWei);
                } else if (providedRoute && Array.isArray(providedRoute) && providedRoute.length > 1) {
                    const pathTokens = [];
                    for (let i = providedRoute.length - 1; i >= 0; i--) {
                        const hop = providedRoute[i];
                        pathTokens.push(hop.tokenOut);
                        pathTokens.push(hop.fee);
                        if (i === 0) {
                            pathTokens.push(hop.tokenIn);
                        }
                    }
                    const path = encodeV3Path(pathTokens);
                    routeInfo = { kind: 'multi', path, pathTokens };
                    requiredIn = await quoter.quoteExactOutput.staticCall(path, amountOutWei);
                } else if (providedRoute && Array.isArray(providedRoute) && providedRoute.length === 1) {
                    const hop = providedRoute[0];
                    routeInfo = { kind: 'single', fee: hop.fee };
                    requiredIn = await quoter.quoteExactOutputSingle.staticCall(
                        hop.tokenIn, hop.tokenOut, hop.fee, amountOutWei, 0
                    );
                } else {
                    // Auto-route selection
                    const candidates = await generateRouteCandidates(tokenIn, tokenOut, chainId);
                    const evals = await evaluateRoutes(candidates, amountOutWei, 'EXACT_OUT');
                    if (evals.length === 0) throw new Error('No executable route');
                    const best = evals[0];
                    requiredIn = best.amountIn;
                    routeInfo = best;
                }

                // Compute maxIn using bps
                maxIn = (requiredIn * BigInt(10000 + slippageBps)) / 10000n;
                amountInWei = maxIn;
                expectedOut = amountOutWei;
                minOut = amountOutWei;
                req._tpayRouteInfo = routeInfo;
            } catch (error) {
                console.error('Quote failed:', error);
                return res.status(400).json({
                    success: false,
                    error: 'Failed to get quote for swap'
                });
            }
        }

        // Create swap record in database
        const swapRecord = await swapDatabaseService.createSwap({
            chainId,
            mode,
            tokenIn,
            tokenOut,
            recipient,
            feeTier: fee,
            slippagePct: slippageTolerance,
            ttlSec: ttl,
            deadline: new Date(deadline * 1000),
            amountIn: ethers.formatUnits(amountInWei, tokenInValid.decimals),
            amountInWei: amountInWei.toString(),
            expectedOut: ethers.formatUnits(expectedOut, tokenOutValid.decimals),
            minOut: ethers.formatUnits(minOut, tokenOutValid.decimals),
            requiredIn: requiredIn ? ethers.formatUnits(requiredIn, tokenInValid.decimals) : null,
            maxIn: maxIn ? ethers.formatUnits(maxIn, tokenInValid.decimals) : null,
            isCustodial: true,
            userAddress,
            clientRequestId,
            metadata: {
                operationalLimits: operationalStatus,
                tokenValidation: {
                    tokenIn: tokenInValid,
                    tokenOut: tokenOutValid
                }
            }
        });

        // Execute swap on blockchain
        let txHash, gasUsed, gasPrice;
        try {
            let tx;
            const routeInfo = req._tpayRouteInfo;
            if (routeInfo && routeInfo.kind === 'multi') {
                const pathBytes = routeInfo.path || encodeV3Path(routeInfo.pathTokens);
                const swapParams = {
                    path: pathBytes,
                    recipient,
                    deadline,
                    amountIn: amountInWei,
                    amountOutMinimum: minOut
                };
                tx = await uniswapRouter.exactInput(swapParams);
            } else {
                const swapParams = {
                    tokenIn,
                    tokenOut,
                    fee: routeInfo?.fee || fee,
                    recipient,
                    deadline,
                    amountIn: amountInWei,
                    amountOutMinimum: minOut,
                    sqrtPriceLimitX96: 0
                };
                tx = await uniswapRouter.exactInputSingle(swapParams);
            }
            const receipt = await tx.wait();

            txHash = tx.hash;
            gasUsed = receipt.gasUsed;
            gasPrice = tx.gasPrice;

            // Update swap status to completed
            await swapDatabaseService.updateSwapStatus(swapRecord.id, 'completed', txHash, {
                gasUsed: Number(gasUsed),
                gasPrice: gasPrice.toString(),
                blockNumber: receipt.blockNumber,
                confirmations: receipt.confirmations
            });

            // Create transaction record
            await swapDatabaseService.upsertTransaction({
                txHash,
                chainId,
                fromAddress: wallet.address,
                toAddress: uniswapRouter.target,
                gasLimit: tx.gasLimit,
                gasUsed: Number(gasUsed),
                gasPrice: gasPrice.toString(),
                status: 'confirmed',
                blockNumber: receipt.blockNumber,
                blockHash: receipt.blockHash,
                confirmations: receipt.confirmations,
                raw: {
                    to: tx.to,
                    data: tx.data,
                    value: tx.value.toString()
                }
            });

            res.json({
                success: true,
                swapId: swapRecord.id,
                txHash,
                status: 'completed',
                gasUsed: gasUsed.toString(),
                gasPrice: gasPrice.toString(),
                blockNumber: receipt.blockNumber,
                amountIn: ethers.formatUnits(amountInWei, tokenInValid.decimals),
                amountOut: ethers.formatUnits(expectedOut, tokenOutValid.decimals),
                mode,
                recipient
            });

        } catch (error) {
            console.error('Swap execution failed:', error);

            // Update swap status to failed
            await swapDatabaseService.updateSwapStatus(swapRecord.id, 'failed', null, {
                errorMsg: error.message
            });

            res.status(500).json({
                success: false,
                error: 'Swap execution failed',
                swapId: swapRecord.id,
                details: error.message
            });
        }

    } catch (error) {
        console.error('Swap endpoint error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error.message
        });
    }
});

/**
 * POST /swap/exact-out - Exact output swap execution
 * Executes swap with exact output amount (custodial)
 */
router.post("/swap/exact-out", async (req, res) => {
    try {
        // Check if exact-out mode is enabled
        const exactOutEnabled = await swapDatabaseService.isFeatureEnabled('EXACT_OUT_ENABLED');
        if (!exactOutEnabled) {
            return res.status(403).json({
                success: false,
                error: 'Exact-out swaps are currently disabled'
            });
        }

        // Check if custodial mode is enabled
        const custodialEnabled = await swapDatabaseService.isFeatureEnabled('CUSTODIAL_MODE');
        if (!custodialEnabled) {
            return res.status(403).json({
                success: false,
                error: 'Custodial swaps are currently disabled for security reasons'
            });
        }

        const {
            tokenIn,
            tokenOut,
            amountOut,
            amountInMaximum,
            recipient,
            fee,
            slippageTolerance,
            ttl,
            clientRequestId = uuidv4(),
            userAddress
        } = req.body;

        // Validate required fields
        if (!tokenIn || !tokenOut || !amountOut || !amountInMaximum || !recipient || !fee || !slippageTolerance || !ttl) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: tokenIn, tokenOut, amountOut, amountInMaximum, recipient, fee, slippageTolerance, ttl'
            });
        }

        // Check for duplicate request
        const existingRequest = await swapDatabaseService.checkClientRequestId(clientRequestId);
        if (existingRequest.swapExists) {
            return res.status(409).json({
                success: false,
                error: 'Duplicate request detected',
                existingSwap: existingRequest.existingSwap
            });
        }

        // Get chain ID
        const network = await provider.getNetwork();
        const chainId = Number(network.chainId);

        // Get risk policy for the chain
        const riskPolicy = await swapDatabaseService.getRiskPolicy(chainId);

        // Validate operational limits
        const operationalStatus = await validateOperationalLimits({
            amountOut,
            amountInMaximum,
            slippageTolerance,
            ttl,
            fee,
            chainId
        });

        if (!operationalStatus.allowed) {
            return res.status(400).json({
                success: false,
                error: 'Operational limits exceeded',
                details: operationalStatus.reasons
            });
        }

        // Validate tokens
        const [tokenInValid, tokenOutValid] = await Promise.all([
            validateToken(tokenIn, chainId),
            validateToken(tokenOut, chainId)
        ]);

        if (!tokenInValid.valid || !tokenOutValid.valid) {
            return res.status(400).json({
                success: false,
                error: 'Invalid token(s)',
                details: {
                    tokenIn: tokenInValid.reasons,
                    tokenOut: tokenOutValid.reasons
                }
            });
        }

        // Calculate amounts
        const amountOutWei = ethers.parseUnits(amountOut, tokenOutValid.decimals);
        const amountInMaximumWei = ethers.parseUnits(amountInMaximum, tokenInValid.decimals);
        const deadline = Math.floor(Date.now() / 1000) + ttl;

        // Get quote for exact output
        let requiredIn;
        try {
            requiredIn = await quoter.quoteExactOutputSingle.staticCall(
                tokenIn,
                tokenOut,
                fee,
                amountOutWei,
                0
            );
        } catch (error) {
            console.error('Quote failed:', error);
            return res.status(400).json({
                success: false,
                error: 'Failed to get quote for exact-out swap'
            });
        }

        // Validate that required input is within maximum
        if (requiredIn > amountInMaximumWei) {
            return res.status(400).json({
                success: false,
                error: 'Required input amount exceeds maximum allowed',
                requiredIn: ethers.formatUnits(requiredIn, tokenInValid.decimals),
                amountInMaximum
            });
        }

        // Create swap record in database
        const swapRecord = await swapDatabaseService.createSwap({
            chainId,
            mode: 'EXACT_OUT',
            tokenIn,
            tokenOut,
            recipient,
            feeTier: fee,
            slippagePct: slippageTolerance,
            ttlSec: ttl,
            deadline: new Date(deadline * 1000),
            amountIn: ethers.formatUnits(requiredIn, tokenInValid.decimals),
            amountInWei: requiredIn.toString(),
            expectedOut: amountOut,
            minOut: amountOut,
            requiredIn: ethers.formatUnits(requiredIn, tokenInValid.decimals),
            maxIn: amountInMaximum,
            isCustodial: true,
            userAddress,
            clientRequestId,
            metadata: {
                operationalLimits: operationalStatus,
                tokenValidation: {
                    tokenIn: tokenInValid,
                    tokenOut: tokenOutValid
                }
            }
        });

        // Execute swap on blockchain
        let txHash, gasUsed, gasPrice;
        try {
            let tx;
            const routeInfo = { kind: 'single', fee };
            const swapParams = {
                tokenIn,
                tokenOut,
                fee: routeInfo.fee,
                recipient,
                deadline,
                amountOut: amountOutWei,
                amountInMaximum: amountInMaximumWei,
                sqrtPriceLimitX96: 0
            };
            tx = await uniswapRouter.exactOutputSingle(swapParams);
            const receipt = await tx.wait();

            txHash = tx.hash;
            gasUsed = receipt.gasUsed;
            gasPrice = tx.gasPrice;

            // Update swap status to completed
            await swapDatabaseService.updateSwapStatus(swapRecord.id, 'completed', txHash, {
                gasUsed: Number(gasUsed),
                gasPrice: gasPrice.toString(),
                blockNumber: receipt.blockNumber,
                confirmations: receipt.confirmations
            });

            // Create transaction record
            await swapDatabaseService.upsertTransaction({
                txHash,
                chainId,
                fromAddress: wallet.address,
                toAddress: uniswapRouter.target,
                gasLimit: tx.gasLimit,
                gasUsed: Number(gasUsed),
                gasPrice: gasPrice.toString(),
                status: 'confirmed',
                blockNumber: receipt.blockNumber,
                blockHash: receipt.blockHash,
                confirmations: receipt.confirmations,
                raw: {
                    to: tx.to,
                    data: tx.data,
                    value: tx.value.toString()
                }
            });

            res.json({
                success: true,
                swapId: swapRecord.id,
                txHash,
                status: 'completed',
                gasUsed: gasUsed.toString(),
                gasPrice: gasPrice.toString(),
                blockNumber: receipt.blockNumber,
                amountIn: ethers.formatUnits(requiredIn, tokenInValid.decimals),
                amountOut,
                mode: 'EXACT_OUT',
                recipient
            });

        } catch (error) {
            console.error('Exact-out swap execution failed:', error);

            // Update swap status to failed
            await swapDatabaseService.updateSwapStatus(swapRecord.id, 'failed', null, {
                errorMsg: error.message
            });

            res.status(500).json({
                success: false,
                error: 'Exact-out swap execution failed',
                swapId: swapRecord.id,
                details: error.message
            });
        }

    } catch (error) {
        console.error('Exact-out swap endpoint error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error.message
        });
    }
});

/**
 * POST /swap/populate - Non-custodial transaction population
 * Returns populated transaction for user to sign
 */
router.post("/swap/populate", async (req, res) => {
    try {
        const {
            tokenIn,
            tokenOut,
            amountIn,
            amountOutMinimum,
            recipient,
            fee,
            slippageTolerance,
            slippagePct,
            ttl,
            mode = 'EXACT_IN',
            clientRequestId = uuidv4(),
            userAddress,
            path: providedPath,
            route: providedRoute,
            pathTokens: providedPathTokens
        } = req.body;

        // Validate required fields
        if (!tokenIn || !tokenOut || !recipient || !fee || (!slippageTolerance && slippagePct === undefined) || !ttl) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: tokenIn, tokenOut, recipient, fee, slippageTolerance, ttl'
            });
        }

        // Validate mode
        if (!['EXACT_IN', 'EXACT_OUT'].includes(mode)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid mode. Must be EXACT_IN or EXACT_OUT'
            });
        }

        // Check for duplicate request
        const existingRequest = await swapDatabaseService.checkClientRequestId(clientRequestId);
        if (existingRequest.populationExists) {
            return res.status(409).json({
                success: false,
                error: 'Duplicate request detected',
                existingPopulation: existingRequest.existingPopulation
            });
        }

        // Get chain ID
        const network = await provider.getNetwork();
        const chainId = Number(network.chainId);

        // Get risk policy for the chain
        const riskPolicy = await swapDatabaseService.getRiskPolicy(chainId);

        // Validate operational limits
        const operationalStatus = await validateOperationalLimits({
            amountIn: mode === 'EXACT_IN' ? amountIn : undefined,
            amountOut: mode === 'EXACT_OUT' ? amountOutMinimum : undefined,
            slippageTolerance,
            ttl,
            fee,
            chainId
        });

        if (!operationalStatus.allowed) {
            return res.status(400).json({
                success: false,
                error: 'Operational limits exceeded',
                details: operationalStatus.reasons
            });
        }

        // Validate tokens
        const [tokenInValid, tokenOutValid] = await Promise.all([
            validateToken(tokenIn, chainId),
            validateToken(tokenOut, chainId)
        ]);

        if (!tokenInValid.valid || !tokenOutValid.valid) {
            return res.status(400).json({
                success: false,
                error: 'Invalid token(s)',
                details: {
                    tokenIn: tokenInValid.reasons,
                    tokenOut: tokenOutValid.reasons
                }
            });
        }

        // Calculate amounts and deadline
        let amountInWei, expectedOut, minOut, requiredIn, maxIn;
        let deadline;

        if (mode === 'EXACT_IN') {
            if (!amountIn) {
                return res.status(400).json({
                    success: false,
                    error: 'amountIn is required for EXACT_IN mode'
                });
            }

            amountInWei = ethers.parseUnits(amountIn, tokenInValid.decimals);
            deadline = Math.floor(Date.now() / 1000) + ttl;

            try {
                let routeInfo;
                if (providedPath) {
                    routeInfo = { kind: 'multi', path: providedPath, pathTokens: providedPathTokens || null };
                    expectedOut = await quoter.quoteExactInput.staticCall(providedPath, amountInWei);
                } else if (providedRoute && Array.isArray(providedRoute) && providedRoute.length > 1) {
                    const pathTokensSel = [];
                    for (let i = 0; i < providedRoute.length; i++) {
                        const hop = providedRoute[i];
                        pathTokensSel.push(hop.tokenIn);
                        pathTokensSel.push(hop.fee);
                        if (i === providedRoute.length - 1) {
                            pathTokensSel.push(hop.tokenOut);
                        }
                    }
                    const pathSel = encodeV3Path(pathTokensSel);
                    routeInfo = { kind: 'multi', path: pathSel, pathTokens: pathTokensSel };
                    expectedOut = await quoter.quoteExactInput.staticCall(pathSel, amountInWei);
                } else if (providedRoute && Array.isArray(providedRoute) && providedRoute.length === 1) {
                    const hop = providedRoute[0];
                    routeInfo = { kind: 'single', fee: hop.fee };
                    expectedOut = await quoter.quoteExactInputSingle.staticCall(hop.tokenIn, hop.tokenOut, hop.fee, amountInWei, 0);
                } else {
                    const candidates = await generateRouteCandidates(tokenIn, tokenOut, chainId);
                    const evals = await evaluateRoutes(candidates, amountInWei, 'EXACT_IN');
                    if (evals.length === 0) throw new Error('No executable route');
                    const best = evals[0];
                    expectedOut = best.amountOut;
                    routeInfo = best;
                }
                minOut = (expectedOut * BigInt(10000 - getSlippageBps(slippagePct, slippageTolerance))) / 10000n;
                req._tpayRouteInfo = routeInfo;
            } catch (error) {
                console.error('Quote failed:', error);
                return res.status(400).json({
                    success: false,
                    error: 'Failed to get quote for swap'
                });
            }
        } else { // EXACT_OUT
            if (!amountOutMinimum) {
                return res.status(400).json({
                    success: false,
                    error: 'amountOutMinimum is required for EXACT_OUT mode'
                });
            }

            const amountOutWei = ethers.parseUnits(amountOutMinimum, tokenOutValid.decimals);
            deadline = Math.floor(Date.now() / 1000) + ttl;

            try {
                let routeInfo;
                if (providedPath) {
                    routeInfo = { kind: 'multi', path: providedPath, pathTokens: providedPathTokens || null };
                    requiredIn = await quoter.quoteExactOutput.staticCall(providedPath, amountOutWei);
                } else if (providedRoute && Array.isArray(providedRoute) && providedRoute.length > 1) {
                    const pathTokensSel = [];
                    for (let i = providedRoute.length - 1; i >= 0; i--) {
                        const hop = providedRoute[i];
                        pathTokensSel.push(hop.tokenOut);
                        pathTokensSel.push(hop.fee);
                        if (i === 0) pathTokensSel.push(hop.tokenIn);
                    }
                    const pathSel = encodeV3Path(pathTokensSel);
                    routeInfo = { kind: 'multi', path: pathSel, pathTokens: pathTokensSel };
                    requiredIn = await quoter.quoteExactOutput.staticCall(pathSel, amountOutWei);
                } else if (providedRoute && Array.isArray(providedRoute) && providedRoute.length === 1) {
                    const hop = providedRoute[0];
                    routeInfo = { kind: 'single', fee: hop.fee };
                    requiredIn = await quoter.quoteExactOutputSingle.staticCall(hop.tokenIn, hop.tokenOut, hop.fee, amountOutWei, 0);
                } else {
                    const candidates = await generateRouteCandidates(tokenIn, tokenOut, chainId);
                    const evals = await evaluateRoutes(candidates, amountOutWei, 'EXACT_OUT');
                    if (evals.length === 0) throw new Error('No executable route');
                    const best = evals[0];
                    requiredIn = best.amountIn;
                    routeInfo = best;
                }
                const bps = getSlippageBps(slippagePct, slippageTolerance);
                maxIn = (requiredIn * BigInt(10000 + bps)) / 10000n;
                amountInWei = maxIn;
                expectedOut = amountOutWei;
                minOut = amountOutWei;
                req._tpayRouteInfo = routeInfo;
            } catch (error) {
                console.error('Quote failed:', error);
                return res.status(400).json({
                    success: false,
                    error: 'Failed to get quote for exact-out swap'
                });
            }
        }

        // Estimate gas
        let estimatedGas;
        try {
            const routeInfo = req._tpayRouteInfo;
            if (mode === 'EXACT_IN') {
                if (routeInfo && routeInfo.kind === 'multi') {
                    const gasParams = {
                        path: routeInfo.path || encodeV3Path(routeInfo.pathTokens),
                        recipient,
                        deadline,
                        amountIn: amountInWei,
                        amountOutMinimum: minOut
                    };
                    estimatedGas = await uniswapRouter.exactInput.estimateGas(gasParams);
                } else {
                    const swapParams = {
                        tokenIn,
                        tokenOut,
                        fee: routeInfo?.fee || fee,
                        recipient,
                        deadline,
                        amountIn: amountInWei,
                        amountOutMinimum: minOut,
                        sqrtPriceLimitX96: 0
                    };
                    estimatedGas = await uniswapRouter.exactInputSingle.estimateGas(swapParams);
                }
            } else {
                if (routeInfo && routeInfo.kind === 'multi') {
                    const gasParams = {
                        path: routeInfo.path || encodeV3Path(routeInfo.pathTokens),
                        recipient,
                        deadline,
                        amountOut: ethers.parseUnits(amountOutMinimum, tokenOutValid.decimals),
                        amountInMaximum: amountInWei
                    };
                    estimatedGas = await uniswapRouter.exactOutput.estimateGas(gasParams);
                } else {
                    const swapParams = {
                        tokenIn,
                        tokenOut,
                        fee: routeInfo?.fee || fee,
                        recipient,
                        deadline,
                        amountOut: ethers.parseUnits(amountOutMinimum, tokenOutValid.decimals),
                        amountInMaximum: amountInWei,
                        sqrtPriceLimitX96: 0
                    };
                    estimatedGas = await uniswapRouter.exactOutputSingle.estimateGas(swapParams);
                }
            }
        } catch (error) {
            console.error('Gas estimation failed:', error);
            estimatedGas = '500000'; // Default fallback
        }

        // Create transaction population record
        const population = await swapDatabaseService.createTxPopulation({
            chainId,
            requestId: clientRequestId,
            payload: {
                tokenIn,
                tokenOut,
                fee,
                recipient,
                deadline,
                mode,
                ...(mode === 'EXACT_IN' ? {
                    amountIn: amountInWei.toString(),
                    amountOutMinimum: minOut.toString()
                } : {
                    amountOut: ethers.parseUnits(amountOutMinimum, tokenOutValid.decimals).toString(),
                    amountInMaximum: amountInWei.toString()
                })
            },
            estimatedGas: estimatedGas.toString(),
            tokenIn,
            tokenOut,
            mode,
            slippagePct: slippageTolerance,
            deadline: new Date(deadline * 1000),
            amountIn: ethers.formatUnits(amountInWei, tokenInValid.decimals),
            amountOut: ethers.formatUnits(expectedOut, tokenOutValid.decimals),
            userAddress,
            clientIp: req.ip,
            userAgent: req.get('User-Agent')
        });

        // Build transaction data
        const swapParams = mode === 'EXACT_IN' ? {
            tokenIn,
            tokenOut,
            fee,
            recipient,
            deadline,
            amountIn: amountInWei,
            amountOutMinimum: minOut,
            sqrtPriceLimitX96: 0
        } : {
            tokenIn,
            tokenOut,
            fee,
            recipient,
            deadline,
            amountOut: ethers.parseUnits(amountOutMinimum, tokenOutValid.decimals),
            amountInMaximum: amountInWei,
            sqrtPriceLimitX96: 0
        };

        let populatedTx;
        const routeInfo = req._tpayRouteInfo;
        if (mode === 'EXACT_IN') {
            if (routeInfo && routeInfo.kind === 'multi') {
                const txParams = {
                    path: routeInfo.path || encodeV3Path(routeInfo.pathTokens),
                    recipient,
                    deadline,
                    amountIn: amountInWei,
                    amountOutMinimum: minOut
                };
                populatedTx = await uniswapRouter.exactInput.populateTransaction(txParams);
            } else {
                populatedTx = await uniswapRouter.exactInputSingle.populateTransaction(swapParams);
            }
        } else {
            if (routeInfo && routeInfo.kind === 'multi') {
                const txParams = {
                    path: routeInfo.path || encodeV3Path(routeInfo.pathTokens),
                    recipient,
                    deadline,
                    amountOut: ethers.parseUnits(amountOutMinimum, tokenOutValid.decimals),
                    amountInMaximum: amountInWei
                };
                populatedTx = await uniswapRouter.exactOutput.populateTransaction(txParams);
            } else {
                populatedTx = await uniswapRouter.exactOutputSingle.populateTransaction(swapParams);
            }
        }

        res.json({
            success: true,
            requestId: clientRequestId,
            populatedTransaction: {
                to: populatedTx.to,
                data: populatedTx.data,
                value: populatedTx.value?.toString() || '0',
                gasLimit: estimatedGas.toString()
            },
            swapDetails: {
                mode,
                tokenIn,
                tokenOut,
                amountIn: ethers.formatUnits(amountInWei, tokenInValid.decimals),
                amountOut: ethers.formatUnits(expectedOut, tokenOutValid.decimals),
                fee,
                slippageTolerance,
                deadline: new Date(deadline * 1000).toISOString(),
                recipient
            },
            estimatedGas: estimatedGas.toString(),
            chainId
        });

    } catch (error) {
        console.error('Transaction population endpoint error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error.message
        });
    }
});

/**
 * POST /swap/populate/exact-out - Non-custodial exact-out transaction population
 */
router.post("/swap/populate/exact-out", async (req, res) => {
    try {
        const {
            tokenIn,
            tokenOut,
            amountOut,
            amountInMaximum,
            recipient,
            fee,
            slippageTolerance,
            ttl,
            clientRequestId = uuidv4(),
            userAddress
        } = req.body;

        // Validate required fields
        if (!tokenIn || !tokenOut || !amountOut || !amountInMaximum || !recipient || !fee || !slippageTolerance || !ttl) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: tokenIn, tokenOut, amountOut, amountInMaximum, recipient, fee, slippageTolerance, ttl'
            });
        }

        // Check for duplicate request
        const existingRequest = await swapDatabaseService.checkClientRequestId(clientRequestId);
        if (existingRequest.populationExists) {
            return res.status(409).json({
                success: false,
                error: 'Duplicate request detected',
                existingPopulation: existingRequest.existingPopulation
            });
        }

        // Get chain ID
        const network = await provider.getNetwork();
        const chainId = Number(network.chainId);

        // Get risk policy for the chain
        const riskPolicy = await swapDatabaseService.getRiskPolicy(chainId);

        // Validate operational limits
        const operationalStatus = await validateOperationalLimits({
            amountOut,
            amountInMaximum,
            slippageTolerance,
            ttl,
            fee,
            chainId
        });

        if (!operationalStatus.allowed) {
            return res.status(400).json({
                success: false,
                error: 'Operational limits exceeded',
                details: operationalStatus.reasons
            });
        }

        // Validate tokens
        const [tokenInValid, tokenOutValid] = await Promise.all([
            validateToken(tokenIn, chainId),
            validateToken(tokenOut, chainId)
        ]);

        if (!tokenInValid.valid || !tokenOutValid.valid) {
            return res.status(400).json({
                success: false,
                error: 'Invalid token(s)',
                details: {
                    tokenIn: tokenInValid.reasons,
                    tokenOut: tokenOutValid.reasons
                }
            });
        }

        // Calculate amounts and deadline
        const amountOutWei = ethers.parseUnits(amountOut, tokenOutValid.decimals);
        const amountInMaximumWei = ethers.parseUnits(amountInMaximum, tokenInValid.decimals);
        const deadline = Math.floor(Date.now() / 1000) + ttl;

        // Get quote for exact output
        let requiredIn;
        try {
            requiredIn = await quoter.quoteExactOutputSingle.staticCall(
                tokenIn,
                tokenOut,
                fee,
                amountOutWei,
                0
            );
        } catch (error) {
            console.error('Quote failed:', error);
            return res.status(400).json({
                success: false,
                error: 'Failed to get quote for exact-out swap'
            });
        }

        // Validate that required input is within maximum
        if (requiredIn > amountInMaximumWei) {
            return res.status(400).json({
                success: false,
                error: 'Required input amount exceeds maximum allowed',
                requiredIn: ethers.formatUnits(requiredIn, tokenInValid.decimals),
                amountInMaximum
            });
        }

        // Estimate gas
        let estimatedGas;
        try {
            const swapParams = {
                tokenIn,
                tokenOut,
                fee,
                recipient,
                deadline,
                amountOut: amountOutWei,
                amountInMaximum: amountInMaximumWei,
                sqrtPriceLimitX96: 0
            };
            estimatedGas = await uniswapRouter.exactOutputSingle.estimateGas(swapParams);
        } catch (error) {
            console.error('Gas estimation failed:', error);
            estimatedGas = '500000'; // Default fallback
        }

        // Create transaction population record
        const population = await swapDatabaseService.createTxPopulation({
            chainId,
            requestId: clientRequestId,
            payload: {
                tokenIn,
                tokenOut,
                fee,
                recipient,
                deadline,
                mode: 'EXACT_OUT',
                amountOut: amountOutWei.toString(),
                amountInMaximum: amountInMaximumWei.toString()
            },
            estimatedGas: estimatedGas.toString(),
            tokenIn,
            tokenOut,
            mode: 'EXACT_OUT',
            slippagePct: slippageTolerance,
            deadline: new Date(deadline * 1000),
            amountIn: ethers.formatUnits(requiredIn, tokenInValid.decimals),
            amountOut,
            userAddress,
            clientIp: req.ip,
            userAgent: req.get('User-Agent')
        });

        // Build transaction data
        const swapParams = {
            tokenIn,
            tokenOut,
            fee,
            recipient,
            deadline,
            amountOut: amountOutWei,
            amountInMaximum: amountInMaximumWei,
            sqrtPriceLimitX96: 0
        };

        const populatedTx = await uniswapRouter.exactOutputSingle.populateTransaction(swapParams);

        res.json({
            success: true,
            requestId: clientRequestId,
            populatedTransaction: {
                to: populatedTx.to,
                data: populatedTx.data,
                value: populatedTx.value?.toString() || '0',
                gasLimit: estimatedGas.toString()
            },
            swapDetails: {
                mode: 'EXACT_OUT',
                tokenIn,
                tokenOut,
                amountIn: ethers.formatUnits(requiredIn, tokenInValid.decimals),
                amountOut,
                fee,
                slippageTolerance,
                deadline: new Date(deadline * 1000).toISOString(),
                recipient
            },
            estimatedGas: estimatedGas.toString(),
            chainId
        });

    } catch (error) {
        console.error('Exact-out transaction population endpoint error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error.message
        });
    }
});

/**
 * GET /swap/:swapId - Get swap details
 */
router.get("/swap/:swapId", async (req, res) => {
    try {
        const { swapId } = req.params;
        
        const swap = await swapDatabaseService.getSwapById(swapId);
        if (!swap) {
            return res.status(404).json({
                success: false,
                error: 'Swap not found'
            });
        }

        res.json({
            success: true,
            swap: serializeBigInts(swap)
        });

    } catch (error) {
        console.error('Get swap endpoint error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error.message
        });
    }
});

/**
 * GET /swap/user/:userAddress - Get user swaps
 */
router.get("/swap/user/:userAddress", async (req, res) => {
    try {
        const { userAddress } = req.params;
        const { limit = 50, offset = 0 } = req.query;

        const swaps = await swapDatabaseService.getSwapsByUser(
            userAddress,
            parseInt(limit),
            parseInt(offset)
        );

        res.json({
            success: true,
            swaps: serializeBigInts(swaps.rows),
            pagination: {
                total: swaps.count,
                limit: parseInt(limit),
                offset: parseInt(offset),
                hasMore: swaps.count > parseInt(offset) + swaps.rows.length
            }
        });

    } catch (error) {
        console.error('Get user swaps endpoint error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error.message
        });
    }
});

/**
 * GET /swap/stats - Get swap statistics
 */
router.get("/swap/stats", async (req, res) => {
    try {
        const { chainId, timeRange = '24h' } = req.query;

        const stats = await swapDatabaseService.getSwapStats(
            chainId ? parseInt(chainId) : null,
            timeRange
        );

        res.json({
            success: true,
            stats: serializeBigInts(stats),
            timeRange,
            chainId: chainId ? parseInt(chainId) : null
        });

    } catch (error) {
        console.error('Get swap stats endpoint error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error.message
        });
    }
});

export default router;

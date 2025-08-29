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

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read Uniswap V3 contract ABIs for swap operations
const routerABI = JSON.parse(fs.readFileSync(path.join(__dirname, "../../node_modules/@uniswap/v3-periphery/artifacts/contracts/SwapRouter.sol/SwapRouter.json"), 'utf8'));

// Create a minimal Quoter ABI since it's not included in the standard package
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
        
        // Get chain ID and corresponding Uniswap V3 addresses
        const network = await provider.getNetwork();
        let chainId = network.chainId.toString();
        
        // Allow forcing a specific chain ID via environment variable (useful for testing)
        if (config.FORCE_CHAIN_ID) {
            chainId = config.FORCE_CHAIN_ID;
            console.log(`Forcing chain ID to: ${chainId} (from environment variable)`);
        }
        
        console.log(`Connected to chain ID: ${chainId}`);
        
        // Get chain-specific Uniswap V3 addresses
        const uniswapAddresses = getUniswapAddresses(chainId);
        console.log(`Using Uniswap V3 addresses for chain ${chainId}:`, {
            quoter: uniswapAddresses.quoter,
            router: uniswapAddresses.router
        });
        
        // Initialize Uniswap V3 Router contract for executing swaps
        uniswapRouter = new ethers.Contract(uniswapAddresses.router, routerABI.abi, wallet);
        
        // Initialize Quoter contract for getting price quotes before swaps
        quoter = new ethers.Contract(uniswapAddresses.quoter, quoterABI.abi, provider);
        
        console.log("Blockchain initialization completed successfully");
    } catch (error) {
        console.error("Failed to initialize blockchain:", error);
        throw error;
    }
}

// Initialize blockchain connections when the module loads
initializeBlockchain().catch(console.error);

/**
 * Middleware to ensure blockchain is initialized before processing requests
 */
async function ensureBlockchainInitialized(req, res, next) {
    if (!provider || !wallet || !uniswapRouter || !quoter) {
        try {
            // Try to initialize if not already done
            await initializeBlockchain();
            next();
        } catch (error) {
            console.error("Blockchain initialization failed:", error);
            return res.status(503).json({ 
                error: "Service temporarily unavailable - blockchain connection failed",
                details: error.message
            });
        }
    } else {
        next();
    }
}

/**
 * Validates and formats Ethereum addresses
 * @param {string} address - The address to validate
 * @param {string} addressName - Name of the address for error messages
 * @returns {string} Checksummed Ethereum address
 * @throws {Error} If address is invalid or missing
 */
function validateAndFormatAddress(address, addressName) {
    try {
        if (!address) {
            throw new Error(`${addressName} address is required`);
        }
        
        // Check if it's a valid Ethereum address
        if (!ethers.isAddress(address)) {
            throw new Error(`${addressName} is not a valid Ethereum address: ${address}`);
        }
        
        // Return the checksummed address
        return ethers.getAddress(address);
    } catch (error) {
        throw new Error(`Invalid ${addressName}: ${error.message}`);
    }
}

/**
 * Validates fee tier for Uniswap V3 pools
 * @param {number} fee - The fee to validate
 * @returns {number} Validated fee
 * @throws {Error} If fee is invalid
 */
function validateFee(fee) {
    if (!Number.isInteger(fee) || !VALID_FEES.has(Number(fee))) {
        throw new Error("Invalid pool fee; use 500, 3000, or 10000");
    }
    return fee;
}

/**
 * Validates and calculates deadline timestamp
 * @param {number} ttlSec - Time to live in seconds (optional)
 * @returns {number} Deadline timestamp
 */
function calculateDeadline(ttlSec = 600) { // Default 10 minutes
    if (ttlSec <= 0 || ttlSec > MAX_TTL_SECONDS) {
        throw new Error(`TTL must be between 1 and ${MAX_TTL_SECONDS} seconds`);
    }
    return Math.floor(Date.now() / 1000) + ttlSec;
}

/**
 * Gets the decimal places for a given token
 * @param {string} tokenAddress - The token contract address
 * @returns {number} Number of decimal places (defaults to 18 if query fails)
 */
async function getTokenDecimals(tokenAddress) {
    try {
        const tokenContract = new ethers.Contract(tokenAddress, [
            "function decimals() view returns (uint8)"
        ], provider);
        return await tokenContract.decimals();
    } catch (error) {
        console.warn(`Failed to get decimals for token ${tokenAddress}, using default 18:`, error.message);
        return 18; // Default fallback
    }
}

/**
 * Ensures a token has sufficient allowance for the router to spend
 * @param {string} tokenAddress - The token contract address
 * @param {string} ownerAddress - The token owner's address
 * @param {string} spenderAddress - The address that needs approval (router)
 * @param {string} amount - The amount to approve
 * @returns {boolean} True if approval is successful
 * @throws {Error} If approval fails
 */
async function ensureTokenApproval(tokenAddress, ownerAddress, spenderAddress, amount) {
    try {
        const tokenContract = new ethers.Contract(tokenAddress, [
            "function allowance(address owner, address spender) view returns (uint256)",
            "function approve(address spender, uint256 amount) returns (bool)"
        ], wallet);
        
        const allowance = await tokenContract.allowance(ownerAddress, spenderAddress);
        
        if (allowance < amount) {
            // Get token decimals for accurate logging
            const dec = await getTokenDecimals(tokenAddress);
            console.log(`Approving ${ethers.formatUnits(amount, dec)} tokens for router...`);
            const approveTx = await tokenContract.approve(spenderAddress, amount);
            await approveTx.wait();
            console.log("Token approval successful");
        } else {
            console.log("Sufficient allowance already exists");
        }
        
        return true;
    } catch (error) {
        throw new Error(`Token approval failed: ${error.message}`);
    }
}

/**
 * Calculates minimum output amount based on slippage tolerance using basis points
 * @param {BigInt} expectedOutWei - Expected output amount in Wei (BigInt)
 * @param {number} slippagePct - Slippage tolerance as percentage
 * @returns {BigInt} Minimum output amount after slippage in Wei
 * @throws {Error} If slippage is out of valid range
 */
function calcMinOutFromSlippage(expectedOutWei, slippagePct) {
    const bps = Math.round(Number(slippagePct) * 100);
    if (bps < 10 || bps > 5000) {
        throw new Error("Slippage must be between 0.1% and 50%");
    }
    const DENOM = 10_000n;
    return (BigInt(expectedOutWei) * (DENOM - BigInt(bps))) / DENOM;
}

/**
 * GET QUOTE ENDPOINT
 * Provides price quotes for token swaps without executing the transaction
 * Used to show users expected output before they commit to a swap
 */
router.post("/quote", ensureBlockchainInitialized, async (req, res) => {
    try {
        const { tokenIn, tokenOut, amountIn, fee = 3000 } = req.body;

        // Use default token addresses from environment variables if not provided
        const tokenInAddress = tokenIn || config.WETH_ADDRESS;
        // Prefer WMATIC when present (Polygon), otherwise fall back to USDC as a common quote asset
        const tokenOutAddress = tokenOut || config.WMATIC_ADDRESS || config.USDC_ADDRESS;

        // Validate that we have token addresses
        if (!tokenInAddress || !tokenOutAddress) {
            return res.status(400).json({ 
                error: "Token addresses are required. Either provide them in the request body or set WETH_ADDRESS and WMATIC_ADDRESS in your .env file" 
            });
        }

        // Normalize addresses upfront
        const normalizedTokenIn = ethers.getAddress(tokenInAddress);
        const normalizedTokenOut = ethers.getAddress(tokenOutAddress);

        // Guard against same token swap
        if (normalizedTokenIn.toLowerCase() === normalizedTokenOut.toLowerCase()) {
            return res.status(400).json({ 
                error: "Cannot swap token for itself" 
            });
        }

        // Validate fee tier
        let validatedFee;
        try {
            validatedFee = validateFee(fee);
        } catch (feeError) {
            return res.status(400).json({ error: feeError.message });
        }

        // Validate tokens using the token validation service
        let validatedTokenIn, validatedTokenOut;
        try {
            validatedTokenIn = validateToken(normalizedTokenIn);
            validatedTokenOut = validateToken(normalizedTokenOut);
        } catch (validationError) {
            return res.status(400).json({ 
                error: `Token validation failed: ${validationError.message}`,
                tokenIn: normalizedTokenIn,
                tokenOut: normalizedTokenOut
            });
        }

        // Validate input amount
        if (!amountIn || isNaN(amountIn) || parseFloat(amountIn) <= 0) {
            return res.status(400).json({ 
                error: "Valid amountIn is required and must be greater than 0" 
            });
        }

        // Get token decimals and convert amount to Wei
        const tokenInDecimals = await getTokenDecimals(validatedTokenIn);
        const amountInWei = ethers.parseUnits(amountIn, tokenInDecimals);

        // Get quote from Uniswap V3 Quoter contract
        const quoteAmountOut = await quoter.quoteExactInputSingle.staticCall(
            validatedTokenIn,
            validatedTokenOut,
            validatedFee,
            amountInWei,
            0 
        );

        // Reserve sanity check - reject if quote returns 0
        if (quoteAmountOut <= 0n) {
            return res.status(400).json({ 
                error: "No executable route/liquidity for this pair" 
            });
        }

        // Get token out decimals for proper formatting
        const tokenOutDecimals = await getTokenDecimals(validatedTokenOut);
        const formattedAmountOut = ethers.formatUnits(quoteAmountOut, tokenOutDecimals);

        // Get current chain info
        const network = await provider.getNetwork();
        const chainId = network.chainId.toString();

        const response = {
            success: true,
            chainId: chainId,
            tokenIn: validatedTokenIn,
            tokenOut: validatedTokenOut,
            amountIn: amountIn,
            expectedAmountOut: formattedAmountOut,
            fee: validatedFee,
            tokenInDecimals: tokenInDecimals,
            tokenOutDecimals: tokenOutDecimals
        };
        
        // Serialize any BigInt values before sending response
        const serializedResponse = serializeBigInts(response);
        res.json(serializedResponse);
    } catch (err) {
        console.error("Quote error:", err);
        
        // Handle specific Uniswap errors with user-friendly messages
        if (err.message.includes("INSUFFICIENT_LIQUIDITY")) {
            return res.status(400).json({ error: "Insufficient liquidity for this swap" });
        }
        if (err.message.includes("EXCESSIVE_INPUT_AMOUNT")) {
            return res.status(400).json({ error: "Input amount too high for available liquidity" });
        }
        // Ethers BAD_DATA usually means wrong contract for chain or method reverted silently
        if (err.code === 'BAD_DATA' || /could not decode result data/i.test(err.message)) {
            return res.status(400).json({ 
                error: "Failed to get quote. Possible causes: unsupported chain configuration, incorrect Quoter address, or no pool/liquidity for the selected fee.",
                hint: "Verify RPC_URL chain matches FORCE_CHAIN_ID/DEFAULT_CHAIN_ID, and that Uniswap V3 addresses in chains.js are correct for that chain. Try a different fee tier (500/3000/10000)."
            });
        }
        
        res.status(500).json({ error: err.message });
    }
});

/**
 * EXECUTE SWAP ENDPOINT
 * Executes the actual token swap on the blockchain
 * Includes slippage protection, gas estimation, and transaction execution
 */
router.post("/swap", ensureBlockchainInitialized, async (req, res) => {
    try {
        const { tokenIn, tokenOut, amountIn, recipient, slippageTolerance = 0.5, fee = 3000, ttlSec = 600 } = req.body;

        // Use default token addresses from environment variables if not provided
        const tokenInAddress = tokenIn || config.WETH_ADDRESS;
        const tokenOutAddress = tokenOut || config.WMATIC_ADDRESS || config.USDC_ADDRESS;

        // Validate that we have token addresses
        if (!tokenInAddress || !tokenOutAddress) {
            return res.status(400).json({ 
                error: "Token addresses are required. Either provide them in the request body or set WETH_ADDRESS and WMATIC_ADDRESS in your .env file" 
            });
        }

        // Normalize addresses upfront
        const normalizedTokenIn = ethers.getAddress(tokenInAddress);
        const normalizedTokenOut = ethers.getAddress(tokenOutAddress);

        // Guard against same token swap
        if (normalizedTokenIn.toLowerCase() === normalizedTokenOut.toLowerCase()) {
            return res.status(400).json({ 
                error: "Cannot swap token for itself" 
            });
        }

        // Validate tokens and recipient address using strict checking
        let validatedTokenIn, validatedTokenOut, validatedRecipient;
        try {
            validatedTokenIn = validateToken(normalizedTokenIn);
            validatedTokenOut = validateToken(normalizedTokenOut);
            validatedRecipient = validateAndFormatAddress(recipient, "Recipient");
        } catch (validationError) {
            return res.status(400).json({ 
                error: `Token validation failed: ${validationError.message}`,
                tokenIn: normalizedTokenIn,
                tokenOut: normalizedTokenOut
            });
        }

        // Validate fee tier
        let validatedFee;
        try {
            validatedFee = validateFee(fee);
        } catch (feeError) {
            return res.status(400).json({ error: feeError.message });
        }

        // Validate input amount
        if (!amountIn || isNaN(amountIn) || parseFloat(amountIn) <= 0) {
            return res.status(400).json({ 
                error: "Valid amountIn is required and must be greater than 0" 
            });
        }

        // Validate slippage tolerance (0.1% to 50%)
        if (slippageTolerance < 0.1 || slippageTolerance > 50) {
            return res.status(400).json({ 
                error: "Slippage tolerance must be between 0.1% and 50%" 
            });
        }

        // Validate operational limits for custodial swaps
        const operationalValidation = validateOperationalLimits({
            slippageTolerance,
            ttlSec,
            fee: validatedFee
        });
        
        if (!operationalValidation.isValid) {
            return res.status(400).json({ 
                error: "Swap operation exceeds operational limits",
                details: operationalValidation.errors,
                limits: operationalValidation.limits
            });
        }

        // Calculate deadline with TTL validation
        let deadline;
        try {
            deadline = calculateDeadline(ttlSec);
        } catch (deadlineError) {
            return res.status(400).json({ error: deadlineError.message });
        }

        // Get token decimals dynamically and convert amount to Wei
        const tokenInDecimals = await getTokenDecimals(validatedTokenIn);
        const amountInWei = ethers.parseUnits(amountIn, tokenInDecimals);

        // Get quote for slippage calculation and protection - ABORT if quote fails
        let expectedAmountOut;
        try {
            const quoteAmountOut = await quoter.quoteExactInputSingle.staticCall(
                validatedTokenIn,
                validatedTokenOut,
                validatedFee,
                amountInWei,
                0
            );
            
            // Reserve sanity check - reject if quote returns 0
            if (quoteAmountOut <= 0n) {
                return res.status(400).json({ 
                    error: "No executable route/liquidity for this pair" 
                });
            }
            
            expectedAmountOut = quoteAmountOut;
        } catch (quoteError) {
            console.error("Quote failed, aborting swap:", quoteError.message);
            if (quoteError.code === 'BAD_DATA' || /could not decode result data/i.test(quoteError.message)) {
                return res.status(400).json({ 
                    error: "Failed to get quote. Possible causes: unsupported chain configuration, incorrect Quoter address, or no pool/liquidity for the selected fee.",
                    hint: "Verify RPC_URL chain matches FORCE_CHAIN_ID/DEFAULT_CHAIN_ID, and that Uniswap V3 addresses in chains.js are correct for that chain. Try a different fee tier (500/3000/10000)."
                });
            }
            return res.status(400).json({ error: "Failed to get quote for slippage protection. Please try again or contact support if the issue persists." });
        }
        
        // Calculate minimum output amount based on slippage tolerance
        let amountOutMinimum;
        try {
            amountOutMinimum = calcMinOutFromSlippage(expectedAmountOut, slippageTolerance);
        } catch (slippageError) {
            return res.status(400).json({ error: slippageError.message });
        }

        // Ensure the router has approval to spend the signer's tokens
        // Use the initialized router contract address as spender
        await ensureTokenApproval(
            validatedTokenIn,
            wallet.address,
            uniswapRouter.target,
            amountInWei
        );

        // Estimate gas for the swap transaction
        let gasEstimate;
        try {
            gasEstimate = await uniswapRouter.exactInputSingle.estimateGas({
                tokenIn: validatedTokenIn,
                tokenOut: validatedTokenOut,
                fee: validatedFee,
                recipient: validatedRecipient,
                deadline: deadline,
                amountIn: amountInWei,
                amountOutMinimum: amountOutMinimum,
                sqrtPriceLimitX96: 0
            });
        } catch (gasError) {
            console.warn("Gas estimation failed, using default:", gasError.message);
            gasEstimate = 300000n; // Default gas limit
        }

        // Execute the swap transaction on the blockchain
        const tx = await uniswapRouter.exactInputSingle({
            tokenIn: validatedTokenIn,
            tokenOut: validatedTokenOut,
            fee: validatedFee,
            recipient: validatedRecipient,
            deadline: deadline,
            amountIn: amountInWei,
            amountOutMinimum: amountOutMinimum,
            sqrtPriceLimitX96: 0
        }, { 
            gasLimit: Math.floor(Number(gasEstimate) * 1.2) // 20% gas buffer for safety
        });

        // Wait for transaction confirmation
        await tx.wait();

        // Get current chain info
        const network = await provider.getNetwork();
        const chainId = network.chainId.toString();

        // Store swap details for history tracking (database implementation can be added here)
        const swapRecord = {
            txHash: tx.hash,
            chainId: chainId,
            tokenIn: validatedTokenIn,
            tokenOut: validatedTokenOut,
            amountIn: amountIn,
            amountInWei: amountInWei.toString(),
            expectedAmountOut: ethers.formatUnits(expectedAmountOut, await getTokenDecimals(validatedTokenOut)),
            amountOutMinimum: ethers.formatUnits(amountOutMinimum, await getTokenDecimals(validatedTokenOut)),
            recipient: validatedRecipient,
            fee: validatedFee,
            slippageTolerance: slippageTolerance,
            deadline: deadline,
            ttlSec: ttlSec,
            timestamp: new Date().toISOString(),
            status: 'completed',
            mode: 'EXACT_IN'
        };

        const response = { 
            success: true, 
            chainId: chainId,
            txHash: tx.hash,
            swapDetails: swapRecord
        };
        
        // Serialize any BigInt values before sending response
        const serializedResponse = serializeBigInts(response);
        res.json(serializedResponse);
    } catch (err) {
        console.error("Swap error:", err);
        
        // Handle specific Uniswap errors with user-friendly messages
        if (err.message.includes("INSUFFICIENT_OUTPUT_AMOUNT")) {
            return res.status(400).json({ error: "Slippage tolerance exceeded - try increasing slippage or reducing amount" });
        }
        if (err.message.includes("EXPIRED")) {
            return res.status(400).json({ error: "Transaction deadline expired - please try again" });
        }
        if (err.message.includes("INSUFFICIENT_LIQUIDITY")) {
            return res.status(400).json({ error: "Insufficient liquidity for this swap" });
        }
        if (err.message.includes("EXCESSIVE_INPUT_AMOUNT")) {
            return res.status(400).json({ error: "Input amount too high for available liquidity" });
        }
        if (err.message.includes("Token approval failed")) {
            return res.status(400).json({ error: err.message });
        }
        
        res.status(500).json({ error: err.message });
    }
});

/**
 * EXACT-OUT SWAP ENDPOINT
 * Executes exact-out token swaps where user specifies desired output amount
 * System calculates required input amount and executes the swap
 */
router.post("/swap/exact-out", ensureBlockchainInitialized, async (req, res) => {
    try {
        const { tokenIn, tokenOut, amountOut, recipient, slippageTolerance = 0.5, fee = 3000, ttlSec = 600 } = req.body;

        // Use default token addresses from environment variables if not provided
        const tokenInAddress = tokenIn || config.WETH_ADDRESS;
        const tokenOutAddress = tokenOut || config.WMATIC_ADDRESS || config.USDC_ADDRESS;

        // Validate that we have token addresses
        if (!tokenInAddress || !tokenOutAddress) {
            return res.status(400).json({ 
                error: "Token addresses are required. Either provide them in the request body or set WETH_ADDRESS and WMATIC_ADDRESS in your .env file" 
            });
        }

        // Normalize addresses upfront
        const normalizedTokenIn = ethers.getAddress(tokenInAddress);
        const normalizedTokenOut = ethers.getAddress(tokenOutAddress);

        // Guard against same token swap
        if (normalizedTokenIn.toLowerCase() === normalizedTokenOut.toLowerCase()) {
            return res.status(400).json({ 
                error: "Cannot swap token for itself" 
            });
        }

        // Validate tokens and recipient address using strict checking
        let validatedTokenIn, validatedTokenOut, validatedRecipient;
        try {
            validatedTokenIn = validateToken(normalizedTokenIn);
            validatedTokenOut = validateToken(normalizedTokenOut);
            validatedRecipient = validateAndFormatAddress(recipient, "Recipient");
        } catch (validationError) {
            return res.status(400).json({ 
                error: `Token validation failed: ${validationError.message}`,
                tokenIn: normalizedTokenIn,
                tokenOut: normalizedTokenOut
            });
        }

        // Validate fee tier
        let validatedFee;
        try {
            validatedFee = validateFee(fee);
        } catch (feeError) {
            return res.status(400).json({ error: feeError.message });
        }

        // Validate output amount
        if (!amountOut || isNaN(amountOut) || parseFloat(amountOut) <= 0) {
            return res.status(400).json({ 
                error: "Valid amountOut is required and must be greater than 0" 
            });
        }

        // Validate slippage tolerance (0.1% to 50%)
        if (slippageTolerance < 0.1 || slippageTolerance > 50) {
            return res.status(400).json({ 
                error: "Slippage tolerance must be between 0.1% and 50%" 
            });
        }

        // Validate operational limits for custodial swaps
        const operationalValidation = validateOperationalLimits({
            slippageTolerance,
            ttlSec,
            fee: validatedFee
        });
        
        if (!operationalValidation.isValid) {
            return res.status(400).json({ 
                error: "Swap operation exceeds operational limits",
                details: operationalValidation.errors,
                limits: operationalValidation.limits
            });
        }

        // Calculate deadline with TTL validation
        let deadline;
        try {
            deadline = calculateDeadline(ttlSec);
        } catch (deadlineError) {
            return res.status(400).json({ error: deadlineError.message });
        }

        // Get token decimals and convert amount to Wei
        const tokenOutDecimals = await getTokenDecimals(validatedTokenOut);
        const amountOutWei = ethers.parseUnits(amountOut, tokenOutDecimals);

        // Get quote for exact-output to calculate required input amount
        let requiredAmountIn;
        try {
            const quoteAmountIn = await quoter.quoteExactOutputSingle.staticCall(
                validatedTokenIn,
                validatedTokenOut,
                validatedFee,
                amountOutWei,
                0
            );
            
            // Reserve sanity check - reject if quote returns 0
            if (quoteAmountIn <= 0n) {
                return res.status(400).json({ 
                    error: "No executable route/liquidity for this pair" 
                });
            }
            
            requiredAmountIn = quoteAmountIn;
        } catch (quoteError) {
            console.error("Quote failed, aborting swap:", quoteError.message);
            if (quoteError.code === 'BAD_DATA' || /could not decode result data/i.test(quoteError.message)) {
                return res.status(400).json({ 
                    error: "Failed to get quote. Possible causes: unsupported chain configuration, incorrect Quoter address, or no pool/liquidity for the selected fee.",
                    hint: "Verify RPC_URL chain matches FORCE_CHAIN_ID/DEFAULT_CHAIN_ID, and that Uniswap V3 addresses in chains.js are correct for that chain. Try a different fee tier (500/3000/10000)."
                });
            }
            return res.status(400).json({ error: "Failed to get quote for exact-out swap. Please try again or contact support if the issue persists." });
        }
        
        // Calculate maximum input amount based on slippage tolerance
        let amountInMaximum;
        try {
            const bps = Math.round(Number(slippageTolerance) * 100);
            const DENOM = 10_000n;
            amountInMaximum = (BigInt(requiredAmountIn) * (DENOM + BigInt(bps))) / DENOM;
        } catch (slippageError) {
            return res.status(400).json({ error: "Invalid slippage tolerance" });
        }

        // Ensure the router has approval to spend the signer's tokens
        await ensureTokenApproval(
            validatedTokenIn,
            wallet.address,
            uniswapRouter.target,
            amountInMaximum
        );

        // Estimate gas for the exact-output swap transaction
        let gasEstimate;
        try {
            gasEstimate = await uniswapRouter.exactOutputSingle.estimateGas({
                tokenIn: validatedTokenIn,
                tokenOut: validatedTokenOut,
                fee: validatedFee,
                recipient: validatedRecipient,
                deadline: deadline,
                amountOut: amountOutWei,
                amountInMaximum: amountInMaximum,
                sqrtPriceLimitX96: 0
            });
        } catch (gasError) {
            console.warn("Gas estimation failed, using default:", gasError.message);
            gasEstimate = 300000n; // Default gas limit
        }

        // Execute the exact-output swap transaction on the blockchain
        const tx = await uniswapRouter.exactOutputSingle({
            tokenIn: validatedTokenIn,
            tokenOut: validatedTokenOut,
            fee: validatedFee,
            recipient: validatedRecipient,
            deadline: deadline,
            amountOut: amountOutWei,
            amountInMaximum: amountInMaximum,
            sqrtPriceLimitX96: 0
        }, { 
            gasLimit: Math.floor(Number(gasEstimate) * 1.2) // 20% gas buffer for safety
        });

        // Wait for transaction confirmation
        await tx.wait();

        // Get current chain info
        const network = await provider.getNetwork();
        const chainId = network.chainId.toString();

        // Get token in decimals for proper formatting
        const tokenInDecimals = await getTokenDecimals(validatedTokenIn);

        // Store swap details for history tracking
        const swapRecord = {
            txHash: tx.hash,
            chainId: chainId,
            tokenIn: validatedTokenIn,
            tokenOut: validatedTokenOut,
            amountIn: ethers.formatUnits(requiredAmountIn, tokenInDecimals),
            amountInWei: requiredAmountIn.toString(),
            amountOut: amountOut,
            amountOutMinimum: amountOut,
            recipient: validatedRecipient,
            fee: validatedFee,
            slippageTolerance: slippageTolerance,
            deadline: deadline,
            ttlSec: ttlSec,
            timestamp: new Date().toISOString(),
            status: 'completed',
            mode: 'EXACT_OUT'
        };

        const response = { 
            success: true, 
            chainId: chainId,
            txHash: tx.hash,
            swapDetails: swapRecord
        };
        
        // Serialize any BigInt values before sending response
        const serializedResponse = serializeBigInts(response);
        res.json(serializedResponse);
    } catch (err) {
        console.error("Exact-out swap error:", err);
        
        // Handle specific Uniswap errors with user-friendly messages
        if (err.message.includes("EXCESSIVE_INPUT_AMOUNT")) {
            return res.status(400).json({ error: "Slippage tolerance exceeded - try increasing slippage or reducing output amount" });
        }
        if (err.message.includes("EXPIRED")) {
            return res.status(400).json({ error: "Transaction deadline expired - please try again" });
        }
        if (err.message.includes("INSUFFICIENT_LIQUIDITY")) {
            return res.status(400).json({ error: "Insufficient liquidity for this swap" });
        }
        if (err.message.includes("Token approval failed")) {
            return res.status(400).json({ error: err.message });
        }
        
        res.status(500).json({ error: err.message });
    }
});

/**
 * EXACT-OUT SWAP ENDPOINT
 * Executes exact-out token swaps where user specifies desired output amount
 * System calculates required input amount and executes the swap
 */
router.post("/swap/exact-out", ensureBlockchainInitialized, async (req, res) => {
    try {
        const { tokenIn, tokenOut, amountOut, recipient, slippageTolerance = 0.5, fee = 3000, ttlSec = 600 } = req.body;

        // Use default token addresses from environment variables if not provided
        const tokenInAddress = tokenIn || config.WETH_ADDRESS;
        const tokenOutAddress = tokenOut || config.WMATIC_ADDRESS || config.USDC_ADDRESS;

        // Validate that we have token addresses
        if (!tokenInAddress || !tokenOutAddress) {
            return res.status(400).json({ 
                error: "Token addresses are required. Either provide them in the request body or set WETH_ADDRESS and WMATIC_ADDRESS in your .env file" 
            });
        }

        // Normalize addresses upfront
        const normalizedTokenIn = ethers.getAddress(tokenInAddress);
        const normalizedTokenOut = ethers.getAddress(tokenOutAddress);

        // Guard against same token swap
        if (normalizedTokenIn.toLowerCase() === normalizedTokenOut.toLowerCase()) {
            return res.status(400).json({ 
                error: "Cannot swap token for itself" 
            });
        }

        // Validate tokens and recipient address using strict checking
        let validatedTokenIn, validatedTokenOut, validatedRecipient;
        try {
            validatedTokenIn = validateToken(normalizedTokenIn);
            validatedTokenOut = validateToken(normalizedTokenOut);
            validatedRecipient = validateAndFormatAddress(recipient, "Recipient");
        } catch (validationError) {
            return res.status(400).json({ 
                error: `Token validation failed: ${validationError.message}`,
                tokenIn: normalizedTokenIn,
                tokenOut: normalizedTokenOut
            });
        }

        // Validate fee tier
        let validatedFee;
        try {
            validatedFee = validateFee(fee);
        } catch (feeError) {
            return res.status(400).json({ error: feeError.message });
        }

        // Validate output amount
        if (!amountOut || isNaN(amountOut) || parseFloat(amountOut) <= 0) {
            return res.status(400).json({ 
                error: "Valid amountOut is required and must be greater than 0" 
            });
        }

        // Validate slippage tolerance (0.1% to 50%)
        if (slippageTolerance < 0.1 || slippageTolerance > 50) {
            return res.status(400).json({ 
                error: "Slippage tolerance must be between 0.1% and 50%" 
            });
        }

        // Validate operational limits for custodial swaps
        const operationalValidation = validateOperationalLimits({
            slippageTolerance,
            ttlSec,
            fee: validatedFee
        });
        
        if (!operationalValidation.isValid) {
            return res.status(400).json({ 
                error: "Swap operation exceeds operational limits",
                details: operationalValidation.errors,
                limits: operationalValidation.limits
            });
        }

        // Calculate deadline with TTL validation
        let deadline;
        try {
            deadline = calculateDeadline(ttlSec);
        } catch (deadlineError) {
            return res.status(400).json({ error: deadlineError.message });
        }

        // Get token decimals and convert amount to Wei
        const tokenOutDecimals = await getTokenDecimals(validatedTokenOut);
        const amountOutWei = ethers.parseUnits(amountOut, tokenOutDecimals);

        // Get quote for exact-output to calculate required input amount
        let requiredAmountIn;
        try {
            const quoteAmountIn = await quoter.quoteExactOutputSingle.staticCall(
                validatedTokenIn,
                validatedTokenOut,
                validatedFee,
                amountOutWei,
                0
            );
            
            // Reserve sanity check - reject if quote returns 0
            if (quoteAmountIn <= 0n) {
                return res.status(400).json({ 
                    error: "No executable route/liquidity for this pair" 
                });
            }
            
            requiredAmountIn = quoteAmountIn;
        } catch (quoteError) {
            console.error("Quote failed, aborting swap:", quoteError.message);
            if (quoteError.code === 'BAD_DATA' || /could not decode result data/i.test(quoteError.message)) {
                return res.status(400).json({ 
                    error: "Failed to get quote. Possible causes: unsupported chain configuration, incorrect Quoter address, or no pool/liquidity for the selected fee.",
                    hint: "Verify RPC_URL chain matches FORCE_CHAIN_ID/DEFAULT_CHAIN_ID, and that Uniswap V3 addresses in chains.js are correct for that chain. Try a different fee tier (500/3000/10000)."
                });
            }
            return res.status(400).json({ error: "Failed to get quote for exact-out swap. Please try again or contact support if the issue persists." });
        }
        
        // Calculate maximum input amount based on slippage tolerance
        let amountInMaximum;
        try {
            const bps = Math.round(Number(slippageTolerance) * 100);
            const DENOM = 10_000n;
            amountInMaximum = (BigInt(requiredAmountIn) * (DENOM + BigInt(bps))) / DENOM;
        } catch (slippageError) {
            return res.status(400).json({ error: "Invalid slippage tolerance" });
        }

        // Ensure the router has approval to spend the signer's tokens
        await ensureTokenApproval(
            validatedTokenIn,
            wallet.address,
            uniswapRouter.target,
            amountInMaximum
        );

        // Estimate gas for the exact-output swap transaction
        let gasEstimate;
        try {
            gasEstimate = await uniswapRouter.exactOutputSingle.estimateGas({
                tokenIn: validatedTokenIn,
                tokenOut: validatedTokenOut,
                fee: validatedFee,
                recipient: validatedRecipient,
                deadline: deadline,
                amountOut: amountOutWei,
                amountInMaximum: amountInMaximum,
                sqrtPriceLimitX96: 0
            });
        } catch (gasError) {
            console.warn("Gas estimation failed, using default:", gasError.message);
            gasEstimate = 300000n; // Default gas limit
        }

        // Execute the exact-output swap transaction on the blockchain
        const tx = await uniswapRouter.exactOutputSingle({
            tokenIn: validatedTokenIn,
            tokenOut: validatedTokenOut,
            fee: validatedFee,
            recipient: validatedRecipient,
            deadline: deadline,
            amountOut: amountOutWei,
            amountInMaximum: amountInMaximum,
            sqrtPriceLimitX96: 0
        }, { 
            gasLimit: Math.floor(Number(gasEstimate) * 1.2) // 20% gas buffer for safety
        });

        // Wait for transaction confirmation
        await tx.wait();

        // Get current chain info
        const network = await provider.getNetwork();
        const chainId = network.chainId.toString();

        // Get token in decimals for proper formatting
        const tokenInDecimals = await getTokenDecimals(validatedTokenIn);

        // Store swap details for history tracking
        const swapRecord = {
            txHash: tx.hash,
            chainId: chainId,
            tokenIn: validatedTokenIn,
            tokenOut: validatedTokenOut,
            amountIn: ethers.formatUnits(requiredAmountIn, tokenInDecimals),
            amountInWei: requiredAmountIn.toString(),
            amountOut: amountOut,
            amountOutMinimum: amountOut,
            recipient: validatedRecipient,
            fee: validatedFee,
            slippageTolerance: slippageTolerance,
            deadline: deadline,
            ttlSec: ttlSec,
            timestamp: new Date().toISOString(),
            status: 'completed',
            mode: 'EXACT_OUT'
        };

        const response = { 
            success: true, 
            chainId: chainId,
            txHash: tx.hash,
            swapDetails: swapRecord
        };
        
        // Serialize any BigInt values before sending response
        const serializedResponse = serializeBigInts(response);
        res.json(serializedResponse);
    } catch (err) {
        console.error("Exact-out swap error:", err);
        
        // Handle specific Uniswap errors with user-friendly messages
        if (err.message.includes("EXCESSIVE_INPUT_AMOUNT")) {
            return res.status(400).json({ error: "Slippage tolerance exceeded - try increasing slippage or reducing output amount" });
        }
        if (err.message.includes("EXPIRED")) {
            return res.status(400).json({ error: "Transaction deadline expired - please try again" });
        }
        if (err.message.includes("INSUFFICIENT_LIQUIDITY")) {
            return res.status(400).json({ error: "Insufficient liquidity for this swap" });
        }
        if (err.message.includes("Token approval failed")) {
            return res.status(400).json({ error: err.message });
        }
        
        res.status(500).json({ error: err.message });
    }
});

/**
 * NON-CUSTODIAL SWAP ENDPOINT (Architecture Improvement)
 * Returns a populated transaction for the user to sign in their wallet
 * Eliminates custodial risk by not executing swaps from the backend
 */
router.post("/swap/populate", ensureBlockchainInitialized, async (req, res) => {
    try {
        const { tokenIn, tokenOut, amountIn, recipient, slippageTolerance = 0.5, fee = 3000, ttlSec = 600 } = req.body;

        // Use default token addresses from environment variables if not provided
        const tokenInAddress = tokenIn || config.WETH_ADDRESS;
        const tokenOutAddress = tokenOut || config.WMATIC_ADDRESS || config.USDC_ADDRESS;

        // Validate that we have token addresses
        if (!tokenInAddress || !tokenOutAddress) {
            return res.status(400).json({ 
                error: "Token addresses are required. Either provide them in the request body or set WETH_ADDRESS and WMATIC_ADDRESS in your .env file" 
            });
        }

        // Normalize addresses upfront
        const normalizedTokenIn = ethers.getAddress(tokenInAddress);
        const normalizedTokenOut = ethers.getAddress(tokenOutAddress);

        // Guard against same token swap
        if (normalizedTokenIn.toLowerCase() === normalizedTokenOut.toLowerCase()) {
            return res.status(400).json({ 
                error: "Cannot swap token for itself" 
            });
        }

        // Validate tokens and recipient address using strict checking
        let validatedTokenIn, validatedTokenOut, validatedRecipient;
        try {
            validatedTokenIn = validateToken(normalizedTokenIn);
            validatedTokenOut = validateToken(normalizedTokenOut);
            validatedRecipient = validateAndFormatAddress(recipient, "Recipient");
        } catch (validationError) {
            return res.status(400).json({ 
                error: `Token validation failed: ${validationError.message}`,
                tokenIn: normalizedTokenIn,
                tokenOut: normalizedTokenOut
            });
        }

        // Validate fee tier
        let validatedFee;
        try {
            validatedFee = validateFee(fee);
        } catch (feeError) {
            return res.status(400).json({ error: feeError.message });
        }

        // Validate input amount
        if (!amountIn || isNaN(amountIn) || parseFloat(amountIn) <= 0) {
            return res.status(400).json({ 
                error: "Valid amountIn is required and must be greater than 0" 
            });
        }

        // Validate slippage tolerance (0.1% to 50%)
        if (slippageTolerance < 0.1 || slippageTolerance > 50) {
            return res.status(400).json({ 
                error: "Slippage tolerance must be between 0.1% and 50%" 
            });
        }

        // Calculate deadline with TTL validation
        let deadline;
        try {
            deadline = calculateDeadline(ttlSec);
        } catch (deadlineError) {
            return res.status(400).json({ error: deadlineError.message });
        }

        // Get token decimals dynamically and convert amount to Wei
        const tokenInDecimals = await getTokenDecimals(validatedTokenIn);
        const amountInWei = ethers.parseUnits(amountIn, tokenInDecimals);

        // Get quote for slippage calculation and protection - ABORT if quote fails
        let expectedAmountOut;
        try {
            const quoteAmountOut = await quoter.quoteExactInputSingle.staticCall(
                validatedTokenIn,
                validatedTokenOut,
                validatedFee,
                amountInWei,
                0
            );
            
            // Reserve sanity check - reject if quote returns 0
            if (quoteAmountOut <= 0n) {
                return res.status(400).json({ 
                    error: "No executable route/liquidity for this pair" 
                });
            }
            
            expectedAmountOut = quoteAmountOut;
        } catch (quoteError) {
            console.error("Quote failed, aborting swap population:", quoteError.message);
            if (quoteError.code === 'BAD_DATA' || /could not decode result data/i.test(quoteError.message)) {
                return res.status(400).json({ 
                    error: "Failed to get quote. Possible causes: unsupported chain configuration, incorrect Quoter address, or no pool/liquidity for the selected fee.",
                    hint: "Verify RPC_URL chain matches FORCE_CHAIN_ID/DEFAULT_CHAIN_ID, and that Uniswap V3 addresses in chains.js are correct for that chain. Try a different fee tier (500/3000/10000)."
                });
            }
            return res.status(400).json({ error: "Failed to get quote for slippage protection. Please try again or contact support if the issue persists." });
        }
        
        // Calculate minimum output amount based on slippage tolerance
        let amountOutMinimum;
        try {
            amountOutMinimum = calcMinOutFromSlippage(expectedAmountOut, slippageTolerance);
        } catch (slippageError) {
            return res.status(400).json({ error: slippageError.message });
        }

        // Get current chain info
        const network = await provider.getNetwork();
        const chainId = network.chainId.toString();

        // Populate the transaction without executing it
        const populatedTx = await uniswapRouter.exactInputSingle.populateTransaction({
            tokenIn: validatedTokenIn,
            tokenOut: validatedTokenOut,
            fee: validatedFee,
            recipient: validatedRecipient,
            deadline: deadline,
            amountIn: amountInWei,
            amountOutMinimum: amountOutMinimum,
            sqrtPriceLimitX96: 0
        });

        // Estimate gas for the swap transaction
        let gasEstimate;
        try {
            gasEstimate = await uniswapRouter.exactInputSingle.estimateGas({
                tokenIn: validatedTokenIn,
                tokenOut: validatedTokenOut,
                fee: validatedFee,
                recipient: validatedRecipient,
                deadline: deadline,
                amountIn: amountInWei,
                amountOutMinimum: amountOutMinimum,
                sqrtPriceLimitX96: 0
            });
        } catch (gasError) {
            console.warn("Gas estimation failed, using default:", gasError.message);
            gasEstimate = 300000n; // Default gas limit
        }

        // Return the populated transaction for the user to sign
        const response = {
            success: true,
            chainId: chainId,
            populatedTransaction: {
                ...populatedTx,
                gasLimit: Math.floor(Number(gasEstimate) * 1.2) // 20% gas buffer for safety
            },
            swapDetails: {
                tokenIn: validatedTokenIn,
                tokenOut: validatedTokenOut,
                amountIn: amountIn,
                amountInWei: amountInWei.toString(),
                expectedAmountOut: ethers.formatUnits(expectedAmountOut, await getTokenDecimals(validatedTokenOut)),
                amountOutMinimum: ethers.formatUnits(amountOutMinimum, await getTokenDecimals(validatedTokenOut)),
                recipient: validatedRecipient,
                fee: validatedFee,
                slippageTolerance: slippageTolerance,
                deadline: deadline,
                ttlSec: ttlSec,
                estimatedGas: gasEstimate.toString(),
                mode: 'EXACT_IN'
            },
            instructions: "Sign this transaction in your wallet to execute the swap. The transaction will revert if slippage tolerance is exceeded."
        };
        
        // Serialize any BigInt values before sending response
        const serializedResponse = serializeBigInts(response);
        res.json(serializedResponse);
    } catch (err) {
        console.error("Swap population error:", err);
        
        // Handle specific Uniswap errors with user-friendly messages
        if (err.message.includes("INSUFFICIENT_LIQUIDITY")) {
            return res.status(400).json({ error: "Insufficient liquidity for this swap" });
        }
        if (err.message.includes("EXCESSIVE_INPUT_AMOUNT")) {
            return res.status(400).json({ error: "Input amount too high for available liquidity" });
        }
        
        res.status(500).json({ error: err.message });
    }
});

/**
 * NON-CUSTODIAL EXACT-OUT SWAP ENDPOINT
 * Returns a populated transaction for exact-out swaps for the user to sign in their wallet
 */
router.post("/swap/populate/exact-out", ensureBlockchainInitialized, async (req, res) => {
    try {
        const { tokenIn, tokenOut, amountOut, recipient, slippageTolerance = 0.5, fee = 3000, ttlSec = 600 } = req.body;

        // Use default token addresses from environment variables if not provided
        const tokenInAddress = tokenIn || config.WETH_ADDRESS;
        const tokenOutAddress = tokenOut || config.WMATIC_ADDRESS || config.USDC_ADDRESS;

        // Validate that we have token addresses
        if (!tokenInAddress || !tokenOutAddress) {
            return res.status(400).json({ 
                error: "Token addresses are required. Either provide them in the request body or set WETH_ADDRESS and WMATIC_ADDRESS in your .env file" 
            });
        }

        // Normalize addresses upfront
        const normalizedTokenIn = ethers.getAddress(tokenInAddress);
        const normalizedTokenOut = ethers.getAddress(tokenOutAddress);

        // Guard against same token swap
        if (normalizedTokenIn.toLowerCase() === normalizedTokenOut.toLowerCase()) {
            return res.status(400).json({ 
                error: "Cannot swap token for itself" 
            });
        }

        // Validate tokens and recipient address using strict checking
        let validatedTokenIn, validatedTokenOut, validatedRecipient;
        try {
            validatedTokenIn = validateToken(normalizedTokenIn);
            validatedTokenOut = validateToken(normalizedTokenOut);
            validatedRecipient = validateAndFormatAddress(recipient, "Recipient");
        } catch (validationError) {
            return res.status(400).json({ 
                error: `Token validation failed: ${validationError.message}`,
                tokenIn: normalizedTokenIn,
                tokenOut: normalizedTokenOut
            });
        }

        // Validate fee tier
        let validatedFee;
        try {
            validatedFee = validateFee(fee);
        } catch (feeError) {
            return res.status(400).json({ error: feeError.message });
        }

        // Validate output amount
        if (!amountOut || isNaN(amountOut) || parseFloat(amountOut) <= 0) {
            return res.status(400).json({ 
                error: "Valid amountOut is required and must be greater than 0" 
            });
        }

        // Validate slippage tolerance (0.1% to 50%)
        if (slippageTolerance < 0.1 || slippageTolerance > 50) {
            return res.status(400).json({ 
                error: "Slippage tolerance must be between 0.1% and 50%" 
            });
        }

        // Calculate deadline with TTL validation
        let deadline;
        try {
            deadline = calculateDeadline(ttlSec);
        } catch (deadlineError) {
            return res.status(400).json({ error: deadlineError.message });
        }

        // Get token decimals and convert amount to Wei
        const tokenOutDecimals = await getTokenDecimals(validatedTokenOut);
        const amountOutWei = ethers.parseUnits(amountOut, tokenOutDecimals);

        // Get quote for exact-output to calculate required input amount
        let requiredAmountIn;
        try {
            const quoteAmountIn = await quoter.quoteExactOutputSingle.staticCall(
                validatedTokenIn,
                validatedTokenOut,
                validatedFee,
                amountOutWei,
                0
            );
            
            // Reserve sanity check - reject if quote returns 0
            if (quoteAmountIn <= 0n) {
                return res.status(400).json({ 
                    error: "No executable route/liquidity for this pair" 
                });
            }
            
            requiredAmountIn = quoteAmountIn;
        } catch (quoteError) {
            console.error("Quote failed, aborting swap population:", quoteError.message);
            if (quoteError.code === 'BAD_DATA' || /could not decode result data/i.test(quoteError.message)) {
                return res.status(400).json({ 
                    error: "Failed to get quote. Possible causes: unsupported chain configuration, incorrect Quoter address, or no pool/liquidity for the selected fee.",
                    hint: "Verify RPC_URL chain matches FORCE_CHAIN_ID/DEFAULT_CHAIN_ID, and that Uniswap V3 addresses in chains.js are correct for that chain. Try a different fee tier (500/3000/10000)."
                });
            }
            return res.status(400).json({ error: "Failed to get quote for exact-out swap. Please try again or contact support if the issue persists." });
        }
        
        // Calculate maximum input amount based on slippage tolerance
        let amountInMaximum;
        try {
            const bps = Math.round(Number(slippageTolerance) * 100);
            const DENOM = 10_000n;
            amountInMaximum = (BigInt(requiredAmountIn) * (DENOM + BigInt(bps))) / DENOM;
        } catch (slippageError) {
            return res.status(400).json({ error: "Invalid slippage tolerance" });
        }

        // Get current chain info
        const network = await provider.getNetwork();
        const chainId = network.chainId.toString();

        // Populate the exact-output transaction without executing it
        const populatedTx = await uniswapRouter.exactOutputSingle.populateTransaction({
            tokenIn: validatedTokenIn,
            tokenOut: validatedTokenOut,
            fee: validatedFee,
            recipient: validatedRecipient,
            deadline: deadline,
            amountOut: amountOutWei,
            amountInMaximum: amountInMaximum,
            sqrtPriceLimitX96: 0
        });

        // Estimate gas for the exact-output swap transaction
        let gasEstimate;
        try {
            gasEstimate = await uniswapRouter.exactOutputSingle.estimateGas({
                tokenIn: validatedTokenIn,
                tokenOut: validatedTokenOut,
                fee: validatedFee,
                recipient: validatedRecipient,
                deadline: deadline,
                amountOut: amountOutWei,
                amountInMaximum: amountInMaximum,
                sqrtPriceLimitX96: 0
            });
        } catch (gasError) {
            console.warn("Gas estimation failed, using default:", gasError.message);
            gasEstimate = 300000n; // Default gas limit
        }

        // Get token in decimals for proper formatting
        const tokenInDecimals = await getTokenDecimals(validatedTokenIn);

        // Return the populated transaction for the user to sign
        const response = {
            success: true,
            chainId: chainId,
            populatedTransaction: {
                ...populatedTx,
                gasLimit: Math.floor(Number(gasEstimate) * 1.2) // 20% gas buffer for safety
            },
            swapDetails: {
                tokenIn: validatedTokenIn,
                tokenOut: validatedTokenOut,
                amountIn: ethers.formatUnits(requiredAmountIn, tokenInDecimals),
                amountInWei: requiredAmountIn.toString(),
                amountOut: amountOut,
                amountOutMinimum: amountOut,
                recipient: validatedRecipient,
                fee: validatedFee,
                slippageTolerance: slippageTolerance,
                deadline: deadline,
                ttlSec: ttlSec,
                estimatedGas: gasEstimate.toString(),
                mode: 'EXACT_OUT'
            },
            instructions: "Sign this transaction in your wallet to execute the exact-out swap. The transaction will revert if slippage tolerance is exceeded."
        };
        
        // Serialize any BigInt values before sending response
        const serializedResponse = serializeBigInts(response);
        res.json(serializedResponse);
    } catch (err) {
        console.error("Exact-out swap population error:", err);
        
        // Handle specific Uniswap errors with user-friendly messages
        if (err.message.includes("INSUFFICIENT_LIQUIDITY")) {
            return res.status(400).json({ error: "Insufficient liquidity for this swap" });
        }
        
        res.status(500).json({ error: err.message });
    }
});

/**
 * NON-CUSTODIAL EXACT-OUT SWAP ENDPOINT
 * Returns a populated transaction for exact-out swaps for the user to sign in their wallet
 */
router.post("/swap/populate/exact-out", ensureBlockchainInitialized, async (req, res) => {
    try {
        const { tokenIn, tokenOut, amountOut, recipient, slippageTolerance = 0.5, fee = 3000, ttlSec = 600 } = req.body;

        // Use default token addresses from environment variables if not provided
        const tokenInAddress = tokenIn || config.WETH_ADDRESS;
        const tokenOutAddress = tokenOut || config.WMATIC_ADDRESS || config.USDC_ADDRESS;

        // Validate that we have token addresses
        if (!tokenInAddress || !tokenOutAddress) {
            return res.status(400).json({ 
                error: "Token addresses are required. Either provide them in the request body or set WETH_ADDRESS and WMATIC_ADDRESS in your .env file" 
            });
        }

        // Normalize addresses upfront
        const normalizedTokenIn = ethers.getAddress(tokenInAddress);
        const normalizedTokenOut = ethers.getAddress(tokenOutAddress);

        // Guard against same token swap
        if (normalizedTokenIn.toLowerCase() === normalizedTokenOut.toLowerCase()) {
            return res.status(400).json({ 
                error: "Cannot swap token for itself" 
            });
        }

        // Validate tokens and recipient address using strict checking
        let validatedTokenIn, validatedTokenOut, validatedRecipient;
        try {
            validatedTokenIn = validateToken(normalizedTokenIn);
            validatedTokenOut = validateToken(normalizedTokenOut);
            validatedRecipient = validateAndFormatAddress(recipient, "Recipient");
        } catch (validationError) {
            return res.status(400).json({ 
                error: `Token validation failed: ${validationError.message}`,
                tokenIn: normalizedTokenIn,
                tokenOut: normalizedTokenOut
            });
        }

        // Validate fee tier
        let validatedFee;
        try {
            validatedFee = validateFee(fee);
        } catch (feeError) {
            return res.status(400).json({ error: feeError.message });
        }

        // Validate output amount
        if (!amountOut || isNaN(amountOut) || parseFloat(amountOut) <= 0) {
            return res.status(400).json({ 
                error: "Valid amountOut is required and must be greater than 0" 
            });
        }

        // Validate slippage tolerance (0.1% to 50%)
        if (slippageTolerance < 0.1 || slippageTolerance > 50) {
            return res.status(400).json({ 
                error: "Slippage tolerance must be between 0.1% and 50%" 
            });
        }

        // Calculate deadline with TTL validation
        let deadline;
        try {
            deadline = calculateDeadline(ttlSec);
        } catch (deadlineError) {
            return res.status(400).json({ error: deadlineError.message });
        }

        // Get token decimals and convert amount to Wei
        const tokenOutDecimals = await getTokenDecimals(validatedTokenOut);
        const amountOutWei = ethers.parseUnits(amountOut, tokenOutDecimals);

        // Get quote for exact-output to calculate required input amount
        let requiredAmountIn;
        try {
            const quoteAmountIn = await quoter.quoteExactOutputSingle.staticCall(
                validatedTokenIn,
                validatedTokenOut,
                validatedFee,
                amountOutWei,
                0
            );
            
            // Reserve sanity check - reject if quote returns 0
            if (quoteAmountIn <= 0n) {
                return res.status(400).json({ 
                    error: "No executable route/liquidity for this pair" 
                });
            }
            
            requiredAmountIn = quoteAmountIn;
        } catch (quoteError) {
            console.error("Quote failed, aborting swap population:", quoteError.message);
            if (quoteError.code === 'BAD_DATA' || /could not decode result data/i.test(quoteError.message)) {
                return res.status(400).json({ 
                    error: "Failed to get quote. Possible causes: unsupported chain configuration, incorrect Quoter address, or no pool/liquidity for the selected fee.",
                    hint: "Verify RPC_URL chain matches FORCE_CHAIN_ID/DEFAULT_CHAIN_ID, and that Uniswap V3 addresses in chains.js are correct for that chain. Try a different fee tier (500/3000/10000)."
                });
            }
            return res.status(400).json({ error: "Failed to get quote for exact-out swap. Please try again or contact support if the issue persists." });
        }
        
        // Calculate maximum input amount based on slippage tolerance
        let amountInMaximum;
        try {
            const bps = Math.round(Number(slippageTolerance) * 100);
            const DENOM = 10_000n;
            amountInMaximum = (BigInt(requiredAmountIn) * (DENOM + BigInt(bps))) / DENOM;
        } catch (slippageError) {
            return res.status(400).json({ error: "Invalid slippage tolerance" });
        }

        // Get current chain info
        const network = await provider.getNetwork();
        const chainId = network.chainId.toString();

        // Populate the exact-output transaction without executing it
        const populatedTx = await uniswapRouter.exactOutputSingle.populateTransaction({
            tokenIn: validatedTokenIn,
            tokenOut: validatedTokenOut,
            fee: validatedFee,
            recipient: validatedRecipient,
            deadline: deadline,
            amountOut: amountOutWei,
            amountInMaximum: amountInMaximum,
            sqrtPriceLimitX96: 0
        });

        // Estimate gas for the exact-output swap transaction
        let gasEstimate;
        try {
            gasEstimate = await uniswapRouter.exactOutputSingle.estimateGas({
                tokenIn: validatedTokenIn,
                tokenOut: validatedTokenOut,
                fee: validatedFee,
                recipient: validatedRecipient,
                deadline: deadline,
                amountOut: amountOutWei,
                amountInMaximum: amountInMaximum,
                sqrtPriceLimitX96: 0
            });
        } catch (gasError) {
            console.warn("Gas estimation failed, using default:", gasError.message);
            gasEstimate = 300000n; // Default gas limit
        }

        // Get token in decimals for proper formatting
        const tokenInDecimals = await getTokenDecimals(validatedTokenIn);

        // Return the populated transaction for the user to sign
        const response = {
            success: true,
            chainId: chainId,
            populatedTransaction: {
                ...populatedTx,
                gasLimit: Math.floor(Number(gasEstimate) * 1.2) // 20% gas buffer for safety
            },
            swapDetails: {
                tokenIn: validatedTokenIn,
                tokenOut: validatedTokenOut,
                amountIn: ethers.formatUnits(requiredAmountIn, tokenInDecimals),
                amountInWei: requiredAmountIn.toString(),
                amountOut: amountOut,
                amountOutMinimum: amountOut,
                recipient: validatedRecipient,
                fee: validatedFee,
                slippageTolerance: slippageTolerance,
                deadline: deadline,
                ttlSec: ttlSec,
                estimatedGas: gasEstimate.toString(),
                mode: 'EXACT_OUT'
            },
            instructions: "Sign this transaction in your wallet to execute the exact-out swap. The transaction will revert if slippage tolerance is exceeded."
        };
        
        // Serialize any BigInt values before sending response
        const serializedResponse = serializeBigInts(response);
        res.json(serializedResponse);
    } catch (err) {
        console.error("Exact-out swap population error:", err);
        
        // Handle specific Uniswap errors with user-friendly messages
        if (err.message.includes("INSUFFICIENT_LIQUIDITY")) {
            return res.status(400).json({ error: "Insufficient liquidity for this swap" });
        }
        
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET SUPPORTED TOKENS ENDPOINT
 * Returns information about all supported tokens including name, symbol, and decimals
 * Useful for populating token selection dropdowns in the frontend
 */
router.get("/tokens", ensureBlockchainInitialized, async (req, res) => {
    try {
        const { getAllowedTokens } = await import("../services/tokenValidation.js");
        const allowedTokens = getAllowedTokens();
        
        const tokenInfo = [];
        
        // Fetch detailed information for each supported token
        for (const tokenAddress of allowedTokens) {
            try {
                const tokenContract = new ethers.Contract(tokenAddress, [
                    "function name() view returns (string)",
                    "function symbol() view returns (string)",
                    "function decimals() view returns (uint8)"
                ], provider);
                
                const [name, symbol, decimals] = await Promise.all([
                    tokenContract.name(),
                    tokenContract.symbol(),
                    tokenContract.decimals()
                ]);
                
                tokenInfo.push({
                    address: tokenAddress,
                    name: name,
                    symbol: symbol,
                    decimals: decimals
                });
            } catch (error) {
                console.warn(`Failed to get info for token ${tokenAddress}:`, error.message);
                // Add basic info if contract calls fail
                tokenInfo.push({
                    address: tokenAddress,
                    name: "Unknown",
                    symbol: "UNKNOWN",
                    decimals: 18
                });
            }
        }
        
        // Get current chain info
        const network = await provider.getNetwork();
        const chainId = network.chainId.toString();
        
        const response = {
            success: true,
            chainId: chainId,
            tokens: tokenInfo
        };
        
        // Serialize any BigInt values before sending response
        const serializedResponse = serializeBigInts(response);
        res.json(serializedResponse);
    } catch (err) {
        console.error("Get tokens error:", err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET TOKEN BALANCE ENDPOINT
 * Returns the balance of a specific token for a given user address
 * Useful for checking user balances before swaps
 */
router.get("/balance/:tokenAddress/:userAddress", ensureBlockchainInitialized, async (req, res) => {
    try {
        const { tokenAddress, userAddress } = req.params;
        
        // Validate both token and user addresses
        const validatedTokenAddress = validateToken(tokenAddress);
        const validatedUserAddress = validateAndFormatAddress(userAddress, "User");
        
        // Create token contract instance to query balance and decimals
        const tokenContract = new ethers.Contract(validatedTokenAddress, [
            "function balanceOf(address owner) view returns (uint256)",
            "function decimals() view returns (uint8)"
        ], provider);
        
        // Fetch balance and decimals simultaneously
        const [balance, decimals] = await Promise.all([
            tokenContract.balanceOf(validatedUserAddress),
            tokenContract.decimals()
        ]);
        
        // Format balance with proper decimal places
        const formattedBalance = ethers.formatUnits(balance, decimals);
        
        // Get current chain info
        const network = await provider.getNetwork();
        const chainId = network.chainId.toString();
        
        const response = {
            success: true,
            chainId: chainId,
            tokenAddress: validatedTokenAddress,
            userAddress: validatedUserAddress,
            balance: formattedBalance,
            balanceWei: balance.toString(),
            decimals: decimals
        };
        
        // Serialize any BigInt values before sending response
        const serializedResponse = serializeBigInts(response);
        res.json(serializedResponse);
    } catch (err) {
        console.error("Get balance error:", err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET CHAIN INFO ENDPOINT
 * Returns information about the current connected blockchain network
 * Useful for frontend to display current network and supported features
 */
router.get("/chain-info", ensureBlockchainInitialized, async (req, res) => {
    try {
        const network = await provider.getNetwork();
        const chainId = network.chainId.toString();
        const chainName = network.name;
        
        // Get supported chain IDs for comparison
        const { getSupportedChainIds, isChainSupported } = await import("../config/chains.js");
        const supportedChains = getSupportedChainIds();
        const isSupported = isChainSupported(chainId);
        
        const response = {
            success: true,
            currentChain: {
                chainId: chainId,
                name: chainName,
                isSupported: isSupported
            },
            supportedChains: supportedChains,
            rpcUrl: config.RPC_URL.replace(/\/\/[^\/]+@/, '//***@') // Hide credentials in response
        };
        
        // Serialize any BigInt values before sending response
        const serializedResponse = serializeBigInts(response);
        res.json(serializedResponse);
    } catch (err) {
        console.error("Get chain info error:", err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET OPERATIONAL STATUS ENDPOINT
 * Returns current operational status and limits for custodial swaps
 * Useful for frontend to check if swaps are enabled and what limits apply
 */
router.get("/operational-status", ensureBlockchainInitialized, async (req, res) => {
    try {
        const status = getOperationalStatus();
        
        // Get current chain info
        const network = await provider.getNetwork();
        const chainId = network.chainId.toString();
        
        const response = {
            success: true,
            chainId: chainId,
            operationalStatus: status
        };
        
        // Serialize any BigInt values before sending response
        const serializedResponse = serializeBigInts(response);
        res.json(serializedResponse);
    } catch (err) {
        console.error("Get operational status error:", err);
        res.status(500).json({ error: err.message });
    }
});

export default router;

/**
 * Liquidity Router - Handles liquidity provision functionality using Uniswap V3
 * Provides endpoints for adding liquidity to Uniswap V3 pools
 */

import express from "express";
import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import config from "../config/env.js";
import { getUniswapAddresses } from "../config/chains.js";
import { validateToken } from "../services/tokenValidation.js";

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read Uniswap V3 Position Manager ABI for liquidity operations
const positionManagerABI = JSON.parse(fs.readFileSync(path.join(__dirname, "../../node_modules/@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json"), 'utf8'));

const router = express.Router();

// Initialize Ethereum provider and wallet for blockchain interactions
let provider, wallet, positionManager;

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
            positionManager: uniswapAddresses.positionManager
        });
        
        // Initialize Uniswap V3 Position Manager contract for liquidity operations
        positionManager = new ethers.Contract(uniswapAddresses.positionManager, positionManagerABI.abi, wallet);
        
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
    if (!provider || !wallet || !positionManager) {
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
 * ADD LIQUIDITY ENDPOINT
 * Creates a new liquidity position in a Uniswap V3 pool
 * Mints an NFT representing the liquidity position
 * 
 * @param {string} token0 - First token address in the pair
 * @param {string} token1 - Second token address in the pair  
 * @param {string} amount0 - Amount of first token to provide
 * @param {string} amount1 - Amount of second token to provide
 * @param {string} recipient - Address that will receive the position NFT
 */
router.post("/add-liquidity", ensureBlockchainInitialized, async (req, res) => {
    try {
        const { token0, token1, amount0, amount1, recipient } = req.body;

        // Validate both token addresses using the token validation service
        const validatedToken0 = validateToken(token0);
        const validatedToken1 = validateToken(token1);

        // Execute the liquidity provision transaction
        // This creates a new NFT position representing the liquidity
        const tx = await positionManager.mint({
            token0: validatedToken0,           // First token in the pair
            token1: validatedToken1,           // Second token in the pair
            fee: 3000,                         // 0.3% fee tier (standard for most pairs)
            tickLower: -60000,                 // Lower tick boundary for price range
            tickUpper: 60000,                  // Upper tick boundary for price range
            amount0Desired: ethers.parseUnits(amount0, 18),  // Desired amount of token0
            amount1Desired: ethers.parseUnits(amount1, 18),  // Desired amount of token1
            amount0Min: 0,                     // Minimum amount of token0 to accept
            amount1Min: 0,                     // Minimum amount of token1 to accept
            recipient,                         // Address receiving the position NFT
            deadline: Math.floor(Date.now() / 1000) + 60 * 10  // 10 minutes from now
        });

        // Wait for transaction confirmation on the blockchain
        await tx.wait();
        
        // Return success response with transaction hash
        res.json({ success: true, txHash: tx.hash });
    } catch (err) {
        // Handle any errors during liquidity provision
        res.status(500).json({ error: err.message });
    }
});

export default router;

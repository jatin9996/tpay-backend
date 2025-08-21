/**
 * Liquidity Router - Handles liquidity provision functionality using Uniswap V3
 * Provides endpoints for adding liquidity to Uniswap V3 pools
 */

import express from "express";
import { ethers } from "ethers";
// Import Uniswap V3 Position Manager ABI for liquidity operations
import positionManagerABI from "@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json" assert { type: "json" };
import config from "../config/env.js";
import { validateToken } from "../services/tokenValidation.js";

const router = express.Router();

// Initialize Ethereum provider and wallet for blockchain interactions
const provider = new ethers.JsonRpcProvider(config.RPC_URL);
const wallet = new ethers.Wallet(config.PRIVATE_KEY, provider);
// Initialize Uniswap V3 Position Manager contract for liquidity operations
const positionManager = new ethers.Contract(config.POSITION_MANAGER_ADDRESS, positionManagerABI.abi, wallet);

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
router.post("/add-liquidity", async (req, res) => {
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

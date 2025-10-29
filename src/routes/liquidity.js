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
import { OPERATIONAL_LIMITS } from "../config/operationalLimits.js";
import axios from "axios";

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read Uniswap V3 Position Manager ABI for liquidity operations
const positionManagerABI = JSON.parse(fs.readFileSync(path.join(__dirname, "../../node_modules/@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json"), 'utf8'));

const router = express.Router();

// Initialize Ethereum provider and wallet for blockchain interactions
let provider, wallet, positionManager;

// Minimal ERC20 ABI for approvals and metadata
const ERC20_ABI = [
    "function approve(address spender, uint256 value) external returns (bool)",
    "function allowance(address owner, address spender) external view returns (uint256)",
    "function decimals() external view returns (uint8)",
];

/**
 * Helpers
 */
async function getTokenDecimals(tokenAddress) {
    const token = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
    const decimals = await token.decimals();
    return Number(decimals);
}

async function ensureAllowance(tokenAddress, owner, spender, requiredAmount) {
    const token = new ethers.Contract(tokenAddress, ERC20_ABI, wallet);
    const current = await token.allowance(owner, spender);
    if (current < requiredAmount) {
        const tx = await token.approve(spender, requiredAmount);
        await tx.wait();
    }
}

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
        const { token0, token1, amount0, amount1, recipient, fee, tickLower, tickUpper, amount0Min, amount1Min, ttlSec } = req.body;

        // Validate both token addresses using the token validation service
        const validatedToken0 = validateToken(token0);
        const validatedToken1 = validateToken(token1);

        // Validate fee tier
        const feeTier = Number(fee ?? 3000);
        if (!OPERATIONAL_LIMITS.ALLOWED_FEES.includes(feeTier)) {
            return res.status(400).json({ error: `Invalid fee tier. Allowed: ${OPERATIONAL_LIMITS.ALLOWED_FEES.join(', ')}` });
        }

        // Ticks (optional, default wide range)
        const lower = Number.isFinite(Number(tickLower)) ? Number(tickLower) : -60000;
        const upper = Number.isFinite(Number(tickUpper)) ? Number(tickUpper) : 60000;
        if (lower >= upper) {
            return res.status(400).json({ error: "tickLower must be less than tickUpper" });
        }

        // Deadlines
        const ttl = Number.isFinite(Number(ttlSec)) ? Number(ttlSec) : OPERATIONAL_LIMITS.DEADLINE_LIMITS.DEFAULT_TTL;
        const deadline = Math.floor(Date.now() / 1000) + Math.min(Math.max(ttl, OPERATIONAL_LIMITS.DEADLINE_LIMITS.MIN_TTL), OPERATIONAL_LIMITS.DEADLINE_LIMITS.MAX_TTL);

        // Resolve decimals and parse amounts
        const [dec0, dec1] = await Promise.all([
            getTokenDecimals(validatedToken0),
            getTokenDecimals(validatedToken1)
        ]);
        const amt0Desired = ethers.parseUnits(String(amount0), dec0);
        const amt1Desired = ethers.parseUnits(String(amount1), dec1);
        const amt0Min = amount0Min != null ? ethers.parseUnits(String(amount0Min), dec0) : 0n;
        const amt1Min = amount1Min != null ? ethers.parseUnits(String(amount1Min), dec1) : 0n;

        // Approvals
        await ensureAllowance(validatedToken0, wallet.address, positionManager.target, amt0Desired);
        await ensureAllowance(validatedToken1, wallet.address, positionManager.target, amt1Desired);

        // Execute the liquidity provision transaction
        // This creates a new NFT position representing the liquidity
        const tx = await positionManager.mint({
            token0: validatedToken0,
            token1: validatedToken1,
            fee: feeTier,
            tickLower: lower,
            tickUpper: upper,
            amount0Desired: amt0Desired,
            amount1Desired: amt1Desired,
            amount0Min: amt0Min,
            amount1Min: amt1Min,
            recipient,
            deadline
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

/**
 * INCREASE LIQUIDITY ENDPOINT
 */
router.post("/increase-liquidity", ensureBlockchainInitialized, async (req, res) => {
    try {
        const { tokenId, token0, token1, amount0, amount1, amount0Min, amount1Min, ttlSec } = req.body;
        if (!tokenId) return res.status(400).json({ error: "tokenId is required" });

        const validatedToken0 = validateToken(token0);
        const validatedToken1 = validateToken(token1);

        const ttl = Number.isFinite(Number(ttlSec)) ? Number(ttlSec) : OPERATIONAL_LIMITS.DEADLINE_LIMITS.DEFAULT_TTL;
        const deadline = Math.floor(Date.now() / 1000) + Math.min(Math.max(ttl, OPERATIONAL_LIMITS.DEADLINE_LIMITS.MIN_TTL), OPERATIONAL_LIMITS.DEADLINE_LIMITS.MAX_TTL);

        const [dec0, dec1] = await Promise.all([
            getTokenDecimals(validatedToken0),
            getTokenDecimals(validatedToken1)
        ]);
        const amt0Desired = ethers.parseUnits(String(amount0 ?? 0), dec0);
        const amt1Desired = ethers.parseUnits(String(amount1 ?? 0), dec1);
        const amt0Min = amount0Min != null ? ethers.parseUnits(String(amount0Min), dec0) : 0n;
        const amt1Min = amount1Min != null ? ethers.parseUnits(String(amount1Min), dec1) : 0n;

        await ensureAllowance(validatedToken0, wallet.address, positionManager.target, amt0Desired);
        await ensureAllowance(validatedToken1, wallet.address, positionManager.target, amt1Desired);

        const tx = await positionManager.increaseLiquidity({
            tokenId: BigInt(tokenId),
            amount0Desired: amt0Desired,
            amount1Desired: amt1Desired,
            amount0Min: amt0Min,
            amount1Min: amt1Min,
            deadline
        });
        await tx.wait();
        res.json({ success: true, txHash: tx.hash });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * COLLECT FEES ENDPOINT
 */
router.post("/collect", ensureBlockchainInitialized, async (req, res) => {
    try {
        const { tokenId, recipient } = req.body;
        if (!tokenId) return res.status(400).json({ error: "tokenId is required" });

        // Max uint128 for collect
        const MAX_UINT128 = (1n << 128n) - 1n;
        const tx = await positionManager.collect({
            tokenId: BigInt(tokenId),
            recipient: recipient || wallet.address,
            amount0Max: MAX_UINT128,
            amount1Max: MAX_UINT128
        });
        await tx.wait();
        res.json({ success: true, txHash: tx.hash });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * REMOVE LIQUIDITY ENDPOINT (decrease + optional collect and burn)
 */
router.post("/remove-liquidity", ensureBlockchainInitialized, async (req, res) => {
    try {
        const { tokenId, liquidity, amount0Min, amount1Min, ttlSec, collect = true, burn = false, recipient } = req.body;
        if (!tokenId) return res.status(400).json({ error: "tokenId is required" });
        if (liquidity == null) return res.status(400).json({ error: "liquidity is required" });

        const ttl = Number.isFinite(Number(ttlSec)) ? Number(ttlSec) : OPERATIONAL_LIMITS.DEADLINE_LIMITS.DEFAULT_TTL;
        const deadline = Math.floor(Date.now() / 1000) + Math.min(Math.max(ttl, OPERATIONAL_LIMITS.DEADLINE_LIMITS.MIN_TTL), OPERATIONAL_LIMITS.DEADLINE_LIMITS.MAX_TTL);

        const tx1 = await positionManager.decreaseLiquidity({
            tokenId: BigInt(tokenId),
            liquidity: BigInt(liquidity),
            amount0Min: BigInt(amount0Min ?? 0),
            amount1Min: BigInt(amount1Min ?? 0),
            deadline
        });
        await tx1.wait();

        let collectTxHash = null;
        if (collect) {
            const MAX_UINT128 = (1n << 128n) - 1n;
            const tx2 = await positionManager.collect({
                tokenId: BigInt(tokenId),
                recipient: recipient || wallet.address,
                amount0Max: MAX_UINT128,
                amount1Max: MAX_UINT128
            });
            await tx2.wait();
            collectTxHash = tx2.hash;
        }

        if (burn) {
            const tx3 = await positionManager.burn(BigInt(tokenId));
            await tx3.wait();
        }

        res.json({ success: true, txHash: tx1.hash, collectTxHash });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET USER POSITIONS (read-only via The Graph)
 * Returns basic LP positions for a wallet on Uniswap V3
 * Query: owner, chainId(optional)
 */
router.get("/positions", async (req, res) => {
    try {
        const { owner, chainId } = req.query;
        if (!owner) return res.status(400).json({ success: false, error: "owner is required" });

        // Currently we target the canonical Uniswap V3 subgraph on main chains
        // For testnets, data may be sparse. Frontend should handle empty results.
        const GRAPH_URL = "https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3";

        const query = `{
          positions(where: { owner: "${owner.toLowerCase()}" }, first: 50, orderBy: liquidity, orderDirection: desc) {
            id
            liquidity
            depositedToken0
            depositedToken1
            collectedFeesToken0
            collectedFeesToken1
            token0 { id symbol decimals }
            token1 { id symbol decimals }
            pool { id feeTier }
          }
        }`;

        const result = await axios.post(GRAPH_URL, { query });
        const positions = result.data?.data?.positions || [];

        const formatted = positions.map(p => ({
            id: p.id,
            poolId: p.pool?.id,
            feeTier: p.pool?.feeTier,
            token0: p.token0,
            token1: p.token1,
            liquidity: p.liquidity,
            deposited: {
                token0: p.depositedToken0,
                token1: p.depositedToken1
            },
            collectedFees: {
                token0: p.collectedFeesToken0,
                token1: p.collectedFeesToken1
            }
        }));

        res.json({ success: true, owner, chainId: chainId ? Number(chainId) : undefined, positions: formatted });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

export default router;

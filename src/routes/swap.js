import express from "express";
import { ethers } from "ethers";
import routerABI from "@uniswap/v3-periphery/artifacts/contracts/SwapRouter.sol/SwapRouter.json" assert { type: "json" };
import config from "../config/env.js";
import { validateToken } from "../services/tokenValidation.js";

const router = express.Router();

const provider = new ethers.JsonRpcProvider(config.RPC_URL);
const wallet = new ethers.Wallet(config.PRIVATE_KEY, provider);
const uniswapRouter = new ethers.Contract(config.ROUTER_ADDRESS, routerABI.abi, wallet);

// Helper function to validate and format Ethereum addresses
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

router.post("/swap", async (req, res) => {
    try {
        const { tokenIn, tokenOut, amountIn, recipient } = req.body;

        // Use default token addresses from environment variables if not provided
        const tokenInAddress = tokenIn || config.WETH_ADDRESS;
        const tokenOutAddress = tokenOut || config.WMATIC_ADDRESS;

        // Validate that we have token addresses
        if (!tokenInAddress || !tokenOutAddress) {
            return res.status(400).json({ 
                error: "Token addresses are required. Either provide them in the request body or set WETH_ADDRESS and POL_ADDRESS in your .env file" 
            });
        }

        // Validate tokens using strict checking
        let validatedTokenIn, validatedTokenOut, validatedRecipient;
        try {
            validatedTokenIn = validateToken(tokenInAddress);
            validatedTokenOut = validateToken(tokenOutAddress);
            validatedRecipient = validateAndFormatAddress(recipient, "Recipient");
        } catch (validationError) {
            return res.status(400).json({ 
                error: `Token validation failed: ${validationError.message}`,
                tokenIn: tokenInAddress,
                tokenOut: tokenOutAddress
            });
        }

        // Validate amount
        if (!amountIn || isNaN(amountIn) || parseFloat(amountIn) <= 0) {
            return res.status(400).json({ 
                error: "Valid amountIn is required and must be greater than 0" 
            });
        }

        // Approve token first (frontend step usually)
        // Call exactInputSingle or exactInput for multi-hop swaps
        const tx = await uniswapRouter.exactInputSingle({
            tokenIn: validatedTokenIn,
            tokenOut: validatedTokenOut,
            fee: 3000,
            recipient: validatedRecipient,
            deadline: Math.floor(Date.now() / 1000) + 60 * 10,
            amountIn: ethers.parseUnits(amountIn, 18),
            amountOutMinimum: 0,
            sqrtPriceLimitX96: 0
        });

        await tx.wait();
        res.json({ 
            success: true, 
            txHash: tx.hash,
            tokenIn: validatedTokenIn,
            tokenOut: validatedTokenOut,
            recipient: validatedRecipient
        });
    } catch (err) {
        console.error("Swap error:", err);
        res.status(500).json({ error: err.message });
    }
});

export default router;

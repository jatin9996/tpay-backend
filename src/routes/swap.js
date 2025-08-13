import express from "express";
import { ethers } from "ethers";
import routerABI from "@uniswap/v3-periphery/artifacts/contracts/SwapRouter.sol/SwapRouter.json" assert { type: "json" };
import quoterABI from "@uniswap/v3-periphery/artifacts/contracts/Quoter.sol/Quoter.json" assert { type: "json" };
import config from "../config/env.js";
import { validateToken } from "../services/tokenValidation.js";

const router = express.Router();

const provider = new ethers.JsonRpcProvider(config.RPC_URL);
const wallet = new ethers.Wallet(config.PRIVATE_KEY, provider);
const uniswapRouter = new ethers.Contract(config.ROUTER_ADDRESS, routerABI.abi, wallet);

// Initialize Quoter contract for price quotes
const quoterAddress = "0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6"; // Uniswap V3 Quoter
const quoter = new ethers.Contract(quoterAddress, quoterABI.abi, provider);

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

// Helper function to get token decimals
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

// Helper function to check and handle token approval
async function ensureTokenApproval(tokenAddress, ownerAddress, spenderAddress, amount) {
    try {
        const tokenContract = new ethers.Contract(tokenAddress, [
            "function allowance(address owner, address spender) view returns (uint256)",
            "function approve(address spender, uint256 amount) returns (bool)"
        ], wallet);
        
        const allowance = await tokenContract.allowance(ownerAddress, spenderAddress);
        
        if (allowance < amount) {
            console.log(`Approving ${ethers.formatUnits(amount, 18)} tokens for router...`);
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

// Helper function to calculate minimum amount out based on slippage
function calculateMinimumAmountOut(amountIn, slippageTolerancePercent) {
    const slippageMultiplier = 1 - (slippageTolerancePercent / 100);
    return amountIn * slippageMultiplier;
}

// Quote endpoint to get expected output amount
router.post("/quote", async (req, res) => {
    try {
        const { tokenIn, tokenOut, amountIn, fee = 3000 } = req.body;

        // Use default token addresses from environment variables if not provided
        const tokenInAddress = tokenIn || config.WETH_ADDRESS;
        const tokenOutAddress = tokenOut || config.WMATIC_ADDRESS;

        // Validate that we have token addresses
        if (!tokenInAddress || !tokenOutAddress) {
            return res.status(400).json({ 
                error: "Token addresses are required. Either provide them in the request body or set WETH_ADDRESS and WMATIC_ADDRESS in your .env file" 
            });
        }

        // Validate tokens
        let validatedTokenIn, validatedTokenOut;
        try {
            validatedTokenIn = validateToken(tokenInAddress);
            validatedTokenOut = validateToken(tokenOutAddress);
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

        // Get token decimals
        const tokenInDecimals = await getTokenDecimals(validatedTokenIn);
        const amountInWei = ethers.parseUnits(amountIn, tokenInDecimals);

        // Get quote from Uniswap V3 Quoter
        const quoteAmountOut = await quoter.quoteExactInputSingle.staticCall(
            validatedTokenIn,
            validatedTokenOut,
            fee,
            amountInWei,
            0 
        );

        // Get token out decimals for proper formatting
        const tokenOutDecimals = await getTokenDecimals(validatedTokenOut);
        const formattedAmountOut = ethers.formatUnits(quoteAmountOut, tokenOutDecimals);

        res.json({
            success: true,
            tokenIn: validatedTokenIn,
            tokenOut: validatedTokenOut,
            amountIn: amountIn,
            expectedAmountOut: formattedAmountOut,
            fee: fee,
            tokenInDecimals: tokenInDecimals,
            tokenOutDecimals: tokenOutDecimals
        });
    } catch (err) {
        console.error("Quote error:", err);
        
        // Handle specific Uniswap errors
        if (err.message.includes("INSUFFICIENT_LIQUIDITY")) {
            return res.status(400).json({ error: "Insufficient liquidity for this swap" });
        }
        if (err.message.includes("EXCESSIVE_INPUT_AMOUNT")) {
            return res.status(400).json({ error: "Input amount too high for available liquidity" });
        }
        
        res.status(500).json({ error: err.message });
    }
});

router.post("/swap", async (req, res) => {
    try {
        const { tokenIn, tokenOut, amountIn, recipient, slippageTolerance = 0.5, fee = 3000 } = req.body;

        // Use default token addresses from environment variables if not provided
        const tokenInAddress = tokenIn || config.WETH_ADDRESS;
        const tokenOutAddress = tokenOut || config.WMATIC_ADDRESS;

        // Validate that we have token addresses
        if (!tokenInAddress || !tokenOutAddress) {
            return res.status(400).json({ 
                error: "Token addresses are required. Either provide them in the request body or set WETH_ADDRESS and WMATIC_ADDRESS in your .env file" 
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

        // Validate slippage tolerance
        if (slippageTolerance < 0.1 || slippageTolerance > 50) {
            return res.status(400).json({ 
                error: "Slippage tolerance must be between 0.1% and 50%" 
            });
        }

        // Get token decimals dynamically
        const tokenInDecimals = await getTokenDecimals(validatedTokenIn);
        const amountInWei = ethers.parseUnits(amountIn, tokenInDecimals);

        // Get quote for slippage calculation
        let expectedAmountOut;
        try {
            const quoteAmountOut = await quoter.quoteExactInputSingle.staticCall(
                validatedTokenIn,
                validatedTokenOut,
                fee,
                amountInWei,
                0
            );
            expectedAmountOut = quoteAmountOut;
        } catch (quoteError) {
            console.warn("Failed to get quote, proceeding without slippage protection:", quoteError.message);
            expectedAmountOut = ethers.parseUnits("0", await getTokenDecimals(validatedTokenOut));
        }
        const amountOutMinimum = calculateMinimumAmountOut(expectedAmountOut, slippageTolerance);

        
        await ensureTokenApproval(validatedTokenIn, validatedRecipient, config.ROUTER_ADDRESS, amountInWei);

        let gasEstimate;
        try {
            gasEstimate = await uniswapRouter.exactInputSingle.estimateGas({
                tokenIn: validatedTokenIn,
                tokenOut: validatedTokenOut,
                fee: fee,
                recipient: validatedRecipient,
                deadline: Math.floor(Date.now() / 1000) + 60 * 10,
                amountIn: amountInWei,
                amountOutMinimum: amountOutMinimum,
                sqrtPriceLimitX96: 0
            });
        } catch (gasError) {
            console.warn("Gas estimation failed, using default:", gasError.message);
            gasEstimate = ethers.parseUnits("300000", "wei"); // Default gas limit
        }

        // Execute the swap
        const tx = await uniswapRouter.exactInputSingle({
            tokenIn: validatedTokenIn,
            tokenOut: validatedTokenOut,
            fee: fee,
            recipient: validatedRecipient,
            deadline: Math.floor(Date.now() / 1000) + 60 * 10,
            amountIn: amountInWei,
            amountOutMinimum: amountOutMinimum,
            sqrtPriceLimitX96: 0
        }, { 
            gasLimit: Math.floor(Number(gasEstimate) * 1.2) // 20% buffer
        });

        await tx.wait();

        // Store swap details for history (you can implement database storage here)
        const swapRecord = {
            txHash: tx.hash,
            tokenIn: validatedTokenIn,
            tokenOut: validatedTokenOut,
            amountIn: amountIn,
            amountInWei: amountInWei.toString(),
            expectedAmountOut: ethers.formatUnits(expectedAmountOut, await getTokenDecimals(validatedTokenOut)),
            amountOutMinimum: ethers.formatUnits(amountOutMinimum, await getTokenDecimals(validatedTokenOut)),
            recipient: validatedRecipient,
            fee: fee,
            slippageTolerance: slippageTolerance,
            timestamp: new Date().toISOString(),
            status: 'completed'
        };

        res.json({ 
            success: true, 
            txHash: tx.hash,
            swapDetails: swapRecord
        });
    } catch (err) {
        console.error("Swap error:", err);
        
        // Handle specific Uniswap errors
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

// Helper endpoint to get supported tokens and their information
router.get("/tokens", async (req, res) => {
    try {
        const { getAllowedTokens } = await import("../services/tokenValidation.js");
        const allowedTokens = getAllowedTokens();
        
        const tokenInfo = [];
        
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
        
        res.json({
            success: true,
            tokens: tokenInfo
        });
    } catch (err) {
        console.error("Get tokens error:", err);
        res.status(500).json({ error: err.message });
    }
});

// Helper endpoint to get token balance
router.get("/balance/:tokenAddress/:userAddress", async (req, res) => {
    try {
        const { tokenAddress, userAddress } = req.params;
        
        // Validate addresses
        const validatedTokenAddress = validateToken(tokenAddress);
        const validatedUserAddress = validateAndFormatAddress(userAddress, "User");
        
        const tokenContract = new ethers.Contract(validatedTokenAddress, [
            "function balanceOf(address owner) view returns (uint256)",
            "function decimals() view returns (uint8)"
        ], provider);
        
        const [balance, decimals] = await Promise.all([
            tokenContract.balanceOf(validatedUserAddress),
            tokenContract.decimals()
        ]);
        
        const formattedBalance = ethers.formatUnits(balance, decimals);
        
        res.json({
            success: true,
            tokenAddress: validatedTokenAddress,
            userAddress: validatedUserAddress,
            balance: formattedBalance,
            balanceWei: balance.toString(),
            decimals: decimals
        });
    } catch (err) {
        console.error("Get balance error:", err);
        res.status(500).json({ error: err.message });
    }
});

export default router;

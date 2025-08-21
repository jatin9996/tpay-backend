/**
 * WETH Approval Router - Handles WETH token approval operations for Uniswap V3
 * Provides endpoints for approving WETH spending, checking allowances, and wallet information
 */

import express from "express";
import WETHApprovalService from "../services/wethApproval.js";

const router = express.Router();
const wethApprovalService = new WETHApprovalService();

/**
 * @route POST /api/weth/approve
 * @desc Approve WETH spending for the router contract
 * @access Public
 */
router.post("/approve", async (req, res) => {
    try {
        const { spender, amount } = req.body;
        
        // Use provided spender or default to router address
        const targetSpender = spender || undefined;
        
        // Use provided amount or default to unlimited
        const targetAmount = amount ? ethers.parseEther(amount) : undefined;
        
        const result = await wethApprovalService.approveWETH(targetSpender, targetAmount);
        
        res.json({
            success: true,
            message: "WETH approval successful",
            data: result
        });
        
    } catch (error) {
        console.error("WETH approval route error:", error);
        res.status(500).json({
            success: false,
            message: "WETH approval failed",
            error: error.message
        });
    }
});

/**
 * @route GET /api/weth/allowance
 * @desc Check current WETH allowance for a spender
 * @access Public
 */
router.get("/allowance", async (req, res) => {
    try {
        const { spender } = req.query;
        
        const result = await wethApprovalService.checkAllowance(spender);
        
        res.json({
            success: true,
            message: "Allowance check successful",
            data: result
        });
        
    } catch (error) {
        console.error("Allowance check route error:", error);
        res.status(500).json({
            success: false,
            message: "Allowance check failed",
            error: error.message
        });
    }
});

/**
 * @route GET /api/weth/wallet-info
 * @desc Get wallet and contract information
 * @access Public
 */
router.get("/wallet-info", async (req, res) => {
    try {
        const walletInfo = wethApprovalService.getWalletInfo();
        
        res.json({
            success: true,
            message: "Wallet info retrieved successfully",
            data: walletInfo
        });
        
    } catch (error) {
        console.error("Wallet info route error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to get wallet info",
            error: error.message
        });
    }
});

/**
 * @route POST /api/weth/approve-unlimited
 * @desc Approve unlimited WETH spending for the router (convenience endpoint)
 * @access Public
 */
router.post("/approve-unlimited", async (req, res) => {
    try {
        const result = await wethApprovalService.approveWETH();
        
        res.json({
            success: true,
            message: "Unlimited WETH approval successful",
            data: result
        });
        
    } catch (error) {
        console.error("Unlimited WETH approval route error:", error);
        res.status(500).json({
            success: false,
            message: "Unlimited WETH approval failed",
            error: error.message
        });
    }
});

export default router;

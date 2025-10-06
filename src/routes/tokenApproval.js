import express from "express";
import { ethers } from "ethers";
import TokenApprovalService from "../services/tokenApproval.js";

const router = express.Router();
const tokenApprovalService = new TokenApprovalService();

// POST /api/token/approve
router.post("/approve", async (req, res) => {
    try {
        const { tokenAddress, spender, amount } = req.body;
        if (!tokenAddress || !ethers.isAddress(tokenAddress)) {
            return res.status(400).json({ success: false, message: "Invalid or missing tokenAddress" });
        }
        if (spender && !ethers.isAddress(spender)) {
            return res.status(400).json({ success: false, message: "Invalid spender address" });
        }

        const result = await tokenApprovalService.approveToken(tokenAddress, spender, amount);
        res.json({ success: true, message: "Token approval successful", data: result });
    } catch (error) {
        res.status(500).json({ success: false, message: "Token approval failed", error: error.message });
    }
});

// POST /api/token/approve-unlimited
router.post("/approve-unlimited", async (req, res) => {
    try {
        const { tokenAddress, spender } = req.body;
        if (!tokenAddress || !ethers.isAddress(tokenAddress)) {
            return res.status(400).json({ success: false, message: "Invalid or missing tokenAddress" });
        }
        if (spender && !ethers.isAddress(spender)) {
            return res.status(400).json({ success: false, message: "Invalid spender address" });
        }

        const result = await tokenApprovalService.approveToken(tokenAddress, spender);
        res.json({ success: true, message: "Unlimited token approval successful", data: result });
    } catch (error) {
        res.status(500).json({ success: false, message: "Unlimited token approval failed", error: error.message });
    }
});

// GET /api/token/allowance?tokenAddress=...&spender=...
router.get("/allowance", async (req, res) => {
    try {
        const { tokenAddress, spender } = req.query;
        if (!tokenAddress || !ethers.isAddress(tokenAddress)) {
            return res.status(400).json({ success: false, message: "Invalid or missing tokenAddress" });
        }
        if (spender && !ethers.isAddress(spender)) {
            return res.status(400).json({ success: false, message: "Invalid spender address" });
        }

        const result = await tokenApprovalService.checkAllowance(tokenAddress, spender);
        res.json({ success: true, message: "Allowance check successful", data: result });
    } catch (error) {
        res.status(500).json({ success: false, message: "Allowance check failed", error: error.message });
    }
});

// GET /api/token/token-info?tokenAddress=...
router.get("/token-info", async (req, res) => {
    try {
        const { tokenAddress } = req.query;
        if (!tokenAddress || !ethers.isAddress(tokenAddress)) {
            return res.status(400).json({ success: false, message: "Invalid or missing tokenAddress" });
        }
        const info = await tokenApprovalService.getTokenInfo(tokenAddress);
        res.json({ success: true, message: "Token info retrieved successfully", data: info });
    } catch (error) {
        res.status(500).json({ success: false, message: "Failed to get token info", error: error.message });
    }
});

export default router;



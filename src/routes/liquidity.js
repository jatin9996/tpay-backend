import express from "express";
import { ethers } from "ethers";
import positionManagerABI from "@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json" assert { type: "json" };
import config from "../config/env.js";
import { validateToken } from "../services/tokenValidation.js";

const router = express.Router();

const provider = new ethers.JsonRpcProvider(config.RPC_URL);
const wallet = new ethers.Wallet(config.PRIVATE_KEY, provider);
const positionManager = new ethers.Contract(config.POSITION_MANAGER_ADDRESS, positionManagerABI.abi, wallet);

router.post("/add-liquidity", async (req, res) => {
    try {
        const { token0, token1, amount0, amount1, recipient } = req.body;

       
        const validatedToken0 = validateToken(token0);
        const validatedToken1 = validateToken(token1);

        const tx = await positionManager.mint({
            token0: validatedToken0,
            token1: validatedToken1,
            fee: 3000,
            tickLower: -60000,
            tickUpper: 60000,
            amount0Desired: ethers.parseUnits(amount0, 18),
            amount1Desired: ethers.parseUnits(amount1, 18),
            amount0Min: 0,
            amount1Min: 0,
            recipient,
            deadline: Math.floor(Date.now() / 1000) + 60 * 10
        });

        await tx.wait();
        res.json({ success: true, txHash: tx.hash });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;

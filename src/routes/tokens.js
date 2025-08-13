import express from "express";
import { getAllowedTokens, isTokenAllowed } from "../services/tokenValidation.js";

const router = express.Router();

router.get("/allowed", (req, res) => {
    try {
        const allowedTokens = getAllowedTokens();
        res.json({
            success: true,
            allowedTokens,
            count: allowedTokens.length
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


router.get("/validate/:address", (req, res) => {
    try {
        const { address } = req.params;
        const isValid = isTokenAllowed(address);
        
        res.json({
            success: true,
            address,
            isValid,
            message: isValid ? "Token is allowed" : "Token is not allowed"
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;

/**
 * Tokens Router - Handles token validation and information endpoints
 * Provides endpoints for checking allowed tokens and validating token addresses
 */

import express from "express";
import { getAllowedTokens, isTokenAllowed } from "../services/tokenValidation.js";

const router = express.Router();

/**
 * GET ALLOWED TOKENS ENDPOINT
 * Returns a list of all tokens that are allowed for trading/operations
 * Useful for populating token lists in the frontend
 */
router.get("/allowed", (req, res) => {
    try {
        // Get the list of allowed tokens from the validation service
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

/**
 * VALIDATE TOKEN ENDPOINT
 * Checks if a specific token address is allowed for operations
 * 
 * @param {string} address - The token address to validate
 * @returns {Object} Validation result with success status and message
 */
router.get("/validate/:address", (req, res) => {
    try {
        const { address } = req.params;
        
        // Check if the token address is in the allowed list
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

/**
 * Tokens Router - Handles token validation and permissionless listing endpoints
 * Provides endpoints for checking allowed tokens, validating token addresses,
 * and managing the dynamic token registry for permissionless listings
 */

import express from "express";
import { 
    getAllowedTokens, 
    isTokenAllowed, 
    addTokenToRegistry, 
    removeTokenFromRegistry,
    getTokenRegistryStatus
} from "../services/tokenValidation.js";

const router = express.Router();

/**
 * GET ALLOWED TOKENS ENDPOINT
 * Returns a list of all tokens that are allowed for trading/operations
 * Includes both essential (pre-configured) and dynamic (permissionless) tokens
 */
router.get("/allowed", (req, res) => {
    try {
        const allowedTokens = getAllowedTokens();
        const registryStatus = getTokenRegistryStatus();
        
        res.json({
            success: true,
            allowedTokens,
            count: allowedTokens.length,
            registry: registryStatus
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
        
        const isValid = isTokenAllowed(address);
        const registryStatus = getTokenRegistryStatus();
        
        res.json({
            success: true,
            address,
            isValid,
            message: isValid ? "Token is allowed" : "Token is not allowed",
            registry: registryStatus
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * ADD TOKEN TO REGISTRY ENDPOINT (Permissionless Listing)
 * Allows any user to add a new ERC-20 token to the trading registry
 * 
 * @param {string} address - The token address to add
 * @returns {Object} Result of the operation
 */
router.post("/add", (req, res) => {
    try {
        const { address } = req.body;
        
        if (!address) {
            return res.status(400).json({
                success: false,
                error: "Token address is required in request body"
            });
        }
        
        const result = addTokenToRegistry(address);
        
        if (result.success) {
            res.json({
                success: true,
                message: result.message,
                address: result.address,
                registry: getTokenRegistryStatus()
            });
        } else {
            res.status(400).json({
                success: false,
                error: result.message,
                address: result.address
            });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * REMOVE TOKEN FROM REGISTRY ENDPOINT
 * Removes a token from the dynamic registry (only dynamic tokens, not essential ones)
 * 
 * @param {string} address - The token address to remove
 * @returns {Object} Result of the operation
 */
router.delete("/remove/:address", (req, res) => {
    try {
        const { address } = req.params;
        
        const result = removeTokenFromRegistry(address);
        
        if (result.success) {
            res.json({
                success: true,
                message: result.message,
                address: result.address,
                registry: getTokenRegistryStatus()
            });
        } else {
            res.status(400).json({
                success: false,
                error: result.message,
                address: result.address
            });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET REGISTRY STATUS ENDPOINT
 * Returns detailed information about the token registry
 * Shows essential vs dynamic tokens and total counts
 */
router.get("/registry/status", (req, res) => {
    try {
        const registryStatus = getTokenRegistryStatus();
        
        res.json({
            success: true,
            registry: registryStatus,
            message: "Token registry status retrieved successfully"
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET ESSENTIAL TOKENS ENDPOINT
 * Returns only the pre-configured essential tokens
 */
router.get("/essential", (req, res) => {
    try {
        const registryStatus = getTokenRegistryStatus();
        
        res.json({
            success: true,
            essentialTokens: registryStatus.registry.essential,
            count: registryStatus.essentialTokens,
            message: "Essential tokens retrieved successfully"
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET DYNAMIC TOKENS ENDPOINT
 * Returns only the dynamically added tokens
 */
router.get("/dynamic", (req, res) => {
    try {
        const registryStatus = getTokenRegistryStatus();
        
        res.json({
            success: true,
            dynamicTokens: registryStatus.registry.dynamic,
            count: registryStatus.dynamicTokens,
            message: "Dynamic tokens retrieved successfully"
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;

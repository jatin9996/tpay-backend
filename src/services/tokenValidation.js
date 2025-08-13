import { ethers } from "ethers";
import config from "../config/env.js";

// Define allowed tokens as raw addresses - validation will happen at runtime
const allowedTokenAddresses = [
    config.WETH_ADDRESS,
    config.POL_ADDRESS,
    config.USDC_ADDRESS,
    config.WMATIC_ADDRESS,
    config.USDT_ADDRESS
];

// Cache for validated addresses
let validatedTokens = null;

/**
 * Gets the list of validated token addresses, initializing the cache if needed
 * @returns {string[]} - Array of validated token addresses
 */
function getValidatedTokens() {
    if (validatedTokens === null) {
        validatedTokens = [];
        for (const address of allowedTokenAddresses) {
            try {
                if (address && typeof address === 'string' && address.trim() !== '') {
                    const formatted = ethers.getAddress(address);
                    validatedTokens.push(formatted);
                }
            } catch (error) {
                console.warn(`Invalid token address in config: ${address}`, error.message);
            }
        }
        
        if (validatedTokens.length === 0) {
            console.warn("No valid token addresses found in configuration. Please check your environment variables.");
        }
    }
    return validatedTokens;
}

/**
 * Validates if a token address is in the allowed list
 * @param {string} address - The token address to validate
 * @returns {string} - The checksummed address if valid
 * @throws {Error} - If token is not supported
 */
function validateToken(address) {
    if (!address) {
        throw new Error("Token address is required");
    }
    
    if (typeof address !== 'string') {
        throw new Error(`Token address must be a string, got: ${typeof address}`);
    }
    
    try {
        const formatted = ethers.getAddress(address);
        const allowedTokens = getValidatedTokens();
        
        if (allowedTokens.length === 0) {
            throw new Error("No valid tokens configured. Please check your environment variables.");
        }
        
        if (!allowedTokens.includes(formatted)) {
            throw new Error(`Token ${address} not supported. Allowed tokens: ${allowedTokens.join(", ")}`);
        }
        return formatted;
    } catch (error) {
        if (error.code === 'INVALID_ARGUMENT' && error.argument === 'address') {
            throw new Error(`Invalid token address format: ${address}`);
        }
        throw error;
    }
}

/**
 * Gets the list of allowed token addresses
 * @returns {string[]} - Array of allowed token addresses
 */
function getAllowedTokens() {
    return [...getValidatedTokens()];
}

/**
 * Checks if a token address is allowed without throwing an error
 * @param {string} address - The token address to check
 * @returns {boolean} - True if token is allowed, false otherwise
 */
function isTokenAllowed(address) {
    try {
        if (!address) return false;
        const formatted = ethers.getAddress(address);
        const allowedTokens = getValidatedTokens();
        return allowedTokens.includes(formatted);
    } catch {
        return false;
    }
}

export {
    validateToken,
    getAllowedTokens,
    isTokenAllowed
};

import { ethers } from "ethers";
import config from "../config/env.js";
import Token from "../models/Token.js";

// Essential test tokens - pre-whitelisted for testing
const essentialTokenAddresses = [
    config.WETH_ADDRESS,
    config.USDC_ADDRESS,
    config.USDT_ADDRESS,
    // Optionally include wrapped native on certain testnets if provided
    config.WMATIC_ADDRESS
].filter(addr => typeof addr === 'string' && addr.trim() !== '');

// Dynamic token registry for permissionless listings
let dynamicTokenRegistry = new Set();
let validatedTokens = null;

// Preload additional allowed tokens from environment (comma-separated addresses)
function preloadEnvAllowedTokens() {
    try {
        const envList = process.env.ALLOWED_TOKENS;
        if (!envList) return;
        for (const raw of envList.split(',')) {
            const candidate = (raw || '').trim();
            if (!candidate) continue;
            try {
                const formatted = ethers.getAddress(candidate);
                dynamicTokenRegistry.add(formatted);
            } catch (e) {
                console.warn(`Invalid address in ALLOWED_TOKENS: ${candidate}`, e.message);
            }
        }
        validatedTokens = null; // force rebuild
    } catch {}
}

// Initialize env-based tokens once at module load
preloadEnvAllowedTokens();

/**
 * Adds a new token to the dynamic registry (permissionless listing)
 * @param {string} tokenAddress - The token address to add
 * @returns {Object} - Result of the operation
 */
export function addTokenToRegistry(tokenAddress) {
    try {
        if (!tokenAddress) {
            throw new Error("Token address is required");
        }
        
        const formattedAddress = ethers.getAddress(tokenAddress);
        
        // Check if token is already in the registry
        if (dynamicTokenRegistry.has(formattedAddress)) {
            return {
                success: false,
                message: "Token already exists in registry",
                address: formattedAddress
            };
        }
        
        // Add to dynamic registry
        dynamicTokenRegistry.add(formattedAddress);
        
        // Clear cache to force refresh
        validatedTokens = null;
        
        return {
            success: true,
            message: "Token added to registry successfully",
            address: formattedAddress
        };
    } catch (error) {
        return {
            success: false,
            message: `Failed to add token: ${error.message}`,
            address: tokenAddress
        };
    }
}

/**
 * Removes a token from the dynamic registry
 * @param {string} tokenAddress - The token address to remove
 * @returns {Object} - Result of the operation
 */
export function removeTokenFromRegistry(tokenAddress) {
    try {
        if (!tokenAddress) {
            throw new Error("Token address is required");
        }
        
        const formattedAddress = ethers.getAddress(tokenAddress);
        
        // Check if token is in the registry
        if (!dynamicTokenRegistry.has(formattedAddress)) {
            return {
                success: false,
                message: "Token not found in registry",
                address: formattedAddress
            };
        }
        
        // Remove from dynamic registry
        dynamicTokenRegistry.delete(formattedAddress);
        
        // Clear cache to force refresh
        validatedTokens = null;
        
        return {
            success: true,
            message: "Token removed from registry successfully",
            address: formattedAddress
        };
    } catch (error) {
        return {
            success: false,
            message: `Failed to remove token: ${error.message}`,
            address: tokenAddress
        };
    }
}

/**
 * Gets the list of validated token addresses, initializing the cache if needed
 * @returns {string[]} - Array of validated token addresses
 */
function getValidatedTokens() {
    if (validatedTokens === null) {
        validatedTokens = [];
        
        // Add essential tokens
        for (const address of essentialTokenAddresses) {
            try {
                if (address && typeof address === 'string' && address.trim() !== '') {
                    const formatted = ethers.getAddress(address);
                    validatedTokens.push(formatted);
                }
            } catch (error) {
                console.warn(`Invalid essential token address in config: ${address}`, error.message);
            }
        }
        
        // Add dynamic tokens
        for (const address of dynamicTokenRegistry) {
            try {
                const formatted = ethers.getAddress(address);
                if (!validatedTokens.includes(formatted)) {
                    validatedTokens.push(formatted);
                }
            } catch (error) {
                console.warn(`Invalid dynamic token address: ${address}`, error.message);
            }
        }
        
        if (validatedTokens.length === 0) {
            console.warn("No valid token addresses found. Please check your configuration.");
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
            throw new Error("No valid tokens configured. Please check your configuration.");
        }
        
        if (!allowedTokens.includes(formatted)) {
            throw new Error(`Token ${address} not supported. Supported tokens: ${allowedTokens.join(", ")}`);
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

/**
 * Gets the current token registry status
 * @returns {Object} - Registry status information
 */
export function getTokenRegistryStatus() {
    const essentialTokens = essentialTokenAddresses.filter(addr => addr && addr.trim() !== '');
    const dynamicTokens = Array.from(dynamicTokenRegistry);
    
    return {
        essentialTokens: essentialTokens.length,
        dynamicTokens: dynamicTokens.length,
        totalTokens: essentialTokens.length + dynamicTokens.length,
        registry: {
            essential: essentialTokens,
            dynamic: dynamicTokens
        }
    };
}

export {
    validateToken,
    getAllowedTokens,
    isTokenAllowed
};

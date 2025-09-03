import { ethers } from 'ethers';
import config from '../config/env.js';
import priceFeedService from './priceFeedService.js';

/**
 * Security Service
 * Implements MEV protection, slippage protection, and security checks
 */

class SecurityService {
    constructor() {
        this.suspiciousAddresses = new Set();
        this.rateLimitMap = new Map();
        this.maxRequestsPerMinute = 60;
        this.maxSlippageThreshold = 0.05; // 5%
        this.maxPriceDeviation = 0.03; // 3%
    }

    /**
     * Comprehensive security validation for swaps
     */
    async validateSwap(swapParams, requestInfo) {
        const validations = [
            this.checkRateLimit(requestInfo.ipAddress),
            this.checkSuspiciousActivity(swapParams),
            this.checkMEVProtection(swapParams),
            this.checkSlippageProtection(swapParams),
            this.checkLiquidityThreshold(swapParams),
            this.checkSanctionsList(swapParams.userAddress)
        ];

        const results = await Promise.all(validations);
        const failedValidations = results.filter(result => !result.valid);

        return {
            valid: failedValidations.length === 0,
            errors: failedValidations.map(v => v.error),
            warnings: results.filter(r => r.warning).map(r => r.warning)
        };
    }

    /**
     * Rate limiting check
     */
    async checkRateLimit(ipAddress) {
        const now = Date.now();
        const minute = Math.floor(now / 60000);
        const key = `${ipAddress}_${minute}`;

        const currentCount = this.rateLimitMap.get(key) || 0;
        
        if (currentCount >= this.maxRequestsPerMinute) {
            return {
                valid: false,
                error: 'Rate limit exceeded. Please try again later.'
            };
        }

        this.rateLimitMap.set(key, currentCount + 1);
        
        // Clean up old entries
        this.cleanupRateLimit();
        
        return { valid: true };
    }

    /**
     * Check for suspicious activity patterns
     */
    async checkSuspiciousActivity(swapParams) {
        const { userAddress, amountIn, tokenIn, tokenOut } = swapParams;

        // Check for suspicious address patterns
        if (this.suspiciousAddresses.has(userAddress?.toLowerCase())) {
            return {
                valid: false,
                error: 'Address flagged for suspicious activity'
            };
        }

        // Check for unusual swap patterns
        if (amountIn && Number(amountIn) > 1000000) { // $1M+ swaps
            return {
                valid: true,
                warning: 'Large swap detected - additional verification may be required'
            };
        }

        return { valid: true };
    }

    /**
     * MEV protection check
     */
    async checkMEVProtection(swapParams) {
        try {
            const { tokenIn, tokenOut, amountIn, chainId } = swapParams;
            
            // Get current market prices
            const [currentPriceIn, currentPriceOut] = await Promise.all([
                priceFeedService.getTokenPrice(tokenIn, chainId),
                priceFeedService.getTokenPrice(tokenOut, chainId)
            ]);

            if (currentPriceIn <= 0 || currentPriceOut <= 0) {
                return {
                    valid: true,
                    warning: 'Unable to verify current prices - proceed with caution'
                };
            }

            // Calculate expected output based on current prices
            const inputValue = Number(amountIn) * currentPriceIn;
            const expectedOutput = inputValue / currentPriceOut;

            // This would need actual pool data for accurate MEV detection
            // For now, implement basic checks
            const priceDeviation = Math.abs(currentPriceIn - currentPriceOut) / Math.max(currentPriceIn, currentPriceOut);
            
            if (priceDeviation > this.maxPriceDeviation) {
                return {
                    valid: false,
                    error: 'High price deviation detected - possible MEV attack'
                };
            }

            return { valid: true };
        } catch (error) {
            console.error('MEV protection check failed:', error);
            return {
                valid: true,
                warning: 'MEV protection check failed - proceed with caution'
            };
        }
    }

    /**
     * Slippage protection check
     */
    async checkSlippageProtection(swapParams) {
        const { slippageTolerance } = swapParams;
        
        if (slippageTolerance > this.maxSlippageThreshold) {
            return {
                valid: false,
                error: `Slippage tolerance ${(slippageTolerance * 100).toFixed(2)}% exceeds maximum allowed ${(this.maxSlippageThreshold * 100).toFixed(2)}%`
            };
        }

        if (slippageTolerance < 0.001) { // 0.1% minimum
            return {
                valid: false,
                error: 'Slippage tolerance too low - minimum 0.1% required'
            };
        }

        return { valid: true };
    }

    /**
     * Liquidity threshold check
     */
    async checkLiquidityThreshold(swapParams) {
        const { tokenIn, tokenOut, amountIn, chainId } = swapParams;
        
        try {
            // This would need actual pool liquidity data
            // For now, implement basic amount checks
            const amount = Number(amountIn);
            
            if (amount > 100000) { // $100K+ swaps
                return {
                    valid: true,
                    warning: 'Large swap detected - ensure sufficient liquidity'
                };
            }

            return { valid: true };
        } catch (error) {
            console.error('Liquidity check failed:', error);
            return {
                valid: true,
                warning: 'Unable to verify liquidity - proceed with caution'
            };
        }
    }

    /**
     * Sanctions list check (placeholder)
     */
    async checkSanctionsList(userAddress) {
        // This would integrate with actual sanctions databases
        // For now, just check for obvious test addresses
        if (userAddress && userAddress.toLowerCase().includes('test')) {
            return {
                valid: true,
                warning: 'Test address detected'
            };
        }

        return { valid: true };
    }

    /**
     * Clean up rate limit map
     */
    cleanupRateLimit() {
        const now = Date.now();
        const currentMinute = Math.floor(now / 60000);
        
        for (const [key] of this.rateLimitMap) {
            const keyMinute = parseInt(key.split('_').pop());
            if (currentMinute - keyMinute > 5) { // Keep 5 minutes of history
                this.rateLimitMap.delete(key);
            }
        }
    }

    /**
     * Add suspicious address
     */
    addSuspiciousAddress(address) {
        this.suspiciousAddresses.add(address.toLowerCase());
    }

    /**
     * Remove suspicious address
     */
    removeSuspiciousAddress(address) {
        this.suspiciousAddresses.delete(address.toLowerCase());
    }

    /**
     * Get security metrics
     */
    getSecurityMetrics() {
        return {
            suspiciousAddresses: this.suspiciousAddresses.size,
            activeRateLimits: this.rateLimitMap.size,
            maxSlippageThreshold: this.maxSlippageThreshold,
            maxPriceDeviation: this.maxPriceDeviation
        };
    }

    /**
     * Emergency pause check
     */
    async checkEmergencyPause() {
        // This would check database for emergency pause status
        const emergencyPaused = process.env.EMERGENCY_PAUSE === 'true';
        
        if (emergencyPaused) {
            return {
                valid: false,
                error: 'Trading is temporarily paused due to emergency conditions'
            };
        }

        return { valid: true };
    }
}

export default new SecurityService();

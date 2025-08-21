/**
 * Operational Limits Configuration for Custodial Swap Operations
 * 
 * IMPORTANT: This file defines limits and policies for custodial swaps where
 * the backend private key executes transactions on behalf of users.
 * 
 * WARNING: Custodial operations carry significant risks and regulatory requirements.
 * Consider using non-custodial swaps (/swap/populate) instead.
 */

export const OPERATIONAL_LIMITS = {
    // Daily swap volume limits (in USD equivalent)
    DAILY_VOLUME_CAP: {
        TOTAL: 1000000, // $1M total daily volume
        PER_USER: 100000, // $100K per user per day
        PER_TRANSACTION: 50000 // $50K max per transaction
    },

    // Slippage tolerance limits
    SLIPPAGE_LIMITS: {
        MIN: 0.1, // 0.1% minimum
        MAX: 5.0, // 5% maximum (reduced from 50% for safety)
        DEFAULT: 0.5 // 0.5% default
    },

    // Transaction deadline limits
    DEADLINE_LIMITS: {
        MIN_TTL: 60, // 1 minute minimum
        MAX_TTL: 3600, // 1 hour maximum (reduced from 24 hours)
        DEFAULT_TTL: 600 // 10 minutes default
    },

    // Fee tier restrictions
    ALLOWED_FEES: [500, 3000, 10000],

    // Gas limits and pricing
    GAS_LIMITS: {
        MAX_GAS_LIMIT: 500000, // Maximum gas limit per transaction
        GAS_BUFFER_PERCENT: 20, // 20% buffer for gas estimation
        MAX_GAS_PRICE: 100000000000 // 100 gwei max gas price
    },

    // Risk management
    RISK_LIMITS: {
        MAX_CONCURRENT_SWAPS: 10, // Maximum concurrent swaps
        MIN_LIQUIDITY_THRESHOLD: 10000, // Minimum liquidity required (USD)
        MAX_SLIPPAGE_IMPACT: 2.0 // Maximum slippage impact allowed (%)
    },

    // Withdrawal policies
    WITHDRAWAL_POLICIES: {
        MIN_WITHDRAWAL_AMOUNT: 100, // Minimum withdrawal amount (USD)
        MAX_WITHDRAWAL_AMOUNT: 10000, // Maximum withdrawal amount (USD)
        WITHDRAWAL_DELAY_HOURS: 24, // 24-hour delay for large withdrawals
        KYC_REQUIRED_THRESHOLD: 10000 // KYC required above this amount (USD)
    },

    // Compliance and monitoring
    COMPLIANCE: {
        SANCTIONS_CHECK: true, // Check against sanctions lists
        AML_MONITORING: true, // Anti-money laundering monitoring
        TRANSACTION_LOGGING: true, // Log all transactions for audit
        SUSPICIOUS_ACTIVITY_REPORTING: true // Report suspicious activity
    },

    // Emergency controls
    EMERGENCY_CONTROLS: {
        PAUSE_SWAPS: false, // Emergency pause for all swaps
        PAUSE_DEPOSITS: false, // Emergency pause for deposits
        PAUSE_WITHDRAWALS: false, // Emergency pause for withdrawals
        MAX_DAILY_LOSS: 50000 // Maximum daily loss limit (USD)
    }
};

/**
 * Validates if a swap operation is within operational limits
 * @param {Object} swapParams - Swap parameters to validate
 * @returns {Object} Validation result with success status and any errors
 */
export function validateOperationalLimits(swapParams) {
    const errors = [];
    const warnings = [];

    // Validate slippage tolerance
    if (swapParams.slippageTolerance < OPERATIONAL_LIMITS.SLIPPAGE_LIMITS.MIN || 
        swapParams.slippageTolerance > OPERATIONAL_LIMITS.SLIPPAGE_LIMITS.MAX) {
        errors.push(`Slippage tolerance must be between ${OPERATIONAL_LIMITS.SLIPPAGE_LIMITS.MIN}% and ${OPERATIONAL_LIMITS.SLIPPAGE_LIMITS.MAX}%`);
    }

    // Validate TTL
    if (swapParams.ttlSec < OPERATIONAL_LIMITS.DEADLINE_LIMITS.MIN_TTL || 
        swapParams.ttlSec > OPERATIONAL_LIMITS.DEADLINE_LIMITS.MAX_TTL) {
        errors.push(`TTL must be between ${OPERATIONAL_LIMITS.DEADLINE_LIMITS.MIN_TTL} and ${OPERATIONAL_LIMITS.DEADLINE_LIMITS.MAX_TTL} seconds`);
    }

    // Validate fee tier
    if (!OPERATIONAL_LIMITS.ALLOWED_FEES.includes(swapParams.fee)) {
        errors.push(`Fee must be one of: ${OPERATIONAL_LIMITS.ALLOWED_FEES.join(', ')}`);
    }

    // Check if emergency controls are active
    if (OPERATIONAL_LIMITS.EMERGENCY_CONTROLS.PAUSE_SWAPS) {
        errors.push("Swaps are currently paused due to emergency controls");
    }

    return {
        isValid: errors.length === 0,
        errors,
        warnings,
        limits: OPERATIONAL_LIMITS
    };
}

/**
 * Gets current operational status
 * @returns {Object} Current operational status
 */
export function getOperationalStatus() {
    return {
        swapsEnabled: !OPERATIONAL_LIMITS.EMERGENCY_CONTROLS.PAUSE_SWAPS,
        depositsEnabled: !OPERATIONAL_LIMITS.EMERGENCY_CONTROLS.PAUSE_DEPOSITS,
        withdrawalsEnabled: !OPERATIONAL_LIMITS.EMERGENCY_CONTROLS.PAUSE_WITHDRAWALS,
        limits: OPERATIONAL_LIMITS,
        timestamp: new Date().toISOString()
    };
}

/**
 * Updates operational limits (admin function)
 * @param {Object} newLimits - New limits to apply
 * @returns {Object} Update result
 */
export function updateOperationalLimits(newLimits) {
    // This would typically include admin authentication and validation
    // For now, just return the current limits
    console.warn("Operational limits update requested - implement admin authentication");
    
    return {
        success: false,
        message: "Admin authentication required to update operational limits",
        currentLimits: OPERATIONAL_LIMITS
    };
}

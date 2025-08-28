import mongoose from 'mongoose';
import config from "../config/env.js";
import Token from "../models/Token.js";

/**
 * Simple pricing module.
 * Strategy:
 * - If token is USDC/USDT (stable), priceUSD = 1
 * - Else try to infer via presence of essential tokens:
 *   - If token is WETH, try to get WETH->USDC rate from env seed (fallback to 0)
 *   - Otherwise, return 0 indicating unknown
 * NOTE: This placeholder can be enhanced later to read pair_snapshots.
 */

const STABLE_ADDRESSES = [
    (config.USDC_ADDRESS || '').toLowerCase(),
    (config.USDT_ADDRESS || '').toLowerCase()
].filter(Boolean);

export async function getTokenPriceUSD(tokenAddress) {
    if (!tokenAddress) return 0;
    const addr = tokenAddress.toLowerCase();
    if (STABLE_ADDRESSES.includes(addr)) return 1;
    // Best-effort: if token is WETH, return a placeholder price from env (optional)
    if (addr === (config.WETH_ADDRESS || '').toLowerCase()) {
        const fallback = process.env.WETH_USD_FALLBACK ? Number(process.env.WETH_USD_FALLBACK) : 0;
        return Number.isFinite(fallback) && fallback > 0 ? fallback : 0;
    }
    return 0; // Unknown price for now
}

export async function formatTokenMeta(address) {
    const token = await Token.findOne({ address: address.toLowerCase(), isActive: true }).lean();
    if (token) {
        return {
            address: token.address,
            symbol: token.symbol,
            name: token.name,
            decimals: token.decimals
        };
    }
    return {
        address: address.toLowerCase(),
        symbol: 'UNKNOWN',
        name: 'Unknown',
        decimals: 18
    };
}



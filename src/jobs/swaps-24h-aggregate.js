import mongoose from 'mongoose';
import TokenStats24h from "../models/TokenStats24h.js";
import Pool from "../models/Pool.js";
import config from "../config/env.js";
import { getTokenPriceUSD, formatTokenMeta } from "../services/pricing.js";

/**
 * Background job: Aggregate last 24h volume per token.
 * NOTE: This simplified implementation uses Pool.volume24h as a proxy and
 * splits per-token volume equally when price is unknown.
 * Replace with on-chain Swap log scan when event indexer is added.
 */

export async function aggregateSwaps24h(chainId = Number(config.DEFAULT_CHAIN_ID)) {
    const now = new Date();
    const tokenMap = new Map();

    const pools = await Pool.find({ chainId, isActive: true }).lean();

    for (const p of pools) {
        // Interpret pool volume24h as USD if either side is stable; else try WETH heuristic
        const token0Price = await getTokenPriceUSD(p.token0.address);
        const token1Price = await getTokenPriceUSD(p.token1.address);

        const poolVolumeRaw = Number(p.volume24h || '0');
        const poolVolume = Number.isFinite(poolVolumeRaw) ? poolVolumeRaw : 0;

        // Distribute volume to tokens; best-effort approximation
        const token0Key = p.token0.address.toLowerCase();
        const token1Key = p.token1.address.toLowerCase();

        const token0Meta = await formatTokenMeta(token0Key);
        const token1Meta = await formatTokenMeta(token1Key);

        // If either side has known USD price (1 for stable, or WETH fallback), use it
        const knownPrice = token0Price || token1Price;
        const volumeUSD = knownPrice ? poolVolume * knownPrice : 0;

        const half = volumeUSD > 0 ? volumeUSD / 2 : 0;

        // Increment token0
        const prev0 = tokenMap.get(token0Key) || { token: token0Meta, chainId, volume24hUSD: 0, trades24h: 0, priceUSD: token0Price || 0 };
        prev0.volume24hUSD += half;
        prev0.trades24h += 0; // unknown trades in this simplified version
        prev0.priceUSD = prev0.priceUSD || token0Price || 0;
        tokenMap.set(token0Key, prev0);

        // Increment token1
        const prev1 = tokenMap.get(token1Key) || { token: token1Meta, chainId, volume24hUSD: 0, trades24h: 0, priceUSD: token1Price || 0 };
        prev1.volume24hUSD += half;
        prev1.trades24h += 0;
        prev1.priceUSD = prev1.priceUSD || token1Price || 0;
        tokenMap.set(token1Key, prev1);
    }

    const generatedAt = now;
    const bulkOps = [];
    for (const [, stat] of tokenMap) {
        bulkOps.push({
            updateOne: {
                filter: { 'token.address': stat.token.address.toLowerCase(), chainId },
                update: {
                    $set: {
                        token: stat.token,
                        chainId,
                        volume24hUSD: Math.max(0, Number(stat.volume24hUSD.toFixed(6))),
                        trades24h: stat.trades24h,
                        priceUSD: Math.max(0, Number((stat.priceUSD || 0).toFixed(6))),
                        generatedAt
                    }
                },
                upsert: true
            }
        });
    }

    if (bulkOps.length) {
        await TokenStats24h.bulkWrite(bulkOps);
    }

    // Optionally, delete very old docs (keep latest two generations)
    // Not necessary due to upserts using unique token+chain key
    return { updated: bulkOps.length, generatedAt };
}

export async function runAggregatorPeriodically(intervalMs = 60_000) {
    // fire and forget loop
    setInterval(async () => {
        try {
            await aggregateSwaps24h();
        } catch (e) {
            console.error('swaps-24h-aggregate error:', e.message);
        }
    }, intervalMs);
}



import TokenStats24h from "../models/TokenStats24h.js";
import Pool from "../models/Pool.js";
import config from "../config/env.js";
import { getTokenPriceUSD, formatTokenMeta } from "../services/pricing.js";

/**
 * Background job: Aggregate last 24h volume per token.
 * NOTE: This simplified implementation uses Pool.volume24h as a proxy and
 * splits per-token volume equally when price is unknown.
 * Replace with on-chain Swap log scan when event indexer is added.
 * Updated to use Sequelize with PostgreSQL
 */

export async function aggregateSwaps24h(chainId = Number(config.DEFAULT_CHAIN_ID)) {
    const now = new Date();
    const tokenMap = new Map();

    const pools = await Pool.findAll({ 
        where: { chainId, isActive: true } 
    });

    for (const p of pools) {
        // Interpret pool volume24h as USD if either side is stable; else try WETH heuristic
        const token0Price = await getTokenPriceUSD(p.token0Address);
        const token1Price = await getTokenPriceUSD(p.token1Address);

        const poolVolumeRaw = Number(p.volume24h || '0');
        const poolVolume = Number.isFinite(poolVolumeRaw) ? poolVolumeRaw : 0;

        // Distribute volume to tokens; best-effort approximation
        const token0Key = p.token0Address.toLowerCase();
        const token1Key = p.token1Address.toLowerCase();

        const token0Meta = await formatTokenMeta(token0Key);
        const token1Meta = await formatTokenMeta(token1Key);

        // If either side has known USD price (1 for stable, or WETH fallback), use it
        const knownPrice = token0Price || token1Price;
        const volumeUSD = knownPrice ? poolVolume * knownPrice : 0;

        const half = volumeUSD > 0 ? volumeUSD / 2 : 0;

        // Increment token0
        const prev0 = tokenMap.get(token0Key) || { 
            token: token0Meta, 
            chainId, 
            volume24hUSD: 0, 
            trades24h: 0, 
            priceUSD: token0Price || 0 
        };
        prev0.volume24hUSD += half;
        prev0.trades24h += 0; // unknown trades in this simplified version
        prev0.priceUSD = prev0.priceUSD || token0Price || 0;
        tokenMap.set(token0Key, prev0);

        // Increment token1
        const prev1 = tokenMap.get(token1Key) || { 
            token: token1Meta, 
            chainId, 
            volume24hUSD: 0, 
            trades24h: 0, 
            priceUSD: token1Price || 0 
        };
        prev1.volume24hUSD += half;
        prev1.trades24h += 0;
        prev1.priceUSD = prev1.priceUSD || token1Price || 0;
        tokenMap.set(token1Key, prev1);
    }

    const generatedAt = now;
    let updatedCount = 0;
    
    for (const [, stat] of tokenMap) {
        try {
            const [tokenStats, created] = await TokenStats24h.findOrCreate({
                where: { 
                    tokenAddress: stat.token.address.toLowerCase(), 
                    chainId 
                },
                defaults: {
                    tokenAddress: stat.token.address.toLowerCase(),
                    tokenSymbol: stat.token.symbol,
                    tokenName: stat.token.name,
                    tokenDecimals: stat.token.decimals,
                    chainId,
                    volume24hUSD: Math.max(0, Number(stat.volume24hUSD.toFixed(6))),
                    trades24h: stat.trades24h,
                    priceUSD: Math.max(0, Number((stat.priceUSD || 0).toFixed(6))),
                    generatedAt
                }
            });

            if (!created) {
                // Update existing record
                await tokenStats.update({
                    tokenSymbol: stat.token.symbol,
                    tokenName: stat.token.name,
                    tokenDecimals: stat.token.decimals,
                    volume24hUSD: Math.max(0, Number(stat.volume24hUSD.toFixed(6))),
                    trades24h: stat.trades24h,
                    priceUSD: Math.max(0, Number((stat.priceUSD || 0).toFixed(6))),
                    generatedAt
                });
            }
            
            updatedCount++;
        } catch (error) {
            console.error(`Error updating token stats for ${stat.token.address}:`, error);
        }
    }

    // Optionally, delete very old docs (keep latest two generations)
    // Not necessary due to upserts using unique token+chain key
    return { updated: updatedCount, generatedAt };
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



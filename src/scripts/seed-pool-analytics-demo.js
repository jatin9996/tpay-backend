import { connectDB, sequelize } from '../config/database.js';
import Pool from '../models/Pool.js';
import MetricsPoolDay from '../models/MetricsPoolDay.js';

const CHAIN_ID = 11155111; // Sepolia by default

async function main() {
  await connectDB();

  // Ensure required tables exist (scoped sync to avoid global init conflicts)
  await Pool.sync();
  await MetricsPoolDay.sync();

  // Create or find a demo pool
  const [pool] = await Pool.findOrCreate({
    where: { poolAddress: '0xdemo000000000000000000000000000000000001' },
    defaults: {
      chainId: CHAIN_ID,
      token0: 'WETH',
      token1: 'USDC',
      feeTier: 3000,
      tickSpacing: 60,
      tvl: 100000,
      volume24h: 2500,
      fees24h: 7.5,
      isActive: true
    }
  });

  // Seed last 30 days of metrics
  const today = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dateOnly = d.toISOString().slice(0, 10);

    const base = 90000 + Math.random() * 30000; // tvl baseline
    const vol = 500 + Math.random() * 3000;
    const fees = vol * 0.003; // 0.3% fee approx

    await MetricsPoolDay.upsert({
      poolId: pool.poolAddress,
      date: dateOnly,
      tvlUsd: Math.round(base),
      volumeUsd: Math.round(vol),
      feesUsd: Number(fees.toFixed(2)),
      swapCount: Math.floor(10 + Math.random() * 80),
      uniqueUsers: Math.floor(5 + Math.random() * 40),
      avgSwapSize: vol / Math.max(1, Math.floor(10 + Math.random() * 80)),
      priceChange24h: Number((Math.random() * 2 - 1).toFixed(4)),
      volatility24h: Number((Math.random() * 0.1).toFixed(4))
    });
  }

  console.log('Seeded demo pool and metrics.');
  await sequelize.close();
}

main().catch((e) => { console.error(e); process.exit(1); });



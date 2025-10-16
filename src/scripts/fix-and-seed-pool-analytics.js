import { connectDB, sequelize } from '../config/database.js';
import Pool from '../models/Pool.js';
import MetricsPoolDay from '../models/MetricsPoolDay.js';

const CHAIN_ID = 11155111;
const DEMO_POOL_ADDR = '0xdemo000000000000000000000000000000000001';

async function run() {
  await connectDB();

  // Drop old metrics table if it exists (schema may have FK mismatch)
  try {
    await sequelize.query('DROP TABLE IF EXISTS metrics_pool_day CASCADE');
    console.log('Dropped metrics_pool_day (if existed)');
  } catch (e) {
    console.log('Drop metrics_pool_day skipped:', e.message);
  }

  // Ensure tables
  await Pool.sync();
  await MetricsPoolDay.sync();

  // Ensure demo pool exists
  const [pool] = await Pool.findOrCreate({
    where: { poolAddress: DEMO_POOL_ADDR },
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

  // Seed last 30 days
  const today = new Date();
  const rows = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dateOnly = d.toISOString().slice(0, 10);
    const base = 90000 + Math.random() * 30000;
    const vol = 500 + Math.random() * 3000;
    const fees = vol * 0.003;
    rows.push({
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

  // Bulk upsert (simple replace: delete then bulkCreate)
  await MetricsPoolDay.destroy({ where: { poolId: pool.poolAddress } });
  await MetricsPoolDay.bulkCreate(rows);
  console.log('Seeded analytics for demo pool:', pool.poolAddress);

  await sequelize.close();
}

run().catch((e) => { console.error(e); process.exit(1); });



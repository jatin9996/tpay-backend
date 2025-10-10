import { connectDB, sequelize } from '../config/database.js';
import Chain from '../models/Chain.js';
import Token from '../models/Token.js';
import RiskPolicy from '../models/RiskPolicy.js';
import FeatureFlag from '../models/FeatureFlag.js';
import Pool from '../models/Pool.js';
import config from '../config/env.js';

// Helper to pull token addresses from environment variables
function getAddr(chainId, symbol, fallback = '') {
    const upper = symbol.toUpperCase();
    return (
        process.env[`ADDR_${chainId}_${upper}`] ||
        process.env[`${upper}_${chainId}`] ||
        fallback
    );
}

// Normalize and validate an Ethereum-style address string from env
function normalizeAddress(addr) {
    if (!addr || typeof addr !== 'string') return '';
    let a = addr.trim();
    if (a.endsWith(';')) a = a.slice(0, -1); // remove stray semicolons from .env
    // Some users paste uppercase; standardize to lowercase
    a = a.toLowerCase();
    // Quick format check
    const isValid = /^0x[0-9a-f]{40}$/.test(a);
    return isValid ? a : '';
}

// Seed data for chains
const chainsData = [
    {
        name: 'Sepolia',
        chainId: 11155111,
        rpcUrl: config.RPC_URL || 'https://sepolia.infura.io/v3/your-project-id',
        routerAddress: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
        quoterAddress: '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6',
        nativeWrappedAddress: config.WETH_ADDRESS || '0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9',
        isActive: true,
        blockTime: 12,
        explorerUrl: 'https://sepolia.etherscan.io'
    },
    {
        name: 'Arbitrum Sepolia',
        chainId: 421614,
        rpcUrl: process.env.ARBITRUM_SEPOLIA_RPC || '',
        routerAddress: process.env.ARBITRUM_SEPOLIA_ROUTER || '',
        quoterAddress: process.env.ARBITRUM_SEPOLIA_QUOTER || '',
        nativeWrappedAddress: getAddr(421614, 'WETH', ''),
        isActive: false,
        blockTime: 1,
        explorerUrl: 'https://sepolia.arbiscan.io'
    },
    {
        name: 'Optimism Sepolia',
        chainId: 11155420,
        rpcUrl: process.env.OP_SEPOLIA_RPC || '',
        routerAddress: process.env.OP_SEPOLIA_ROUTER || '',
        quoterAddress: process.env.OP_SEPOLIA_QUOTER || '',
        nativeWrappedAddress: getAddr(11155420, 'WETH', ''),
        isActive: false,
        blockTime: 2,
        explorerUrl: 'https://sepolia-optimistic.etherscan.io'
    },
    {
        name: 'Base Sepolia',
        chainId: 84532,
        rpcUrl: process.env.BASE_SEPOLIA_RPC || '',
        routerAddress: process.env.BASE_SEPOLIA_ROUTER || '',
        quoterAddress: process.env.BASE_SEPOLIA_QUOTER || '',
        nativeWrappedAddress: getAddr(84532, 'WETH', ''),
        isActive: false,
        blockTime: 2,
        explorerUrl: 'https://sepolia.basescan.org'
    },
    {
        name: 'Polygon Amoy',
        chainId: 80002,
        rpcUrl: process.env.POLYGON_AMOY_RPC || '',
        routerAddress: process.env.POLYGON_AMOY_ROUTER || '',
        quoterAddress: process.env.POLYGON_AMOY_QUOTER || '',
        nativeWrappedAddress: getAddr(80002, 'WMATIC', ''),
        isActive: false,
        blockTime: 2,
        explorerUrl: 'https://www.oklink.com/amoy'
    },
    {
        name: 'BSC Testnet',
        chainId: 97,
        rpcUrl: process.env.BSC_TESTNET_RPC || '',
        routerAddress: process.env.BSC_TESTNET_ROUTER || '',
        quoterAddress: process.env.BSC_TESTNET_QUOTER || '',
        nativeWrappedAddress: getAddr(97, 'WBNB', ''),
        isActive: false,
        blockTime: 3,
        explorerUrl: 'https://testnet.bscscan.com'
    }
];

// Seed data for tokens
const tokensData = [];

function pushToken(address, chainId, symbol, name, decimals, opts = {}) {
    const norm = normalizeAddress(address);
    if (!norm) {
        console.warn(`[seedDatabase] Skipping ${symbol} on chain ${chainId}: invalid address "${address}"`);
        return;
    }
    tokensData.push({
        address: norm,
        chainId,
        symbol,
        name,
        decimals,
        listed: true,
        riskFlags: { isStablecoin: !!opts.isStablecoin, verified: true, liquidity: 'high' },
        marketCap: 0,
        volume24h: 0,
        priceUsd: opts.isStablecoin ? 1.0 : 0,
        isStablecoin: !!opts.isStablecoin,
        verified: true,
        blacklisted: false,
        logoURI: opts.logoURI || null
    });
}

// Ethereum Sepolia (11155111)
pushToken(config.WETH_ADDRESS || '0x7b79995e5f793a07bc00c21412e50ecae098e7f9', 11155111, 'WETH', 'Wrapped Ether', 18, { logoURI: 'https://tokens.1inch.io/0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2.png' });
pushToken(getAddr(11155111, 'USDC'), 11155111, 'USDC', ' USD Coin', 6, { isStablecoin: true });
pushToken(getAddr(11155111, 'USDT'), 11155111, 'USDT', ' Tether', 6, { isStablecoin: true });
pushToken(getAddr(11155111, 'DAI'), 11155111, 'DAI', 'Dai', 18, { isStablecoin: true });
pushToken(getAddr(11155111, 'WBTC'), 11155111, 'WBTC', 'Wrapped Bitcoin', 8);
pushToken(getAddr(11155111, 'UNI'), 11155111, 'UNI', 'Uniswap', 18);
pushToken(getAddr(11155111, 'LINK'), 11155111, 'LINK', 'Chainlink', 18);
pushToken(getAddr(11155111, 'AAVE'), 11155111, 'AAVE', 'Aave', 18);
pushToken(getAddr(11155111, 'STETH'), 11155111, 'STETH', 'Lido Staked Ether', 18);

// Arbitrum Sepolia (421614)
pushToken(getAddr(421614, 'WETH'), 421614, 'WETH', 'Wrapped Ether', 18);
['USDC','USDT','DAI','WBTC','UNI','LINK'].forEach(sym => {
    const addr = getAddr(421614, sym);
    const decimals = sym === 'USDC' || sym === 'USDT' ? 6 : (sym === 'WBTC' ? 8 : 18);
    pushToken(addr, 421614, sym, sym, decimals, { isStablecoin: ['USDC','USDT','DAI'].includes(sym) });
});

// Optimism Sepolia (11155420)
pushToken(getAddr(11155420, 'WETH'), 11155420, 'WETH', 'Wrapped Ether', 18);
['USDC','USDT','DAI','WBTC','UNI','LINK'].forEach(sym => {
    const addr = getAddr(11155420, sym);
    const decimals = sym === 'USDC' || sym === 'USDT' ? 6 : (sym === 'WBTC' ? 8 : 18);
    pushToken(addr, 11155420, sym, sym, decimals, { isStablecoin: ['USDC','USDT','DAI'].includes(sym) });
});

// Base Sepolia (84532)
pushToken(getAddr(84532, 'WETH'), 84532, 'WETH', 'Wrapped Ether', 18);
['USDC','USDT','DAI','WBTC','UNI','LINK'].forEach(sym => {
    const addr = getAddr(84532, sym);
    const decimals = sym === 'USDC' || sym === 'USDT' ? 6 : (sym === 'WBTC' ? 8 : 18);
    pushToken(addr, 84532, sym, sym, decimals, { isStablecoin: ['USDC','USDT','DAI'].includes(sym) });
});

// Polygon Amoy (80002)
pushToken(getAddr(80002, 'WMATIC'), 80002, 'WMATIC', 'Wrapped Matic', 18);
pushToken(getAddr(80002, 'WETH'), 80002, 'WETH', 'Wrapped Ether', 18);
['USDC','USDT','DAI','WBTC'].forEach(sym => {
    const addr = getAddr(80002, sym);
    const decimals = sym === 'USDC' || sym === 'USDT' ? 6 : (sym === 'WBTC' ? 8 : 18);
    pushToken(addr, 80002, sym, sym, decimals, { isStablecoin: ['USDC','USDT','DAI'].includes(sym) });
});

// BSC Testnet (97)
pushToken(getAddr(97, 'WBNB'), 97, 'WBNB', 'Wrapped BNB', 18);
['USDC','USDT','DAI','WBTC'].forEach(sym => {
    const addr = getAddr(97, sym);
    const decimals = sym === 'USDC' || sym === 'USDT' ? 6 : (sym === 'WBTC' ? 8 : 18);
    pushToken(addr, 97, sym, sym, decimals, { isStablecoin: ['USDC','USDT','DAI'].includes(sym) });
});

// Seed data for risk policies (keep large numeric caps null to avoid precision/validation issues)
const riskPoliciesData = [
    {
        chainId: 11155111,
        maxSlippageBps: 5000,
        maxTtlSec: 86400,
        allowedFees: [500, 3000, 10000],
        paused: false,
        maxAmountIn: null,
        maxAmountOut: null,
        dailySwapLimit: null,
        dailyVolumeLimit: null,
        whitelistedTokens: [],
        blacklistedTokens: [],
        whitelistedUsers: [],
        blacklistedUsers: [],
        description: 'Default risk policy for Sepolia testnet'
    }
];

// Seed data for feature flags
const featureFlagsData = [
    {
        key: 'SWAP_ENABLED',
        value: { enabled: true, reason: 'Swaps are operational' },
        description: 'Global switch for swap functionality',
        isActive: true,
        environment: 'production',
        updatedBy: 'system'
    },
    {
        key: 'CUSTODIAL_MODE',
        value: { enabled: false, reason: 'Non-custodial mode only for security' },
        description: 'Enable/disable custodial swap execution',
        isActive: true,
        environment: 'production',
        updatedBy: 'system'
    },
    {
        key: 'EXACT_OUT_ENABLED',
        value: { enabled: true, reason: 'Exact-out swaps are operational' },
        description: 'Enable/disable exact-out swap mode',
        isActive: true,
        environment: 'production',
        updatedBy: 'system'
    },
    {
        key: 'RATE_LIMITING',
        value: { enabled: true, maxRequests: 100, windowMs: 60000 },
        description: 'Rate limiting configuration',
        isActive: true,
        environment: 'production',
        updatedBy: 'system'
    }
];

// Seed data for pools (validated)
const poolsData = [];

function pushPool({ chainId, token0, token1, feeTier = 3000 }) {
    const t0 = normalizeAddress(token0);
    const t1 = normalizeAddress(token1);
    if (!t0 || !t1) {
        console.warn(`[seedDatabase] Skipping pool on chain ${chainId}: invalid token addresses (${token0}, ${token1})`);
        return;
    }
    poolsData.push({
        chainId,
        token0: t0,
        token1: t1,
        feeTier,
        // Use a deterministic virtual address to satisfy unique constraint without colliding on reruns
        poolAddress: `virtual:${chainId}:${t0}:${t1}:${feeTier}`,
        tickSpacing: 60,
        sqrtPriceX96: '0',
        liquidity: '0',
        reserve0: '0',
        reserve1: '0',
        price0: 0,
        price1: 0,
        volume24h: 0,
        tvl: 0,
        fees24h: 0,
        isActive: true,
        metadata: { poolType: 'uniswap_v3', version: '1.0.0' }
    });
}

// Example default pool for Sepolia WETH/USDC if both addresses available
pushPool({
    chainId: 11155111,
    token0: config.WETH_ADDRESS || '0x7b79995e5f793a07bc00c21412e50ecae098e7f9',
    token1: getAddr(11155111, 'USDC') || config.USDC_ADDRESS || '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
    feeTier: 3000
});

// Seed the database
const seedDatabase = async () => {
    try {
        console.log('Starting database seeding...');
        
        // Connect to database
        await connectDB();
        
        // Seed chains
        console.log('Seeding chains...');
        for (const chainData of chainsData) {
            await Chain.findOrCreate({
                where: { chainId: chainData.chainId },
                defaults: chainData
            });
        }
        console.log('✅ Chains seeded');
        
        // Seed tokens
        console.log('Seeding tokens...');
        for (const tokenData of tokensData) {
            await Token.findOrCreate({
                where: { address: tokenData.address },
                defaults: tokenData
            });
        }
        console.log('✅ Tokens seeded');
        
        // Seed risk policies
        console.log('Seeding risk policies...');
        for (const policyData of riskPoliciesData) {
            await RiskPolicy.findOrCreate({
                where: { chainId: policyData.chainId },
                defaults: policyData
            });
        }
        console.log('✅ Risk policies seeded');
        
        // Seed feature flags
        console.log('Seeding feature flags...');
        for (const flagData of featureFlagsData) {
            await FeatureFlag.findOrCreate({
                where: { key: flagData.key },
                defaults: flagData
            });
        }
        console.log('✅ Feature flags seeded');
        
        // Seed pools
        console.log('Seeding pools...');
        for (const poolData of poolsData) {
            await Pool.findOrCreate({
                where: { 
                    chainId: poolData.chainId,
                    token0: poolData.token0,
                    token1: poolData.token1,
                    feeTier: poolData.feeTier
                },
                defaults: poolData
            });
        }
        console.log('✅ Pools seeded');
        
        console.log('🎉 Database seeding completed successfully!');
        console.log('Seeded data:');
        console.log(`- ${chainsData.length} chains`);
        console.log(`- ${tokensData.length} tokens`);
        console.log(`- ${riskPoliciesData.length} risk policies`);
        console.log(`- ${featureFlagsData.length} feature flags`);
        console.log(`- ${poolsData.length} pools`);
        
        process.exit(0);
    } catch (error) {
        console.error('Database seeding failed:', error);
        process.exit(1);
    }
};

// Run seeding
seedDatabase();

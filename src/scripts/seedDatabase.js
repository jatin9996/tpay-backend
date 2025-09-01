import { connectDB, sequelize } from '../config/database.js';
import Chain from '../models/Chain.js';
import Token from '../models/Token.js';
import RiskPolicy from '../models/RiskPolicy.js';
import FeatureFlag from '../models/FeatureFlag.js';
import Pool from '../models/Pool.js';
import config from '../config/env.js';

// Seed data for chains
const chainsData = [
    {
        name: 'Sepolia',
        chainId: 11155111,
        rpcUrl: config.RPC_URL || 'https://sepolia.infura.io/v3/your-project-id',
        routerAddress: '0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E', // Uniswap V3 Router
        quoterAddress: '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6', // Uniswap V3 Quoter
        nativeWrappedAddress: config.WETH_ADDRESS || '0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9',
        isActive: true,
        blockTime: 12,
        explorerUrl: 'https://sepolia.etherscan.io'
    },
    {
        name: 'Polygon Mumbai',
        chainId: 80001,
        rpcUrl: 'https://polygon-mumbai.infura.io/v3/your-project-id',
        routerAddress: '0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E',
        quoterAddress: '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6',
        nativeWrappedAddress: '0x9c3C9283D3e44854697Cd22D3Faa240Cfb032889',
        isActive: false,
        blockTime: 2,
        explorerUrl: 'https://mumbai.polygonscan.com'
    }
];

// Seed data for tokens
const tokensData = [
    {
        address: config.WETH_ADDRESS || '0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9',
        chainId: 11155111,
        symbol: 'WETH',
        name: 'Wrapped Ether',
        decimals: 18,
        listed: true,
        riskFlags: { isStablecoin: false, verified: true, liquidity: 'high' },
        marketCap: 0,
        volume24h: 0,
        priceUsd: 0,
        isStablecoin: false,
        verified: true,
        blacklisted: false
    },
    {
        address: config.USDC_ADDRESS || '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
        chainId: 11155111,
        symbol: 'USDC',
        name: 'USD Coin',
        decimals: 6,
        listed: true,
        riskFlags: { isStablecoin: true, verified: true, liquidity: 'high' },
        marketCap: 0,
        volume24h: 0,
        priceUsd: 1.00,
        isStablecoin: true,
        verified: true,
        blacklisted: false
    },
    {
        address: config.USDT_ADDRESS || '0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0',
        chainId: 11155111,
        symbol: 'USDT',
        name: 'Tether USD',
        decimals: 6,
        listed: true,
        riskFlags: { isStablecoin: true, verified: true, liquidity: 'high' },
        marketCap: 0,
        volume24h: 0,
        priceUsd: 1.00,
        isStablecoin: true,
        verified: true,
        blacklisted: false
    }
];

// Seed data for risk policies
const riskPoliciesData = [
    {
        chainId: 11155111,
        maxSlippageBps: 5000, // 50%
        maxTtlSec: 86400, // 24 hours
        allowedFees: [500, 3000, 10000],
        paused: false,
        maxAmountIn: '1000000000000000000000', // 1000 ETH
        maxAmountOut: '1000000000000000000000', // 1000 ETH
        dailySwapLimit: '10000000000000000000000', // 10000 ETH
        dailyVolumeLimit: '100000000000000000000000', // 100000 ETH
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

// Seed data for pools (example pools)
const poolsData = [
    {
        chainId: 11155111,
        token0: config.WETH_ADDRESS || '0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9',
        token1: config.USDC_ADDRESS || '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
        feeTier: 3000,
        poolAddress: '0x0000000000000000000000000000000000000000', // Placeholder
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
    }
];

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

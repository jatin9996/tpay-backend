import { sequelize } from '../config/database.js';
import Token from '../models/Token.js';
import Pool from '../models/Pool.js';
import config from '../config/env.js';

/**
 * Database Seeding Script for PostgreSQL
 * Populates the database with initial data for testing and development
 */

const seedDatabase = async () => {
    try {
        console.log('🌱 Starting database seeding...');
        
        // Test database connection
        await sequelize.authenticate();
        console.log('✅ Database connection established successfully');
        
        // Sync models to ensure tables exist
        await sequelize.sync({ alter: true });
        console.log('✅ Database tables synchronized');
        
        // Seed tokens
        console.log('🔄 Seeding tokens...');
        await seedTokens();
        
        // Seed pools
        console.log('🔄 Seeding pools...');
        await seedPools();
        
        console.log('🎉 Database seeding completed successfully!');
        
    } catch (error) {
        console.error('❌ Database seeding failed:', error.message);
        process.exit(1);
    } finally {
        await sequelize.close();
        console.log('🔌 Database connection closed');
    }
};

const seedTokens = async () => {
    try {
        // Check if tokens already exist
        const existingTokens = await Token.count({ where: {} });
        if (existingTokens > 0) {
            console.log('ℹ️ Tokens already exist, skipping token seeding');
            return;
        }
        
        const tokens = [
            {
                address: config.WETH_ADDRESS,
                symbol: 'WETH',
                name: 'Wrapped Ether',
                decimals: 18,
                totalSupply: '1000000000000000000000000', // 1M WETH
                chainId: parseInt(config.DEFAULT_CHAIN_ID),
                isEssential: true,
                isActive: true
            },
            {
                address: config.USDC_ADDRESS,
                symbol: 'USDC',
                name: 'USD Coin',
                decimals: 6,
                totalSupply: '1000000000000', // 1M USDC
                chainId: parseInt(config.DEFAULT_CHAIN_ID),
                isEssential: true,
                isActive: true
            },
            {
                address: config.USDT_ADDRESS,
                symbol: 'USDT',
                name: 'Tether USD',
                decimals: 6,
                totalSupply: '1000000000000', // 1M USDT
                chainId: parseInt(config.DEFAULT_CHAIN_ID),
                isEssential: true,
                isActive: true
            }
        ];
        
        // Add WMATIC if configured
        if (config.WMATIC_ADDRESS) {
            tokens.push({
                address: config.WMATIC_ADDRESS,
                symbol: 'WMATIC',
                name: 'Wrapped MATIC',
                decimals: 18,
                totalSupply: '1000000000000000000000000', // 1M WMATIC
                chainId: parseInt(config.DEFAULT_CHAIN_ID),
                isEssential: false,
                isActive: true
            });
        }
        
        await Token.bulkCreate(tokens);
        console.log(`✅ Created ${tokens.length} tokens`);
        
    } catch (error) {
        console.error('❌ Error seeding tokens:', error.message);
        throw error;
    }
};

const seedPools = async () => {
    try {
        // Check if pools already exist
        const existingPools = await Pool.count({ where: {} });
        if (existingPools > 0) {
            console.log('ℹ️ Pools already exist, skipping pool seeding');
            return;
        }
        
        // Get seeded tokens
        const tokens = await Token.findAll({
            where: { isActive: true },
            attributes: ['address', 'symbol', 'name', 'decimals']
        });
        
        if (tokens.length < 2) {
            console.log('⚠️ Need at least 2 tokens to create pools');
            return;
        }
        
        const pools = [];
        
        // Create pools between essential tokens
        for (let i = 0; i < tokens.length; i++) {
            for (let j = i + 1; j < tokens.length; j++) {
                const token0 = tokens[i];
                const token1 = tokens[j];
                
                // Generate a mock pair address (in real scenario, this would come from Uniswap)
                const pairAddress = `0x${Math.random().toString(16).substr(2, 40)}`;
                
                pools.push({
                    pairAddress: pairAddress.toLowerCase(),
                    token0Address: token0.address,
                    token0Symbol: token0.symbol,
                    token0Name: token0.name,
                    token0Decimals: token0.decimals,
                    token1Address: token1.address,
                    token1Symbol: token1.symbol,
                    token1Name: token1.name,
                    token1Decimals: token1.decimals,
                    chainId: parseInt(config.DEFAULT_CHAIN_ID),
                    isActive: true,
                    liquidity: '1000000000000000000000', // 1000 tokens
                    volume24h: '500000000000000000000', // 500 tokens
                    fee: 3000 // 0.3%
                });
            }
        }
        
        await Pool.bulkCreate(pools);
        console.log(`✅ Created ${pools.length} pools`);
        
    } catch (error) {
        console.error('❌ Error seeding pools:', error.message);
        throw error;
    }
};

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    seedDatabase()
        .then(() => {
            console.log('Database seeding completed');
            process.exit(0);
        })
        .catch((error) => {
            console.error('Database seeding failed:', error);
            process.exit(1);
        });
}

export default seedDatabase;

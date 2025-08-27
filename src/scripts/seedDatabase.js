import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Token from '../models/Token.js';
import Pool from '../models/Pool.js';
import config from '../config/env.js';

// Load environment variables
dotenv.config();

/**
 * Database Seeder Script
 * Populates the database with initial tokens and pools for testing
 */

const seedTokens = [
    {
        address: "0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9",
        symbol: "WETH",
        name: "Wrapped Ether",
        decimals: 18,
        totalSupply: "1000000000000000000000000",
        chainId: 11155111,
        isEssential: true,
        isActive: true
    },
    {
        address: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
        symbol: "USDC",
        name: "USD Coin",
        decimals: 6,
        totalSupply: "1000000000000",
        chainId: 11155111,
        isEssential: true,
        isActive: true
    },
    {
        address: "0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0",
        symbol: "USDT",
        name: "Tether USD",
        decimals: 6,
        totalSupply: "1000000000000",
        chainId: 11155111,
        isEssential: true,
        isActive: true
    },
    {
        address: "0x1234567890123456789012345678901234567890",
        symbol: "DAI",
        name: "Dai Stablecoin",
        decimals: 18,
        totalSupply: "1000000000000000000000000",
        chainId: 11155111,
        isEssential: false,
        isActive: true
    },
    {
        address: "0x2345678901234567890123456789012345678901",
        symbol: "LINK",
        name: "Chainlink",
        decimals: 18,
        totalSupply: "1000000000000000000000000",
        chainId: 11155111,
        isEssential: false,
        isActive: true
    }
];

const seedPools = [
    {
        pairAddress: "0x1111111111111111111111111111111111111111",
        token0: {
            address: "0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9",
            symbol: "WETH",
            name: "Wrapped Ether",
            decimals: 18
        },
        token1: {
            address: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
            symbol: "USDC",
            name: "USD Coin",
            decimals: 6
        },
        chainId: 11155111,
        isActive: true,
        liquidity: "1000000000000000000000",
        volume24h: "500000000000000000000",
        fee: 3000
    },
    {
        pairAddress: "0x2222222222222222222222222222222222222222",
        token0: {
            address: "0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9",
            symbol: "WETH",
            name: "Wrapped Ether",
            decimals: 18
        },
        token1: {
            address: "0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0",
            symbol: "USDT",
            name: "Tether USD",
            decimals: 6
        },
        chainId: 11155111,
        isActive: true,
        liquidity: "800000000000000000000",
        volume24h: "300000000000000000000",
        fee: 3000
    },
    {
        pairAddress: "0x3333333333333333333333333333333333333333",
        token0: {
            address: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
            symbol: "USDC",
            name: "USD Coin",
            decimals: 6
        },
        token1: {
            address: "0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0",
            symbol: "USDT",
            name: "Tether USD",
            decimals: 6
        },
        chainId: 11155111,
        isActive: true,
        liquidity: "1200000000000000000000",
        volume24h: "700000000000000000000",
        fee: 1000
    },
    {
        pairAddress: "0x4444444444444444444444444444444444444444",
        token0: {
            address: "0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9",
            symbol: "WETH",
            name: "Wrapped Ether",
            decimals: 18
        },
        token1: {
            address: "0x1234567890123456789012345678901234567890",
            symbol: "DAI",
            name: "Dai Stablecoin",
            decimals: 18
        },
        chainId: 11155111,
        isActive: true,
        liquidity: "600000000000000000000",
        volume24h: "200000000000000000000",
        fee: 3000
    }
];

const seedDatabase = async () => {
    try {
        // Connect to MongoDB
        await mongoose.connect(config.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        
        console.log('Connected to MongoDB');
        
        // Clear existing data
        await Token.deleteMany({});
        await Pool.deleteMany({});
        console.log('Cleared existing data');
        
        // Seed tokens
        const createdTokens = await Token.insertMany(seedTokens);
        console.log(`Created ${createdTokens.length} tokens`);
        
        // Seed pools
        const createdPools = await Pool.insertMany(seedPools);
        console.log(`Created ${createdPools.length} pools`);
        
        // Create indexes
        await Token.createIndexes();
        await Pool.createIndexes();
        console.log('Database indexes created');
        
        console.log('Database seeding completed successfully!');
        
        // Display summary
        console.log('\n=== SEEDING SUMMARY ===');
        console.log(`Tokens: ${createdTokens.length}`);
        console.log(`Pools: ${createdPools.length}`);
        console.log('=======================\n');
        
    } catch (error) {
        console.error('Database seeding failed:', error);
        process.exit(1);
    } finally {
        await mongoose.connection.close();
        console.log('MongoDB connection closed');
    }
};

// Run seeder if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    seedDatabase();
}

export default seedDatabase;

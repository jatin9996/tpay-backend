import { sequelize, connectDB } from '../config/database.js';
import Token from '../models/Token.js';
import Pool from '../models/Pool.js';
import Quote from '../models/Quote.js';
import QuoteRequest from '../models/QuoteRequest.js';
import QuoteCache from '../models/QuoteCache.js';
import Swap from '../models/Swap.js';
import SwapAnalytics from '../models/SwapAnalytics.js';
import TokenStats24h from '../models/TokenStats24h.js';

/**
 * Database Initialization Script for PostgreSQL
 * Creates all tables and initializes the database schema
 */

const initDatabase = async () => {
    try {
        console.log('🔄 Initializing PostgreSQL database...');
        
        // Connect to database first
        await connectDB();
        
        // Sync all models (create tables)
        console.log('🔄 Creating database tables...');
        await sequelize.sync({ force: false, alter: true });
        console.log('✅ Database tables created/updated successfully');
        
        // Create indexes for better performance
        console.log('🔄 Creating database indexes...');
        await createIndexes();
        console.log('✅ Database indexes created successfully');
        
        console.log('🎉 Database initialization completed successfully!');
        
    } catch (error) {
        console.error('❌ Database initialization failed:', error.message);
        process.exit(1);
    }
};

const createIndexes = async () => {
    try {
        // Create additional indexes for better performance
        const queries = [
            // Token indexes
            'CREATE INDEX IF NOT EXISTS idx_tokens_symbol_lower ON tokens (LOWER(symbol))',
            'CREATE INDEX IF NOT EXISTS idx_tokens_name_lower ON tokens (LOWER(name))',
            
            // Pool indexes
            'CREATE INDEX IF NOT EXISTS idx_pools_token0_symbol_lower ON pools (LOWER("token0Symbol"))',
            'CREATE INDEX IF NOT EXISTS idx_pools_token1_symbol_lower ON pools (LOWER("token1Symbol"))',
            
            // Quote indexes
            'CREATE INDEX IF NOT EXISTS idx_quotes_expires_at_btree ON quotes USING BTREE (expires_at)',
            'CREATE INDEX IF NOT EXISTS idx_quotes_route_gin ON quotes USING GIN (route)',
            
            // Swap indexes
            'CREATE INDEX IF NOT EXISTS idx_swaps_route_gin ON swaps USING GIN (route)',
            'CREATE INDEX IF NOT EXISTS idx_swaps_created_at_btree ON swaps USING BTREE (created_at)',
            
            // Analytics indexes
            'CREATE INDEX IF NOT EXISTS idx_swap_analytics_metadata_gin ON swap_analytics USING GIN (metadata)',
            'CREATE INDEX IF NOT EXISTS idx_token_stats_metadata_gin ON token_stats_24h USING GIN (metadata)'
        ];
        
        for (const query of queries) {
            try {
                await sequelize.query(query);
            } catch (err) {
                // Index might already exist, continue
                if (!err.message.includes('already exists')) {
                    console.warn(`Warning creating index: ${err.message}`);
                }
            }
        }
        
    } catch (error) {
        console.warn('⚠️ Some indexes could not be created:', error.message);
    }
};

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    initDatabase()
        .then(() => {
            console.log('Database initialization completed');
            process.exit(0);
        })
        .catch((error) => {
            console.error('Database initialization failed:', error);
            process.exit(1);
        });
}

export default initDatabase;

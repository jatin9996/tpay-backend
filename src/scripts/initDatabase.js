import { connectDB, sequelize } from '../config/database.js';
import Chain from '../models/Chain.js';
import Token from '../models/Token.js';
import Swap from '../models/Swap.js';
import Transaction from '../models/Transaction.js';
import Approval from '../models/Approval.js';
import TxPopulation from '../models/TxPopulation.js';
import RiskPolicy from '../models/RiskPolicy.js';
import FeatureFlag from '../models/FeatureFlag.js';
import Pool from '../models/Pool.js';
import MetricsPoolDay from '../models/MetricsPoolDay.js';
import ServiceHealth from '../models/ServiceHealth.js';
import QuoteRequest from '../models/QuoteRequest.js';
import QuoteCache from '../models/QuoteCache.js';
import Notification from '../models/Notification.js';

// Define model associations
const setupAssociations = () => {
    // Chain associations
    Chain.hasMany(Token, { foreignKey: 'chainId', as: 'tokens' });
    Chain.hasMany(Swap, { foreignKey: 'chainId', as: 'swaps' });
    Chain.hasMany(Transaction, { foreignKey: 'chainId', as: 'transactions' });
    Chain.hasMany(Approval, { foreignKey: 'chainId', as: 'approvals' });
    Chain.hasMany(TxPopulation, { foreignKey: 'chainId', as: 'txPopulations' });
    Chain.hasMany(RiskPolicy, { foreignKey: 'chainId', as: 'riskPolicies' });
    Chain.hasMany(Pool, { foreignKey: 'chainId', as: 'pools' });

    // Token associations
    Token.belongsTo(Chain, { foreignKey: 'chainId', as: 'chain' });
    Token.hasMany(Swap, { foreignKey: 'tokenIn', as: 'swapsIn' });
    Token.hasMany(Swap, { foreignKey: 'tokenOut', as: 'swapsOut' });
    Token.hasMany(Approval, { foreignKey: 'token', as: 'approvals' });
    Token.hasMany(Pool, { foreignKey: 'token0', as: 'poolsAsToken0' });
    Token.hasMany(Pool, { foreignKey: 'token1', as: 'poolsAsToken1' });

    // Swap associations
    Swap.belongsTo(Chain, { foreignKey: 'chainId', as: 'chain' });
    Swap.belongsTo(Token, { foreignKey: 'tokenIn', as: 'tokenInToken' });
    Swap.belongsTo(Token, { foreignKey: 'tokenOut', as: 'tokenOutToken' });
    Swap.hasOne(Transaction, { foreignKey: 'txHash', sourceKey: 'txHash', as: 'transaction' });

    // Transaction associations
    Transaction.belongsTo(Chain, { foreignKey: 'chainId', as: 'chain' });
    Transaction.hasMany(Swap, { foreignKey: 'txHash', sourceKey: 'txHash', as: 'swaps' });
    Transaction.hasMany(Approval, { foreignKey: 'txHash', sourceKey: 'txHash', as: 'approvals' });

    // Approval associations
    Approval.belongsTo(Chain, { foreignKey: 'chainId', as: 'chain' });
    // Avoid alias collision with Approval attribute 'token'
    Approval.belongsTo(Token, { foreignKey: 'token', as: 'tokenRecord' });
    Approval.belongsTo(Transaction, { foreignKey: 'txHash', sourceKey: 'txHash', as: 'transaction' });

    // TxPopulation associations
    TxPopulation.belongsTo(Chain, { foreignKey: 'chainId', as: 'chain' });
    TxPopulation.belongsTo(Token, { foreignKey: 'tokenIn', as: 'tokenInToken' });
    TxPopulation.belongsTo(Token, { foreignKey: 'tokenOut', as: 'tokenOutToken' });

    // RiskPolicy associations
    RiskPolicy.belongsTo(Chain, { foreignKey: 'chainId', as: 'chain' });

    // Pool associations
    Pool.belongsTo(Chain, { foreignKey: 'chainId', as: 'chain' });
    Pool.belongsTo(Token, { foreignKey: 'token0', as: 'token0Token' });
    Pool.belongsTo(Token, { foreignKey: 'token1', as: 'token1Token' });
    // Ensure FK points to poolAddress (string) to match MetricsPoolDay.poolId (string)
    Pool.hasMany(MetricsPoolDay, { foreignKey: 'poolId', sourceKey: 'poolAddress', as: 'dailyMetrics' });

    // Metrics associations (match string FK to Pool.poolAddress)
    MetricsPoolDay.belongsTo(Pool, { foreignKey: 'poolId', targetKey: 'poolAddress', as: 'pool' });

    console.log('Model associations configured');
};

// Check if tables exist and handle column type conflicts
const checkAndHandleTableConflicts = async () => {
    try {
        // Check if tokens table exists and has volume24h column
        const [results] = await sequelize.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'tokens' 
            AND column_name = 'volume24h'
        `);
        
        if (results.length > 0) {
            const columnType = results[0].data_type;
            console.log(`Found existing volume24h column with type: ${columnType}`);
            
            // If the column type is not numeric/decimal, we need to handle it
            if (!['numeric', 'decimal'].includes(columnType)) {
                console.log('Column type mismatch detected. Dropping and recreating tokens table...');
                
                // Drop the tokens table to avoid type conflicts
                await sequelize.query('DROP TABLE IF EXISTS tokens CASCADE');
                console.log('Tokens table dropped successfully');
                
                // Also drop related tables that depend on tokens
                await sequelize.query('DROP TABLE IF EXISTS swaps CASCADE');
                await sequelize.query('DROP TABLE IF EXISTS approvals CASCADE');
                await sequelize.query('DROP TABLE IF EXISTS pools CASCADE');
                await sequelize.query('DROP TABLE IF EXISTS metrics_pool_day CASCADE');
                console.log('Related tables dropped successfully');
            }
        }
    } catch (error) {
        console.log('Error checking table conflicts:', error.message);
        // Continue with initialization even if this check fails
    }
};

// Initialize database with all models
const initDatabase = async () => {
    try {
        console.log('Starting database initialization...');
        
        // Connect to database
        await connectDB();
        
        // Check for column type conflicts and handle them
        await checkAndHandleTableConflicts();
        
        // Setup associations
        setupAssociations();
        
        // Sync all models (create tables)
        console.log('Syncing database models...');
        await sequelize.sync({ force: false, alter: false });
        
        console.log('Database initialization completed successfully!');
        console.log('Tables created/updated:');
        console.log('- chains');
        console.log('- tokens');
        console.log('- swaps');
        console.log('- transactions');
        console.log('- approvals');
        console.log('- tx_populations');
        console.log('- risk_policies');
        console.log('- feature_flags');
        console.log('- pools');
        console.log('- metrics_pool_day');
        console.log('- service_health');
        console.log('- quote_requests');
        console.log('- quote_cache');
        console.log('- notifications');
        
        process.exit(0);
    } catch (error) {
        console.error('Database initialization failed:', error);
        
        // If the error is related to column type casting, try a more aggressive approach
        if (error.message.includes('cannot be cast automatically') || error.message.includes('volume24h')) {
            console.log('Attempting to resolve column type conflicts by dropping and recreating tables...');
            try {
                // Drop all tables and recreate them
                await sequelize.sync({ force: true });
                console.log('Database tables recreated successfully!');
                process.exit(0);
            } catch (forceError) {
                console.error('Force recreation also failed:', forceError);
                process.exit(1);
            }
        }
        
        process.exit(1);
    }
};

// Run initialization
initDatabase();

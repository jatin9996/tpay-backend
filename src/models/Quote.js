import { DataTypes, Model, Sequelize } from 'sequelize';
import { sequelize } from '../config/database.js';

/**
 * Quote Model
 * Stores generated quotes with a TTL for later retrieval/analytics
 * Supports both EXACT_IN and EXACT_OUT quote modes
 */
class Quote extends Model {}

Quote.init({
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    // Quote identifier
    quoteId: { 
        type: DataTypes.STRING(50), 
        allowNull: false, 
        unique: true
    },
    
    // Blockchain identifiers
    chainId: { 
        type: DataTypes.STRING(20), 
        allowNull: false
    },
    
    // Token information
    tokenIn: { 
        type: DataTypes.STRING(42), 
        allowNull: false,
        validate: {
            isLowercase: true,
            len: [42, 42]
        }
    },
    tokenOut: { 
        type: DataTypes.STRING(42), 
        allowNull: false,
        validate: {
            isLowercase: true,
            len: [42, 42]
        }
    },
    
    // Amounts
    amountIn: { 
        type: DataTypes.STRING, 
        allowNull: false 
    },
    amountOut: { 
        type: DataTypes.STRING, 
        allowNull: false 
    },
    amountOutMinimum: { 
        type: DataTypes.STRING, 
        allowNull: false 
    },
    
    // Quote parameters
    mode: { 
        type: DataTypes.ENUM('EXACT_IN', 'EXACT_OUT'), 
        allowNull: false, 
        defaultValue: 'EXACT_IN'
    },
    fee: { 
        type: DataTypes.INTEGER, 
        allowNull: false,
        validate: {
            isIn: [[500, 3000, 10000]]
        }
    },
    slippageTolerance: { 
        type: DataTypes.DECIMAL(5, 2), 
        allowNull: true,
        validate: {
            min: 0.1,
            max: 50
        }
    },
    
    // Route information (stored as JSON)
    route: { 
        type: DataTypes.JSONB,
        allowNull: true
    },
    
    // Path and execution details
    path: { 
        type: DataTypes.TEXT, 
        allowNull: false 
    },
    
    // Price impact and gas estimation
    priceImpactPct: { 
        type: DataTypes.STRING, 
        allowNull: true 
    },
    estimatedGas: { 
        type: DataTypes.STRING, 
        allowNull: true 
    },
    
    // Expiration
    expiresAt: { 
        type: DataTypes.DATE, 
        allowNull: false
    },
    
    // User information
    userId: { 
        type: DataTypes.STRING(100), 
        allowNull: true
    },
    userAddress: { 
        type: DataTypes.STRING(42), 
        allowNull: true,
        validate: {
            isLowercase: true,
            len: [42, 42]
        }
    },
    
    // Quote metadata
    source: { 
        type: DataTypes.STRING(50), 
        allowNull: true,
        defaultValue: 'api'
    },
    ipAddress: { 
        type: DataTypes.STRING(45), // IPv6 compatible
        allowNull: true 
    },
    userAgent: { 
        type: DataTypes.TEXT, 
        allowNull: true 
    },
    
    // Status tracking
    status: { 
        type: DataTypes.ENUM('active', 'expired', 'used', 'cancelled'), 
        allowNull: false, 
        defaultValue: 'active'
    },
    
    // Usage tracking
    usedAt: { 
        type: DataTypes.DATE, 
        allowNull: true 
    },
    swapId: { 
        type: DataTypes.STRING(100), 
        allowNull: true
    }
}, {
    sequelize,
    modelName: 'Quote',
    tableName: 'quotes',
    timestamps: true,
    indexes: [
        {
            name: 'idx_quotes_quote_id',
            fields: ['quoteId']
        },
        {
            name: 'idx_quotes_chain_status',
            fields: ['chainId', 'status']
        },
        {
            name: 'idx_quotes_token_in_out',
            fields: ['tokenIn', 'tokenOut']
        },
        {
            name: 'idx_quotes_user_id',
            fields: ['userId']
        },
        {
            name: 'idx_quotes_status_expires',
            fields: ['status', 'expiresAt']
        },
        {
            name: 'idx_quotes_expires_at',
            fields: ['expiresAt']
        },
        {
            name: 'idx_quotes_swap_id',
            fields: ['swapId']
        }
    ]
});

// Instance method to check if quote is expired
Quote.prototype.isExpired = function() {
    return new Date() > this.expiresAt;
};

// Instance method to mark quote as used
Quote.prototype.markAsUsed = async function(swapId) {
    this.status = 'used';
    this.usedAt = new Date();
    this.swapId = swapId;
    return await this.save();
};

// Instance method to extend expiration
Quote.prototype.extendExpiration = async function(minutes = 10) {
    this.expiresAt = new Date(Date.now() + minutes * 60 * 1000);
    return await this.save();
};

// Static method to get quote statistics
Quote.getStats = async function(chainId, timeRange = '24h') {
    const { Op } = sequelize.Sequelize;
    const now = new Date();
    let startDate;
    
    switch(timeRange) {
        case '1h':
            startDate = new Date(now - 60 * 60 * 1000);
            break;
        case '24h':
            startDate = new Date(now - 24 * 60 * 60 * 1000);
            break;
        case '7d':
            startDate = new Date(now - 7 * 24 * 60 * 60 * 1000);
            break;
        case '30d':
            startDate = new Date(now - 30 * 24 * 60 * 60 * 1000);
            break;
        default:
            startDate = new Date(now - 24 * 60 * 60 * 1000);
    }
    
    const whereClause = {
        createdAt: { [Op.gte]: startDate }
    };
    
    if (chainId) {
        whereClause.chainId = chainId;
    }
    
    const totalQuotes = await Quote.count({ where: whereClause });
    const activeQuotes = await Quote.count({ 
        where: { ...whereClause, status: 'active' } 
    });
    const usedQuotes = await Quote.count({ 
        where: { ...whereClause, status: 'used' } 
    });
    const expiredQuotes = await Quote.count({ 
        where: { ...whereClause, status: 'expired' } 
    });
    
    // Get average amounts
    const amounts = await Quote.findAll({
        where: whereClause,
        attributes: [
            [sequelize.fn('AVG', sequelize.cast(sequelize.col('amountIn'), 'NUMERIC')), 'avgAmountIn'],
            [sequelize.fn('AVG', sequelize.cast(sequelize.col('amountOut'), 'NUMERIC')), 'avgAmountOut']
        ]
    });
    
    return [{
        totalQuotes,
        activeQuotes,
        usedQuotes,
        expiredQuotes,
        avgAmountIn: amounts[0]?.dataValues?.avgAmountIn || 0,
        avgAmountOut: amounts[0]?.dataValues?.avgAmountOut || 0
    }];
};

// Static method to clean up expired quotes
Quote.cleanupExpired = async function() {
    const { Op } = sequelize.Sequelize;
    const now = new Date();
    
    const result = await Quote.update(
        { status: 'expired' },
        { 
            where: { 
                expiresAt: { [Op.lt]: now },
                status: 'active'
            }
        }
    );
    
    return result[0];
};

export default Quote;



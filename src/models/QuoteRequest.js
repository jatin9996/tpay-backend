import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';

/**
 * QuoteRequest Model
 * Logs all quote requests for metrics, rate limiting, and debugging
 */
class QuoteRequest extends Model {}

QuoteRequest.init({
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    
    // Request identifier
    requestId: {
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
        allowNull: true
    },
    amountOut: {
        type: DataTypes.STRING,
        allowNull: true
    },
    
    // Quote parameters
    mode: {
        type: DataTypes.ENUM('EXACT_IN', 'EXACT_OUT'),
        allowNull: false,
        defaultValue: 'EXACT_IN'
    },
    fee: {
        type: DataTypes.INTEGER,
        allowNull: true,
        validate: {
            isIn: [[500, 3000, 10000]]
        }
    },
    slippagePct: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: true,
        validate: {
            min: 0.1,
            max: 50
        }
    },
    
    // Request metadata
    ipAddress: {
        type: DataTypes.STRING(45), // IPv6 compatible
        allowNull: true
    },
    userAgent: {
        type: DataTypes.TEXT,
        allowNull: true
    },
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
    
    // Response tracking
    responseTime: {
        type: DataTypes.INTEGER, // milliseconds
        allowNull: true
    },
    success: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
    },
    errorMessage: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    
    // Rate limiting
    rateLimitKey: {
        type: DataTypes.STRING(100),
        allowNull: true
    },
    
    // Cache hit/miss tracking
    cacheHit: {
        type: DataTypes.BOOLEAN,
        allowNull: true
    },
    
    // Quote reference
    quoteId: {
        type: DataTypes.STRING(50),
        allowNull: true
    }
}, {
    sequelize,
    modelName: 'QuoteRequest',
    tableName: 'quote_requests',
    timestamps: true,
    indexes: [
        {
            name: 'idx_quote_requests_request_id',
            fields: ['requestId']
        },
        {
            name: 'idx_quote_requests_chain_tokens',
            fields: ['chainId', 'tokenIn', 'tokenOut']
        },
        {
            name: 'idx_quote_requests_user_address',
            fields: ['userAddress']
        },
        {
            name: 'idx_quote_requests_ip_address',
            fields: ['ipAddress']
        },
        {
            name: 'idx_quote_requests_created_at',
            fields: ['createdAt']
        },
        {
            name: 'idx_quote_requests_rate_limit_key',
            fields: ['rateLimitKey']
        },
        {
            name: 'idx_quote_requests_success',
            fields: ['success']
        }
    ]
});

// Static method to get request statistics
QuoteRequest.getStats = async function(chainId, timeRange = '24h') {
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
    
    const totalRequests = await QuoteRequest.count({ where: whereClause });
    const successfulRequests = await QuoteRequest.count({ 
        where: { ...whereClause, success: true } 
    });
    const failedRequests = await QuoteRequest.count({ 
        where: { ...whereClause, success: false } 
    });
    const cacheHits = await QuoteRequest.count({ 
        where: { ...whereClause, cacheHit: true } 
    });
    
    // Get average response time
    const responseTimes = await QuoteRequest.findAll({
        where: { ...whereClause, responseTime: { [Op.ne]: null } },
        attributes: [
            [sequelize.fn('AVG', sequelize.col('responseTime')), 'avgResponseTime']
        ]
    });
    
    return [{
        totalRequests,
        successfulRequests,
        failedRequests,
        cacheHits,
        successRate: totalRequests > 0 ? (successfulRequests / totalRequests * 100).toFixed(2) : 0,
        cacheHitRate: totalRequests > 0 ? (cacheHits / totalRequests * 100).toFixed(2) : 0,
        avgResponseTime: responseTimes[0]?.dataValues?.avgResponseTime || 0
    }];
};

// Static method to get rate limit info for an IP/user
QuoteRequest.getRateLimitInfo = async function(identifier, timeWindow = '1h') {
    const { Op } = sequelize.Sequelize;
    const now = new Date();
    let startDate;
    
    switch(timeWindow) {
        case '1m':
            startDate = new Date(now - 60 * 1000);
            break;
        case '5m':
            startDate = new Date(now - 5 * 60 * 1000);
            break;
        case '1h':
            startDate = new Date(now - 60 * 60 * 1000);
            break;
        default:
            startDate = new Date(now - 60 * 60 * 1000);
    }
    
    const count = await QuoteRequest.count({
        where: {
            rateLimitKey: identifier,
            createdAt: { [Op.gte]: startDate }
        }
    });
    
    return {
        identifier,
        timeWindow,
        requestCount: count,
        startTime: startDate,
        endTime: now
    };
};

export default QuoteRequest;

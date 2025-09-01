import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';

/**
 * QuoteCache Model
 * Stores short-TTL quote cache to smooth RPC bursts and improve performance
 */
class QuoteCache extends Model {}

QuoteCache.init({
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    
    // Cache key components
    chainId: {
        type: DataTypes.STRING(20),
        allowNull: false
    },
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
    fee: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: {
            isIn: [[500, 3000, 10000]]
        }
    },
    amountIn: {
        type: DataTypes.STRING,
        allowNull: false
    },
    
    // Cache key hash (for fast lookups)
    cacheKey: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true
    },
    
    // Cached quote data
    amountOut: {
        type: DataTypes.STRING,
        allowNull: false
    },
    amountOutMinimum: {
        type: DataTypes.STRING,
        allowNull: false
    },
    priceImpactPct: {
        type: DataTypes.STRING,
        allowNull: true
    },
    estimatedGas: {
        type: DataTypes.STRING,
        allowNull: true
    },
    
    // Route information
    route: {
        type: DataTypes.JSONB,
        allowNull: true
    },
    path: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    
    // Cache metadata
    mode: {
        type: DataTypes.ENUM('EXACT_IN', 'EXACT_OUT'),
        allowNull: false,
        defaultValue: 'EXACT_IN'
    },
    slippagePct: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: true,
        validate: {
            min: 0.1,
            max: 50
        }
    },
    
    // TTL management
    expiresAt: {
        type: DataTypes.DATE,
        allowNull: false
    },
    
    // Usage tracking
    hitCount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
    },
    lastHitAt: {
        type: DataTypes.DATE,
        allowNull: true
    },
    
    // Source tracking
    source: {
        type: DataTypes.STRING(50),
        allowNull: true,
        defaultValue: 'quoter'
    }
}, {
    sequelize,
    modelName: 'QuoteCache',
    tableName: 'quote_cache',
    timestamps: true,
    indexes: [
        {
            name: 'idx_quote_cache_cache_key',
            fields: ['cacheKey']
        },
        {
            name: 'idx_quote_cache_chain_tokens_fee',
            fields: ['chainId', 'tokenIn', 'tokenOut', 'fee']
        },
        {
            name: 'idx_quote_cache_expires_at',
            fields: ['expiresAt']
        },
        {
            name: 'idx_quote_cache_last_hit',
            fields: ['lastHitAt']
        },
        {
            name: 'idx_quote_cache_hit_count',
            fields: ['hitCount']
        }
    ]
});

// Instance method to check if cache entry is expired
QuoteCache.prototype.isExpired = function() {
    return new Date() > this.expiresAt;
};

// Instance method to increment hit count
QuoteCache.prototype.incrementHit = async function() {
    this.hitCount += 1;
    this.lastHitAt = new Date();
    return await this.save();
};

// Instance method to extend expiration
QuoteCache.prototype.extendExpiration = async function(minutes = 5) {
    this.expiresAt = new Date(Date.now() + minutes * 60 * 1000);
    return await this.save();
};

// Static method to generate cache key
QuoteCache.generateCacheKey = function(chainId, tokenIn, tokenOut, fee, amountIn, mode = 'EXACT_IN') {
    const components = [chainId, tokenIn.toLowerCase(), tokenOut.toLowerCase(), fee, amountIn, mode];
    return components.join('_');
};

// Static method to find cached quote
QuoteCache.findCachedQuote = async function(chainId, tokenIn, tokenOut, fee, amountIn, mode = 'EXACT_IN') {
    const cacheKey = QuoteCache.generateCacheKey(chainId, tokenIn, tokenOut, fee, amountIn, mode);
    
    const cachedQuote = await QuoteCache.findOne({
        where: {
            cacheKey,
            expiresAt: { [sequelize.Sequelize.Op.gt]: new Date() }
        }
    });
    
    if (cachedQuote) {
        await cachedQuote.incrementHit();
        return cachedQuote;
    }
    
    return null;
};

// Static method to store quote in cache
QuoteCache.storeQuote = async function(quoteData, ttlMinutes = 5) {
    const {
        chainId,
        tokenIn,
        tokenOut,
        fee,
        amountIn,
        amountOut,
        amountOutMinimum,
        priceImpactPct,
        estimatedGas,
        route,
        path,
        mode,
        slippagePct,
        source
    } = quoteData;
    
    const cacheKey = QuoteCache.generateCacheKey(chainId, tokenIn, tokenOut, fee, amountIn, mode);
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);
    
    // Use upsert to handle existing entries
    const [cachedQuote, created] = await QuoteCache.upsert({
        cacheKey,
        chainId,
        tokenIn: tokenIn.toLowerCase(),
        tokenOut: tokenOut.toLowerCase(),
        fee,
        amountIn,
        amountOut,
        amountOutMinimum,
        priceImpactPct,
        estimatedGas,
        route,
        path,
        mode,
        slippagePct,
        expiresAt,
        source,
        hitCount: created ? 1 : sequelize.literal('hit_count + 1'),
        lastHitAt: new Date()
    });
    
    return cachedQuote;
};

// Static method to clean up expired cache entries
QuoteCache.cleanupExpired = async function() {
    const result = await QuoteCache.destroy({
        where: {
            expiresAt: { [sequelize.Sequelize.Op.lt]: new Date() }
        }
    });
    
    return result;
};

// Static method to get cache statistics
QuoteCache.getStats = async function(chainId, timeRange = '24h') {
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
        default:
            startDate = new Date(now - 24 * 60 * 60 * 1000);
    }
    
    const whereClause = {
        createdAt: { [Op.gte]: startDate }
    };
    
    if (chainId) {
        whereClause.chainId = chainId;
    }
    
    const totalEntries = await QuoteCache.count({ where: whereClause });
    const activeEntries = await QuoteCache.count({
        where: {
            ...whereClause,
            expiresAt: { [Op.gt]: now }
        }
    });
    const expiredEntries = await QuoteCache.count({
        where: {
            ...whereClause,
            expiresAt: { [Op.lte]: now }
        }
    });
    
    // Get total hit count
    const hitStats = await QuoteCache.findAll({
        where: whereClause,
        attributes: [
            [sequelize.fn('SUM', sequelize.col('hitCount')), 'totalHits'],
            [sequelize.fn('AVG', sequelize.col('hitCount')), 'avgHits']
        ]
    });
    
    return [{
        totalEntries,
        activeEntries,
        expiredEntries,
        totalHits: hitStats[0]?.dataValues?.totalHits || 0,
        avgHits: hitStats[0]?.dataValues?.avgHits || 0,
        hitRate: totalEntries > 0 ? (activeEntries / totalEntries * 100).toFixed(2) : 0
    }];
};

export default QuoteCache;

import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';
import { Op } from 'sequelize';

/**
 * Swap Analytics Model
 * Stores aggregated swap data for analytics, reporting, and dashboard metrics
 * Data is aggregated from the swaps collection on a regular basis
 */
class SwapAnalytics extends Model {}

SwapAnalytics.init({
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    // Time period identifier
    period: { 
        type: DataTypes.ENUM('1h', '24h', '7d', '30d', '1y'), 
        allowNull: false
    },
    
    // Time period start and end
    periodStart: { 
        type: DataTypes.DATE, 
        allowNull: false
    },
    periodEnd: { 
        type: DataTypes.DATE, 
        allowNull: false
    },
    
    // Blockchain identifier
    chainId: { 
        type: DataTypes.STRING(20), 
        allowNull: false
    },
    
    // Volume metrics
    totalVolumeIn: { 
        type: DataTypes.STRING, 
        allowNull: false,
        defaultValue: '0'
    },
    totalVolumeOut: { 
        type: DataTypes.STRING, 
        allowNull: false,
        defaultValue: '0'
    },
    
    // Count metrics
    totalSwaps: { 
        type: DataTypes.INTEGER, 
        allowNull: false,
        defaultValue: 0
    },
    successfulSwaps: { 
        type: DataTypes.INTEGER, 
        allowNull: false,
        defaultValue: 0
    },
    failedSwaps: { 
        type: DataTypes.INTEGER, 
        allowNull: false,
        defaultValue: 0
    },
    
    // Fee metrics
    totalFeesCollected: { 
        type: DataTypes.STRING, 
        allowNull: false,
        defaultValue: '0'
    },
    averageFee: { 
        type: DataTypes.DECIMAL(10, 2), 
        allowNull: false,
        defaultValue: 0
    },
    
    // Gas metrics
    totalGasUsed: { 
        type: DataTypes.STRING, 
        allowNull: false,
        defaultValue: '0'
    },
    averageGasUsed: { 
        type: DataTypes.DECIMAL(15, 2), 
        allowNull: false,
        defaultValue: 0
    },
    
    // Slippage metrics
    averageSlippage: { 
        type: DataTypes.DECIMAL(5, 2), 
        allowNull: false,
        defaultValue: 0
    },
    maxSlippage: { 
        type: DataTypes.DECIMAL(5, 2), 
        allowNull: false,
        defaultValue: 0
    },
    minSlippage: { 
        type: DataTypes.DECIMAL(5, 2), 
        allowNull: false,
        defaultValue: 0
    },
    
    // Token pair metrics
    topTokenPairs: { 
        type: DataTypes.JSONB, // Store as JSON array
        allowNull: true
    },
    
    // User metrics
    uniqueUsers: { 
        type: DataTypes.INTEGER, 
        allowNull: false,
        defaultValue: 0
    },
    newUsers: { 
        type: DataTypes.INTEGER, 
        allowNull: false,
        defaultValue: 0
    },
    
    // Performance metrics
    averageExecutionTime: { 
        type: DataTypes.DECIMAL(10, 2), // in milliseconds
        allowNull: false,
        defaultValue: 0
    },
    successRate: { 
        type: DataTypes.DECIMAL(5, 2), // percentage
        allowNull: false,
        defaultValue: 0
    },
    
    // Market metrics
    priceImpactAverage: { 
        type: DataTypes.DECIMAL(10, 6), // percentage
        allowNull: false,
        defaultValue: 0
    },
    priceImpactMax: { 
        type: DataTypes.DECIMAL(10, 6), // percentage
        allowNull: false,
        defaultValue: 0
    },
    
    // Additional metadata
    metadata: { 
        type: DataTypes.JSONB, // Store additional analytics data
        allowNull: true
    }
}, {
    sequelize,
    modelName: 'SwapAnalytics',
    tableName: 'swap_analytics',
    timestamps: true,
    indexes: [
        {
            name: 'idx_swap_analytics_period',
            fields: ['period']
        },
        {
            name: 'idx_swap_analytics_period_start',
            fields: ['periodStart']
        },
        {
            name: 'idx_swap_analytics_period_end',
            fields: ['periodEnd']
        },
        {
            name: 'idx_swap_analytics_chain',
            fields: ['chainId']
        },
        {
            name: 'idx_swap_analytics_period_chain',
            fields: ['period', 'chainId']
        }
    ]
});

// Static method to get latest analytics
SwapAnalytics.getLatestAnalytics = async function(chainId, period = '24h') {
    const whereClause = { period };
    if (chainId) {
        whereClause.chainId = chainId;
    }
    
    return await SwapAnalytics.findOne({
        where: whereClause,
        order: [['periodStart', 'DESC']]
    });
};

// Static method to get analytics summary
SwapAnalytics.getSummary = async function(chainId, timeRange = '7d') {
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
            startDate = new Date(now - 7 * 24 * 60 * 60 * 1000);
    }
    
    const whereClause = {
        periodStart: { [Op.gte]: startDate }
    };
    
    if (chainId) {
        whereClause.chainId = chainId;
    }
    
    const analytics = await SwapAnalytics.findAll({
        where: whereClause,
        order: [['periodStart', 'ASC']]
    });
    
    // Calculate summary metrics
    const summary = {
        totalVolumeIn: '0',
        totalVolumeOut: '0',
        totalSwaps: 0,
        successfulSwaps: 0,
        failedSwaps: 0,
        totalFeesCollected: '0',
        averageFee: 0,
        uniqueUsers: 0,
        successRate: 0
    };
    
    if (analytics.length > 0) {
        analytics.forEach(analytic => {
            summary.totalVolumeIn = (BigInt(summary.totalVolumeIn) + BigInt(analytic.totalVolumeIn)).toString();
            summary.totalVolumeOut = (BigInt(summary.totalVolumeOut) + BigInt(analytic.totalVolumeOut)).toString();
            summary.totalSwaps += analytic.totalSwaps;
            summary.successfulSwaps += analytic.successfulSwaps;
            summary.failedSwaps += analytic.failedSwaps;
            summary.totalFeesCollected = (BigInt(summary.totalFeesCollected) + BigInt(analytic.totalFeesCollected)).toString();
            summary.uniqueUsers = Math.max(summary.uniqueUsers, analytic.uniqueUsers);
        });
        
        summary.averageFee = parseFloat(summary.totalFeesCollected) / summary.totalSwaps || 0;
        summary.successRate = summary.totalSwaps > 0 ? (summary.successfulSwaps / summary.totalSwaps) * 100 : 0;
    }
    
    return summary;
};

export default SwapAnalytics;

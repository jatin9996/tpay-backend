import { DataTypes, Model, Op, Sequelize } from 'sequelize';
import { sequelize } from '../config/database.js';

/**
 * Swap Model
 * Stores executed swap transactions for history tracking and analytics
 */
class Swap extends Model {}

Swap.init({
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    chainId: { 
        type: DataTypes.INTEGER, 
        allowNull: false 
    },
    txHash: { 
        type: DataTypes.STRING(66), // Ethereum transaction hash length
        allowNull: false, 
        unique: true 
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
    amountIn: { 
        type: DataTypes.STRING, 
        allowNull: false 
    },
    amountInWei: { 
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
    recipient: { 
        type: DataTypes.STRING(42), 
        allowNull: false,
        validate: {
            isLowercase: true,
            len: [42, 42]
        }
    },
    fee: { 
        type: DataTypes.INTEGER, 
        allowNull: false 
    },
    slippageTolerance: { 
        type: DataTypes.DECIMAL(5, 2), 
        allowNull: false 
    },
    deadline: { 
        type: DataTypes.BIGINT, 
        allowNull: false 
    },
    ttlSec: { 
        type: DataTypes.INTEGER, 
        allowNull: false 
    },
    mode: { 
        type: DataTypes.ENUM('EXACT_IN', 'EXACT_OUT'), 
        allowNull: false, 
        defaultValue: 'EXACT_IN' 
    },
    status: { 
        type: DataTypes.ENUM('pending', 'completed', 'failed'), 
        allowNull: false, 
        defaultValue: 'pending' 
    },
    estimatedGas: { 
        type: DataTypes.STRING, 
        allowNull: true 
    },
    actualGasUsed: { 
        type: DataTypes.STRING, 
        allowNull: true 
    },
    gasPrice: { 
        type: DataTypes.STRING, 
        allowNull: true 
    },
    blockNumber: { 
        type: DataTypes.BIGINT, 
        allowNull: true 
    },
    route: { 
        type: DataTypes.JSONB, // Store route as JSON
        allowNull: true
    },
    path: { 
        type: DataTypes.TEXT, 
        allowNull: true 
    },
    quoteId: { 
        type: DataTypes.STRING(50), 
        allowNull: true 
    },
    errorMessage: { 
        type: DataTypes.TEXT, 
        allowNull: true 
    }
}, {
    sequelize,
    modelName: 'Swap',
    tableName: 'swaps',
    timestamps: true,
    indexes: [
        {
            name: 'idx_swaps_chain_status',
            fields: ['chainId', 'status']
        },
        {
            name: 'idx_swaps_token_in_out',
            fields: ['tokenIn', 'tokenOut']
        },
        {
            name: 'idx_swaps_recipient',
            fields: ['recipient']
        },
        {
            name: 'idx_swaps_tx_hash',
            fields: ['txHash'],
            unique: true
        },
        {
            name: 'idx_swaps_created_at',
            fields: ['createdAt']
        }
    ]
});

// Static method to get swap statistics
Swap.getStats = async function(chainId, timeRange = '24h') {
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
    
    const totalSwaps = await Swap.count({ where: whereClause });
    const completedSwaps = await Swap.count({ 
        where: { ...whereClause, status: 'completed' } 
    });
    const failedSwaps = await Swap.count({ 
        where: { ...whereClause, status: 'failed' } 
    });
    const pendingSwaps = await Swap.count({ 
        where: { ...whereClause, status: 'pending' } 
    });
    
    // Get average amounts
    const amounts = await Swap.findAll({
        where: whereClause,
        attributes: [
            [Sequelize.fn('AVG', Sequelize.cast(Sequelize.col('amountIn'), 'NUMERIC')), 'avgAmountIn'],
            [Sequelize.fn('AVG', Sequelize.cast(Sequelize.col('amountOut'), 'NUMERIC')), 'avgAmountOut']
        ]
    });
    
    return [{
        totalSwaps,
        completedSwaps,
        failedSwaps,
        pendingSwaps,
        avgAmountIn: amounts[0]?.dataValues?.avgAmountIn || 0,
        avgAmountOut: amounts[0]?.dataValues?.avgAmountOut || 0
    }];
};

export default Swap;

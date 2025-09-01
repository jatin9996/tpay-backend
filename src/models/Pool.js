import { DataTypes, Model, Op } from 'sequelize';
import { sequelize } from '../config/database.js';

/**
 * Pool Model
 * Represents liquidity pools/pairs in the system
 */
class Pool extends Model {}

Pool.init({
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    pairAddress: {
        type: DataTypes.STRING(42), // Ethereum address length
        allowNull: false,
        unique: true,
        validate: {
            isLowercase: true,
            len: [42, 42] // Ethereum address length
        }
    },
    token0Address: {
        type: DataTypes.STRING(42),
        allowNull: false,
        validate: {
            isLowercase: true,
            len: [42, 42]
        }
    },
    token0Symbol: {
        type: DataTypes.STRING(10),
        allowNull: false,
        validate: {
            isUppercase: true
        }
    },
    token0Name: {
        type: DataTypes.STRING(100),
        allowNull: false
    },
    token0Decimals: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 18,
        validate: {
            min: 0,
            max: 18
        }
    },
    token1Address: {
        type: DataTypes.STRING(42),
        allowNull: false,
        validate: {
            isLowercase: true,
            len: [42, 42]
        }
    },
    token1Symbol: {
        type: DataTypes.STRING(10),
        allowNull: false,
        validate: {
            isUppercase: true
        }
    },
    token1Name: {
        type: DataTypes.STRING(100),
        allowNull: false
    },
    token1Decimals: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 18,
        validate: {
            min: 0,
            max: 18
        }
    },
    chainId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 11155111 // Sepolia default
    },
    isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    liquidity: {
        type: DataTypes.STRING,
        defaultValue: '0'
    },
    volume24h: {
        type: DataTypes.STRING,
        defaultValue: '0'
    },
    fee: {
        type: DataTypes.INTEGER,
        defaultValue: 3000 // 0.3% default fee
    }
}, {
    sequelize,
    modelName: 'Pool',
    tableName: 'pools',
    timestamps: true,
    indexes: [
        {
            name: 'idx_pools_token0_symbol',
            fields: ['token0Symbol']
        },
        {
            name: 'idx_pools_token1_symbol',
            fields: ['token1Symbol']
        },
        {
            name: 'idx_pools_token0_address',
            fields: ['token0Address']
        },
        {
            name: 'idx_pools_token1_address',
            fields: ['token1Address']
        },
        {
            name: 'idx_pools_pair_address',
            fields: ['pairAddress']
        },
        {
            name: 'idx_pools_chain_active',
            fields: ['chainId', 'isActive']
        }
    ]
});

// Static method to search pools
Pool.searchPools = async function(query, limit = 20) {
    return this.findAll({
        where: {
            [Op.or]: [
                { token0Symbol: { [Op.iLike]: `%${query}%` } },
                { token1Symbol: { [Op.iLike]: `%${query}%` } },
                { token0Name: { [Op.iLike]: `%${query}%` } },
                { token1Name: { [Op.iLike]: `%${query}%` } },
                { token0Address: { [Op.iLike]: `${query}%` } },
                { token1Address: { [Op.iLike]: `${query}%` } },
                { pairAddress: { [Op.iLike]: `${query}%` } }
            ],
            isActive: true
        },
        limit: limit,
        order: [
            [sequelize.literal('CAST(liquidity AS NUMERIC)'), 'DESC'],
            [sequelize.literal('CAST(volume24h AS NUMERIC)'), 'DESC']
        ]
    });
};

export default Pool;

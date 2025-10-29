import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';

/**
 * Token 24h Stats Model
 * Aggregated statistics for trending tokens based on last 24h swaps
 */
class TokenStats24h extends Model {}

TokenStats24h.init({
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    tokenAddress: { 
        type: DataTypes.STRING(42), 
        allowNull: false,
        validate: {
            isLowercase: true,
            len: [42, 42]
        }
    },
    tokenSymbol: { 
        type: DataTypes.STRING(10), 
        allowNull: false,
        validate: {
            isUppercase: true
        }
    },
    tokenName: { 
        type: DataTypes.STRING(100), 
        allowNull: false
    },
    tokenDecimals: { 
        type: DataTypes.INTEGER, 
        allowNull: false, 
        defaultValue: 18 
    },
    chainId: { 
        type: DataTypes.INTEGER, 
        allowNull: false, 
        defaultValue: 11155111 
    },
    volume24hUSD: { 
        type: DataTypes.DECIMAL(20, 2), 
        allowNull: false, 
        defaultValue: 0 
    },
    trades24h: { 
        type: DataTypes.INTEGER, 
        allowNull: false, 
        defaultValue: 0 
    },
    priceUSD: { 
        type: DataTypes.DECIMAL(20, 6), 
        allowNull: false, 
        defaultValue: 0 
    },
    generatedAt: { 
        type: DataTypes.DATE, 
        allowNull: false, 
        defaultValue: DataTypes.NOW 
    }
}, {
    sequelize,
    modelName: 'TokenStats24h',
    tableName: 'token_stats_24h',
    timestamps: true,
    indexes: [
        {
            name: 'idx_token_stats_token_chain',
            fields: ['tokenAddress', 'chainId'],
            unique: true
        },
        {
            name: 'idx_token_stats_volume',
            fields: ['volume24hUSD']
        },
        {
            name: 'idx_token_stats_generated',
            fields: ['generatedAt']
        }
    ]
});

export default TokenStats24h;



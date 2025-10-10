import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const Token = sequelize.define('Token', {
    address: {
        type: DataTypes.STRING,
        primaryKey: true,
        allowNull: false
    },
    chainId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'chains',
            key: 'chain_id'
        }
    },
    symbol: {
        type: DataTypes.STRING,
        allowNull: false
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    decimals: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    listed: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    riskFlags: {
        type: DataTypes.JSONB,
        defaultValue: {}
    },
    logoURI: {
        type: DataTypes.STRING,
        allowNull: true
    },
    marketCap: {
        type: DataTypes.DECIMAL(30, 2),
        defaultValue: 0
    },
    volume24h: {
        type: DataTypes.DECIMAL(30, 2),
        defaultValue: 0
    },
    priceUsd: {
        type: DataTypes.DECIMAL(20, 6),
        defaultValue: 0
    },
    lastPriceUpdate: {
        type: DataTypes.DATE
    },
    coingeckoId: {
        type: DataTypes.STRING
    },
    isStablecoin: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    verified: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    blacklisted: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    blacklistReason: {
        type: DataTypes.STRING
    }
}, {
    tableName: 'tokens',
    timestamps: true,
    underscored: true,
    indexes: [
        {
            fields: ['chain_id']
        },
        {
            fields: ['symbol']
        },
        {
            fields: ['listed']
        }
    ]
});

export default Token;

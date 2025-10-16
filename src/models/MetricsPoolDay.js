import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const MetricsPoolDay = sequelize.define('MetricsPoolDay', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4
    },
    // Use pool address string as key to avoid FK type mismatches across environments
    poolId: {
        type: DataTypes.STRING,
        allowNull: false
    },
    date: {
        type: DataTypes.DATEONLY,
        allowNull: false
    },
    tvlUsd: {
        type: DataTypes.DECIMAL(30, 2),
        defaultValue: 0
    },
    volumeUsd: {
        type: DataTypes.DECIMAL(30, 2),
        defaultValue: 0
    },
    feesUsd: {
        type: DataTypes.DECIMAL(30, 2),
        defaultValue: 0
    },
    swapCount: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    uniqueUsers: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    avgSwapSize: {
        type: DataTypes.DECIMAL(30, 18),
        defaultValue: 0
    },
    priceChange24h: {
        type: DataTypes.DECIMAL(10, 6),
        defaultValue: 0
    },
    volatility24h: {
        type: DataTypes.DECIMAL(10, 6),
        defaultValue: 0
    }
}, {
    tableName: 'metrics_pool_day',
    timestamps: true,
    underscored: true,
    indexes: [
        {
            fields: ['pool_id']
        },
        {
            fields: ['date']
        },
        {
            fields: ['pool_id', 'date'],
            unique: true
        }
    ]
});

export default MetricsPoolDay;

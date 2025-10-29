import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const RiskPolicy = sequelize.define('RiskPolicy', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4
    },
    chainId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'chains',
            key: 'chain_id'
        }
    },
    maxSlippageBps: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 5000, // 50%
        validate: {
            min: 1,
            max: 10000
        }
    },
    maxTtlSec: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 86400, // 24 hours
        validate: {
            min: 60,
            max: 604800 // 7 days
        }
    },
    allowedFees: {
        type: DataTypes.ARRAY(DataTypes.INTEGER),
        allowNull: false,
        defaultValue: [500, 3000, 10000]
    },
    paused: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    maxAmountIn: {
        type: DataTypes.DECIMAL(30, 18),
        allowNull: true
    },
    maxAmountOut: {
        type: DataTypes.DECIMAL(30, 18),
        allowNull: true
    },
    dailySwapLimit: {
        type: DataTypes.DECIMAL(30, 18),
        allowNull: true
    },
    dailyVolumeLimit: {
        type: DataTypes.DECIMAL(30, 18),
        allowNull: true
    },
    whitelistedTokens: {
        type: DataTypes.ARRAY(DataTypes.STRING),
        defaultValue: []
    },
    blacklistedTokens: {
        type: DataTypes.ARRAY(DataTypes.STRING),
        defaultValue: []
    },
    whitelistedUsers: {
        type: DataTypes.ARRAY(DataTypes.STRING),
        defaultValue: []
    },
    blacklistedUsers: {
        type: DataTypes.ARRAY(DataTypes.STRING),
        defaultValue: []
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true
    }
}, {
    tableName: 'risk_policies',
    timestamps: true,
    underscored: true,
    indexes: [
        {
            fields: ['chain_id']
        },
        {
            fields: ['paused']
        }
    ]
});

export default RiskPolicy;

import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const TxPopulation = sequelize.define('TxPopulation', {
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
    requestId: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    payload: {
        type: DataTypes.JSONB,
        allowNull: false
    },
    estimatedGas: {
        type: DataTypes.STRING,
        allowNull: true
    },
    tokenIn: {
        type: DataTypes.STRING,
        allowNull: false
    },
    tokenOut: {
        type: DataTypes.STRING,
        allowNull: false
    },
    mode: {
        type: DataTypes.ENUM('EXACT_IN', 'EXACT_OUT'),
        allowNull: false
    },
    slippagePct: {
        type: DataTypes.DECIMAL(5, 4),
        allowNull: false
    },
    deadline: {
        type: DataTypes.DATE,
        allowNull: false
    },
    amountIn: {
        type: DataTypes.DECIMAL(30, 18),
        allowNull: true
    },
    amountOut: {
        type: DataTypes.DECIMAL(30, 18),
        allowNull: true
    },
    userAddress: {
        type: DataTypes.STRING,
        allowNull: true
    },
    clientIp: {
        type: DataTypes.STRING,
        allowNull: true
    },
    userAgent: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    status: {
        type: DataTypes.ENUM('generated', 'executed', 'expired', 'abandoned'),
        defaultValue: 'generated'
    },
    executedAt: {
        type: DataTypes.DATE,
        allowNull: true
    },
    txHash: {
        type: DataTypes.STRING,
        allowNull: true
    }
}, {
    tableName: 'tx_populations',
    timestamps: true,
    underscored: true,
    indexes: [
        {
            fields: ['chain_id']
        },
        {
            fields: ['request_id']
        },
        {
            fields: ['user_address']
        },
        {
            fields: ['status']
        },
        {
            fields: ['created_at']
        }
    ]
});

export default TxPopulation;

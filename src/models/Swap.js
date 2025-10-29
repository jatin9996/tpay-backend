import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const Swap = sequelize.define('Swap', {
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
    mode: {
        type: DataTypes.ENUM('EXACT_IN', 'EXACT_OUT'),
        allowNull: false
    },
    tokenIn: {
        type: DataTypes.STRING,
        allowNull: false
    },
    tokenOut: {
        type: DataTypes.STRING,
        allowNull: false
    },
    recipient: {
        type: DataTypes.STRING,
        allowNull: false
    },
    feeTier: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: {
            isIn: [[500, 3000, 10000]]
        }
    },
    slippagePct: {
        type: DataTypes.DECIMAL(5, 4),
        allowNull: false,
        validate: {
            min: 0,
            max: 1
        }
    },
    ttlSec: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: {
            min: 1,
            max: 86400 // 24 hours
        }
    },
    deadline: {
        type: DataTypes.DATE,
        allowNull: false
    },
    amountIn: {
        type: DataTypes.DECIMAL(30, 18),
        allowNull: false
    },
    amountInWei: {
        type: DataTypes.STRING,
        allowNull: false
    },
    expectedOut: {
        type: DataTypes.DECIMAL(30, 18),
        allowNull: false
    },
    minOut: {
        type: DataTypes.DECIMAL(30, 18),
        allowNull: false
    },
    requiredIn: {
        type: DataTypes.DECIMAL(30, 18),
        allowNull: true // Only for EXACT_OUT mode
    },
    maxIn: {
        type: DataTypes.DECIMAL(30, 18),
        allowNull: true // Only for EXACT_OUT mode
    },
    txHash: {
        type: DataTypes.STRING,
        allowNull: true
    },
    status: {
        type: DataTypes.ENUM('pending', 'completed', 'failed', 'cancelled'),
        defaultValue: 'pending'
    },
    errorMsg: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    gasUsed: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    gasPrice: {
        type: DataTypes.STRING,
        allowNull: true
    },
    blockNumber: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    confirmations: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    isCustodial: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    userAddress: {
        type: DataTypes.STRING,
        allowNull: true
    },
    clientRequestId: {
        type: DataTypes.STRING,
        allowNull: true
    },
    metadata: {
        type: DataTypes.JSONB,
        defaultValue: {}
    }
}, {
    tableName: 'swaps',
    timestamps: true,
    underscored: true,
    indexes: [
        {
            fields: ['chain_id']
        },
        {
            fields: ['status']
        },
        {
            fields: ['tx_hash']
        },
        {
            fields: ['user_address']
        },
        {
            fields: ['created_at']
        },
        {
            fields: ['client_request_id']
        }
    ]
});

export default Swap;

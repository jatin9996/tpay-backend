import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const Transaction = sequelize.define('Transaction', {
    txHash: {
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
    fromAddress: {
        type: DataTypes.STRING,
        allowNull: false
    },
    toAddress: {
        type: DataTypes.STRING,
        allowNull: false
    },
    gasLimit: {
        type: DataTypes.INTEGER,
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
    status: {
        type: DataTypes.ENUM('pending', 'confirmed', 'failed'),
        defaultValue: 'pending'
    },
    blockNumber: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    blockHash: {
        type: DataTypes.STRING,
        allowNull: true
    },
    confirmations: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    raw: {
        type: DataTypes.JSONB,
        defaultValue: {}
    },
    error: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    fee: {
        type: DataTypes.STRING,
        allowNull: true
    },
    value: {
        type: DataTypes.STRING,
        allowNull: true
    },
    nonce: {
        type: DataTypes.INTEGER,
        allowNull: true
    }
}, {
    tableName: 'transactions',
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
            fields: ['from_address']
        },
        {
            fields: ['to_address']
        },
        {
            fields: ['block_number']
        },
        {
            fields: ['created_at']
        }
    ]
});

export default Transaction;

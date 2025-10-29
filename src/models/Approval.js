import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const Approval = sequelize.define('Approval', {
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
    owner: {
        type: DataTypes.STRING,
        allowNull: false
    },
    spender: {
        type: DataTypes.STRING,
        allowNull: false
    },
    token: {
        type: DataTypes.STRING,
        allowNull: false
    },
    amount: {
        type: DataTypes.STRING,
        allowNull: false
    },
    txHash: {
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
    allowance: {
        type: DataTypes.STRING,
        allowNull: true
    },
    isInfinite: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    }
}, {
    tableName: 'approvals',
    timestamps: true,
    underscored: true,
    indexes: [
        {
            fields: ['chain_id']
        },
        {
            fields: ['owner']
        },
        {
            fields: ['spender']
        },
        {
            fields: ['token']
        },
        {
            fields: ['tx_hash']
        },
        {
            fields: ['status']
        }
    ]
});

export default Approval;

import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

// Notification model to power frontend tabs: Transactions, Governance, System Alerts, Promotions
// Supports both global notifications (no userAddress) and user-specific notifications
const Notification = sequelize.define('Notification', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4
    },
    // Optional address to scope notification to a user; null means global
    userAddress: {
        type: DataTypes.STRING,
        allowNull: true
    },
    category: {
        type: DataTypes.ENUM('TRANSACTION', 'GOVERNANCE', 'SYSTEM', 'PROMOTION'),
        allowNull: false
    },
    severity: {
        type: DataTypes.ENUM('success', 'info', 'warning', 'error'),
        allowNull: false,
        defaultValue: 'info'
    },
    title: {
        type: DataTypes.STRING,
        allowNull: false
    },
    message: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    // Action metadata for CTA buttons on frontend
    actionLabel: {
        type: DataTypes.STRING,
        allowNull: true
    },
    actionUrl: {
        type: DataTypes.STRING,
        allowNull: true
    },
    // For transaction notifications, optionally link a tx hash
    txHash: {
        type: DataTypes.STRING,
        allowNull: true
    },
    read: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    metadata: {
        type: DataTypes.JSONB,
        defaultValue: {}
    }
}, {
    tableName: 'notifications',
    timestamps: true,
    underscored: true,
    indexes: [
        { fields: ['user_address'] },
        { fields: ['category'] },
        { fields: ['created_at'] },
        { fields: ['read'] }
    ]
});

export default Notification;



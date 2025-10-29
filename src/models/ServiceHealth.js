import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const ServiceHealth = sequelize.define('ServiceHealth', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4
    },
    service: {
        type: DataTypes.STRING,
        allowNull: false
    },
    ok: {
        type: DataTypes.BOOLEAN,
        allowNull: false
    },
    details: {
        type: DataTypes.JSONB,
        defaultValue: {}
    },
    responseTime: {
        type: DataTypes.INTEGER, // milliseconds
        allowNull: true
    },
    error: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    version: {
        type: DataTypes.STRING,
        allowNull: true
    },
    environment: {
        type: DataTypes.STRING,
        defaultValue: 'production'
    },
    timestamp: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'service_health',
    timestamps: true,
    underscored: true,
    indexes: [
        {
            fields: ['service']
        },
        {
            fields: ['ok']
        },
        {
            fields: ['timestamp']
        },
        {
            fields: ['service', 'timestamp']
        }
    ]
});

export default ServiceHealth;

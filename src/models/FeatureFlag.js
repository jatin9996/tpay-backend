import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const FeatureFlag = sequelize.define('FeatureFlag', {
    key: {
        type: DataTypes.STRING,
        primaryKey: true,
        allowNull: false
    },
    value: {
        type: DataTypes.JSONB,
        allowNull: false
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    environment: {
        type: DataTypes.STRING,
        defaultValue: 'production',
        validate: {
            isIn: [['development', 'staging', 'production']]
        }
    },
    updatedBy: {
        type: DataTypes.STRING,
        allowNull: true
    }
}, {
    tableName: 'feature_flags',
    timestamps: true,
    underscored: true,
    indexes: [
        {
            fields: ['is_active']
        },
        {
            fields: ['environment']
        }
    ]
});

export default FeatureFlag;

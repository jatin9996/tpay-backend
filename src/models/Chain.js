import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const Chain = sequelize.define('Chain', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    chainId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        unique: true
    },
    rpcUrl: {
        type: DataTypes.STRING,
        allowNull: false
    },
    routerAddress: {
        type: DataTypes.STRING,
        allowNull: false
    },
    quoterAddress: {
        type: DataTypes.STRING,
        allowNull: false
    },
    nativeWrappedAddress: {
        type: DataTypes.STRING,
        allowNull: false
    },
    isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    blockTime: {
        type: DataTypes.INTEGER,
        defaultValue: 12
    },
    explorerUrl: {
        type: DataTypes.STRING
    }
}, {
    tableName: 'chains',
    timestamps: true,
    underscored: true
});

export default Chain;

import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const Pool = sequelize.define('Pool', {
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
    token0: {
        type: DataTypes.STRING,
        allowNull: false
    },
    token1: {
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
    poolAddress: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    tickSpacing: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    sqrtPriceX96: {
        type: DataTypes.STRING,
        allowNull: true
    },
    liquidity: {
        type: DataTypes.STRING,
        allowNull: true
    },
    reserve0: {
        type: DataTypes.STRING,
        allowNull: true
    },
    reserve1: {
        type: DataTypes.STRING,
        allowNull: true
    },
    price0: {
        type: DataTypes.DECIMAL(30, 18),
        allowNull: true
    },
    price1: {
        type: DataTypes.DECIMAL(30, 18),
        allowNull: true
    },
    volume24h: {
        type: DataTypes.DECIMAL(30, 18),
        defaultValue: 0
    },
    tvl: {
        type: DataTypes.DECIMAL(30, 18),
        defaultValue: 0
    },
    fees24h: {
        type: DataTypes.DECIMAL(30, 18),
        defaultValue: 0
    },
    isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    lastUpdate: {
        type: DataTypes.DATE,
        allowNull: true
    },
    metadata: {
        type: DataTypes.JSONB,
        defaultValue: {}
    }
}, {
    tableName: 'pools',
    timestamps: true,
    underscored: true,
    indexes: [
        {
            fields: ['chain_id']
        },
        {
            fields: ['token0']
        },
        {
            fields: ['token1']
        },
        {
            fields: ['fee_tier']
        },
        {
            fields: ['pool_address']
        },
        {
            fields: ['is_active']
        }
    ]
});

export default Pool;

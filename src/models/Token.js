import { DataTypes, Model, Op, Sequelize } from 'sequelize';
import { sequelize } from '../config/database.js';

/**
 * Token Model
 * Represents ERC-20 tokens in the system
 */
class Token extends Model {}

Token.init({
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    address: {
        type: DataTypes.STRING(42), // Ethereum address length
        allowNull: false,
        unique: true,
        validate: {
            isLowercase: true,
            len: [42, 42] // Ethereum address length
        }
    },
    symbol: {
        type: DataTypes.STRING(10),
        allowNull: false,
        validate: {
            isUppercase: true
        }
    },
    name: {
        type: DataTypes.STRING(100),
        allowNull: false
    },
    decimals: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 18,
        validate: {
            min: 0,
            max: 18
        }
    },
    totalSupply: {
        type: DataTypes.STRING,
        allowNull: true
    },
    chainId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 11155111 // Sepolia default
    },
    isEssential: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    }
}, {
    sequelize,
    modelName: 'Token',
    tableName: 'tokens',
    timestamps: true,
    indexes: [
        {
            name: 'idx_tokens_symbol_name_address',
            fields: ['symbol', 'name', 'address']
        },
        {
            name: 'idx_tokens_chain_active',
            fields: ['chainId', 'isActive']
        },
        {
            name: 'idx_tokens_address_lower',
            fields: [Sequelize.fn('LOWER', Sequelize.col('address'))]
        }
    ]
});

// Static method to search tokens
Token.searchTokens = async function(query, limit = 20) {
    return this.findAll({
        where: {
            [Op.or]: [
                { symbol: { [Op.iLike]: `%${query}%` } },
                { name: { [Op.iLike]: `%${query}%` } },
                { address: { [Op.iLike]: `${query}%` } }
            ],
            isActive: true
        },
        limit: limit,
        order: [
            ['isEssential', 'DESC'],
            ['symbol', 'ASC']
        ]
    });
};

export default Token;

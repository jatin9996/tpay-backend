import mongoose from 'mongoose';

/**
 * Pool Schema
 * Represents liquidity pools/pairs in the system
 */
const poolSchema = new mongoose.Schema({
    pairAddress: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    token0: {
        address: {
            type: String,
            required: true,
            lowercase: true,
            trim: true
        },
        symbol: {
            type: String,
            required: true,
            uppercase: true,
            trim: true
        },
        name: {
            type: String,
            required: true,
            trim: true
        },
        decimals: {
            type: Number,
            required: true,
            default: 18
        }
    },
    token1: {
        address: {
            type: String,
            required: true,
            lowercase: true,
            trim: true
        },
        symbol: {
            type: String,
            required: true,
            uppercase: true,
            trim: true
        },
        name: {
            type: String,
            required: true,
            trim: true
        },
        decimals: {
            type: Number,
            required: true,
            default: 18
        }
    },
    chainId: {
        type: Number,
        required: true,
        default: 11155111 // Sepolia default
    },
    isActive: {
        type: Boolean,
        default: true
    },
    liquidity: {
        type: String,
        default: '0'
    },
    volume24h: {
        type: String,
        default: '0'
    },
    fee: {
        type: Number,
        default: 3000 // 0.3% default fee
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Create compound indexes for search optimization
poolSchema.index({ 'token0.symbol': 1, 'token1.symbol': 1 });
poolSchema.index({ 'token0.address': 1, 'token1.address': 1 });
poolSchema.index({ pairAddress: 1 });
poolSchema.index({ chainId: 1, isActive: 1 });
poolSchema.index({ 'token0.symbol': 'text', 'token1.symbol': 'text' });

// Pre-save middleware to update timestamps
poolSchema.pre('save', function(next) {
    this.updatedAt = new Date();
    next();
});

// Static method to search pools
poolSchema.statics.searchPools = async function(query, limit = 20) {
    const searchRegex = new RegExp(query, 'i');
    
    return this.find({
        $or: [
            { 'token0.symbol': searchRegex },
            { 'token1.symbol': searchRegex },
            { 'token0.name': searchRegex },
            { 'token1.name': searchRegex },
            { 'token0.address': { $regex: `^${query}`, $options: 'i' } },
            { 'token1.address': { $regex: `^${query}`, $options: 'i' } },
            { pairAddress: { $regex: `^${query}`, $options: 'i' } }
        ],
        isActive: true
    })
    .limit(limit)
    .sort({ liquidity: -1, volume24h: -1 }) // Sort by liquidity and volume
    .lean();
};

const Pool = mongoose.model('Pool', poolSchema);

export default Pool;

import mongoose from 'mongoose';

/**
 * Token Schema
 * Represents ERC-20 tokens in the system
 */
const tokenSchema = new mongoose.Schema({
    address: {
        type: String,
        required: true,
        unique: true,
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
    },
    totalSupply: {
        type: String,
        required: false
    },
    chainId: {
        type: Number,
        required: true,
        default: 11155111 // Sepolia default
    },
    isEssential: {
        type: Boolean,
        default: false
    },
    isActive: {
        type: Boolean,
        default: true
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
tokenSchema.index({ symbol: 1, name: 1, address: 1 });
tokenSchema.index({ symbol: 'text', name: 'text' });
tokenSchema.index({ chainId: 1, isActive: 1 });

// Pre-save middleware to update timestamps
tokenSchema.pre('save', function(next) {
    this.updatedAt = new Date();
    next();
});

// Static method to search tokens
tokenSchema.statics.searchTokens = async function(query, limit = 20) {
    const searchRegex = new RegExp(query, 'i');
    
    return this.find({
        $or: [
            { symbol: searchRegex },
            { name: searchRegex },
            { address: { $regex: `^${query}`, $options: 'i' } }
        ],
        isActive: true
    })
    .limit(limit)
    .sort({ isEssential: -1, symbol: 1 }) // Essential tokens first, then alphabetically
    .lean();
};

const Token = mongoose.model('Token', tokenSchema);

export default Token;

import mongoose from 'mongoose';

/**
 * Token 24h Stats Schema
 * Aggregated statistics for trending tokens based on last 24h swaps
 */
const tokenStats24hSchema = new mongoose.Schema({
    token: {
        address: { type: String, required: true, lowercase: true, trim: true },
        symbol: { type: String, required: true, uppercase: true, trim: true },
        name: { type: String, required: true, trim: true },
        decimals: { type: Number, required: true, default: 18 }
    },
    chainId: { type: Number, required: true, default: 11155111 },
    volume24hUSD: { type: Number, required: true, default: 0 },
    trades24h: { type: Number, required: true, default: 0 },
    priceUSD: { type: Number, required: true, default: 0 },
    generatedAt: { type: Date, required: true, default: Date.now }
}, {
    timestamps: true
});

// Indexes for fast lookups and sorting
tokenStats24hSchema.index({ 'token.address': 1, chainId: 1 }, { unique: true });
tokenStats24hSchema.index({ volume24hUSD: -1 });
tokenStats24hSchema.index({ generatedAt: -1 });

const TokenStats24h = mongoose.model('TokenStats24h', tokenStats24hSchema, 'token_stats_24h');

export default TokenStats24h;



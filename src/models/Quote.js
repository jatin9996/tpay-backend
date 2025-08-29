import mongoose from 'mongoose';

/**
 * Quote Schema
 * Stores generated quotes with a TTL for later retrieval/analytics
 */
const quoteSchema = new mongoose.Schema({
    chainId: { type: Number, required: true },
    tokenIn: { type: String, required: true, lowercase: true, trim: true },
    tokenOut: { type: String, required: true, lowercase: true, trim: true },
    amountIn: { type: String, required: true },
    amountOut: { type: String, required: true },
    mode: { 
        type: String, 
        required: true, 
        enum: ['EXACT_IN', 'EXACT_OUT'], 
        default: 'EXACT_IN' 
    },
    route: [{
        tokenIn: { type: String, required: true, lowercase: true, trim: true },
        tokenOut: { type: String, required: true, lowercase: true, trim: true },
        fee: { type: Number, required: true }
    }],
    path: { type: String, required: true },
    amountOutMinimum: { type: String, required: true },
    priceImpactPct: { type: String, required: false },
    estimatedGas: { type: String, required: false },
    quoteId: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true }
}, {
    timestamps: true
});

// TTL index: automatically remove after expiresAt
quoteSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const Quote = mongoose.model('Quote', quoteSchema, 'quotes');

export default Quote;



import mongoose from 'mongoose';

/**
 * Swap Schema
 * Stores executed swap transactions for history tracking and analytics
 */
const swapSchema = new mongoose.Schema({
    chainId: { type: Number, required: true },
    txHash: { type: String, required: true, unique: true },
    tokenIn: { type: String, required: true, lowercase: true, trim: true },
    tokenOut: { type: String, required: true, lowercase: true, trim: true },
    amountIn: { type: String, required: true },
    amountInWei: { type: String, required: true },
    amountOut: { type: String, required: true },
    amountOutMinimum: { type: String, required: true },
    recipient: { type: String, required: true, lowercase: true, trim: true },
    fee: { type: Number, required: true },
    slippageTolerance: { type: Number, required: true },
    deadline: { type: Number, required: true },
    ttlSec: { type: Number, required: true },
    mode: { 
        type: String, 
        required: true, 
        enum: ['EXACT_IN', 'EXACT_OUT'], 
        default: 'EXACT_IN' 
    },
    status: { 
        type: String, 
        required: true, 
        enum: ['pending', 'completed', 'failed'], 
        default: 'pending' 
    },
    estimatedGas: { type: String, required: false },
    actualGasUsed: { type: String, required: false },
    gasPrice: { type: String, required: false },
    blockNumber: { type: Number, required: false },
    route: [{
        tokenIn: { type: String, required: true, lowercase: true, trim: true },
        tokenOut: { type: String, required: true, lowercase: true, trim: true },
        fee: { type: Number, required: true }
    }],
    path: { type: String, required: false },
    quoteId: { type: String, required: false },
    errorMessage: { type: String, required: false }
}, {
    timestamps: true
});

// Indexes for efficient querying
swapSchema.index({ chainId: 1, status: 1 });
swapSchema.index({ tokenIn: 1, tokenOut: 1 });
swapSchema.index({ recipient: 1 });
swapSchema.index({ txHash: 1 }, { unique: true });
swapSchema.index({ createdAt: 1 });

const Swap = mongoose.model('Swap', swapSchema, 'swaps');

export default Swap;

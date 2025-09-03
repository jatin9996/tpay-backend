import { sequelize } from '../config/database.js';
import Swap from '../models/Swap.js';
import Transaction from '../models/Transaction.js';
import Approval from '../models/Approval.js';
import TxPopulation from '../models/TxPopulation.js';
import RiskPolicy from '../models/RiskPolicy.js';
import FeatureFlag from '../models/FeatureFlag.js';
import { Op } from 'sequelize';

/**
 * Swap Database Service
 * Handles all database operations related to swaps, transactions, and approvals
 */
class SwapDatabaseService {
    
    /**
     * Create a new swap record
     */
    async createSwap(swapData) {
        try {
            const swap = await Swap.create({
                chainId: swapData.chainId,
                mode: swapData.mode,
                tokenIn: swapData.tokenIn,
                tokenOut: swapData.tokenOut,
                recipient: swapData.recipient,
                feeTier: swapData.feeTier,
                slippagePct: swapData.slippagePct,
                ttlSec: swapData.ttlSec,
                deadline: swapData.deadline,
                amountIn: swapData.amountIn,
                amountInWei: swapData.amountInWei,
                expectedOut: swapData.expectedOut,
                minOut: swapData.minOut,
                requiredIn: swapData.requiredIn,
                maxIn: swapData.maxIn,
                isCustodial: swapData.isCustodial || false,
                userAddress: swapData.userAddress,
                clientRequestId: swapData.clientRequestId,
                metadata: swapData.metadata || {}
            });
            
            return swap;
        } catch (error) {
            console.error('Error creating swap record:', error);
            throw new Error(`Failed to create swap record: ${error.message}`);
        }
    }
    
    /**
     * Update swap status and transaction details
     */
    async updateSwapStatus(swapId, status, txHash = null, additionalData = {}) {
        try {
            const updateData = {
                status,
                ...additionalData
            };
            
            if (txHash) {
                updateData.txHash = txHash;
            }
            
            const [updatedCount] = await Swap.update(updateData, {
                where: { id: swapId }
            });
            
            if (updatedCount === 0) {
                throw new Error(`Swap with ID ${swapId} not found`);
            }
            
            return await Swap.findByPk(swapId);
        } catch (error) {
            console.error('Error updating swap status:', error);
            throw new Error(`Failed to update swap status: ${error.message}`);
        }
    }
    
    /**
     * Create or update transaction record
     */
    async upsertTransaction(txData) {
        try {
            const [transaction, created] = await Transaction.findOrCreate({
                where: { txHash: txData.txHash },
                defaults: {
                    chainId: txData.chainId,
                    fromAddress: txData.fromAddress,
                    toAddress: txData.toAddress,
                    gasLimit: txData.gasLimit,
                    gasUsed: txData.gasUsed,
                    gasPrice: txData.gasPrice,
                    status: txData.status || 'pending',
                    blockNumber: txData.blockNumber,
                    blockHash: txData.blockHash,
                    confirmations: txData.confirmations || 0,
                    raw: txData.raw || {},
                    error: txData.error,
                    fee: txData.fee,
                    value: txData.value,
                    nonce: txData.nonce
                }
            });
            
            if (!created) {
                // Update existing transaction
                await transaction.update(txData);
            }
            
            return transaction;
        } catch (error) {
            console.error('Error upserting transaction:', error);
            throw new Error(`Failed to upsert transaction: ${error.message}`);
        }
    }
    
    /**
     * Create approval record
     */
    async createApproval(approvalData) {
        try {
            const approval = await Approval.create({
                chainId: approvalData.chainId,
                owner: approvalData.owner,
                spender: approvalData.spender,
                token: approvalData.token,
                amount: approvalData.amount,
                txHash: approvalData.txHash,
                status: approvalData.status || 'pending',
                blockNumber: approvalData.blockNumber,
                allowance: approvalData.allowance,
                isInfinite: approvalData.isInfinite || false
            });
            
            return approval;
        } catch (error) {
            console.error('Error creating approval record:', error);
            throw new Error(`Failed to create approval record: ${error.message}`);
        }
    }
    
    /**
     * Create transaction population record
     */
    async createTxPopulation(populationData) {
        try {
            const population = await TxPopulation.create({
                chainId: populationData.chainId,
                requestId: populationData.requestId,
                payload: populationData.payload,
                estimatedGas: populationData.estimatedGas,
                tokenIn: populationData.tokenIn,
                tokenOut: populationData.tokenOut,
                mode: populationData.mode,
                slippagePct: populationData.slippagePct,
                deadline: populationData.deadline,
                amountIn: populationData.amountIn,
                amountOut: populationData.amountOut,
                userAddress: populationData.userAddress,
                clientIp: populationData.clientIp,
                userAgent: populationData.userAgent,
                status: 'generated'
            });
            
            return population;
        } catch (error) {
            console.error('Error creating transaction population:', error);
            throw new Error(`Failed to create transaction population: ${error.message}`);
        }
    }
    
    /**
     * Update transaction population status
     */
    async updateTxPopulationStatus(requestId, status, txHash = null) {
        try {
            const updateData = { status };
            if (txHash) {
                updateData.txHash = txHash;
                updateData.executedAt = new Date();
            }
            
            const [updatedCount] = await TxPopulation.update(updateData, {
                where: { requestId }
            });
            
            if (updatedCount === 0) {
                throw new Error(`Transaction population with request ID ${requestId} not found`);
            }
            
            return await TxPopulation.findOne({ where: { requestId } });
        } catch (error) {
            console.error('Error updating transaction population status:', error);
            throw new Error(`Failed to update transaction population status: ${error.message}`);
        }
    }
    
    /**
     * Get swap by ID with related data
     */
    async getSwapById(swapId) {
        try {
            const swap = await Swap.findByPk(swapId, {
                include: [
                    { model: Transaction, as: 'transaction' },
                    { model: Token, as: 'tokenInToken' },
                    { model: Token, as: 'tokenOutToken' }
                ]
            });
            
            return swap;
        } catch (error) {
            console.error('Error getting swap by ID:', error);
            throw new Error(`Failed to get swap: ${error.message}`);
        }
    }
    
    /**
     * Get swaps by user address
     */
    async getSwapsByUser(userAddress, limit = 50, offset = 0) {
        try {
            const swaps = await Swap.findAndCountAll({
                where: { userAddress },
                limit,
                offset,
                order: [['createdAt', 'DESC']],
                include: [
                    { model: Transaction, as: 'transaction' },
                    { model: Token, as: 'tokenInToken' },
                    { model: Token, as: 'tokenOutToken' }
                ]
            });
            
            return swaps;
        } catch (error) {
            console.error('Error getting swaps by user:', error);
            throw new Error(`Failed to get user swaps: ${error.message}`);
        }
    }
    
    /**
     * Get swap statistics for a time period
     */
    async getSwapStats(chainId = null, timeRange = '24h') {
        try {
            const now = new Date();
            let startDate;
            
            switch(timeRange) {
                case '1h':
                    startDate = new Date(now - 60 * 60 * 1000);
                    break;
                case '24h':
                    startDate = new Date(now - 24 * 60 * 60 * 1000);
                    break;
                case '7d':
                    startDate = new Date(now - 7 * 24 * 60 * 60 * 1000);
                    break;
                case '30d':
                    startDate = new Date(now - 30 * 24 * 60 * 60 * 1000);
                    break;
                default:
                    startDate = new Date(now - 24 * 60 * 60 * 1000);
            }
            
            const whereClause = {
                createdAt: { [Op.gte]: startDate }
            };
            
            if (chainId) {
                whereClause.chainId = chainId;
            }
            
            const stats = await Swap.findAll({
                where: whereClause,
                attributes: [
                    'status',
                    [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
                    [sequelize.fn('SUM', sequelize.cast(sequelize.col('amountIn'), 'NUMERIC')), 'totalAmountIn'],
                    [sequelize.fn('SUM', sequelize.cast(sequelize.col('expectedOut'), 'NUMERIC')), 'totalAmountOut']
                ],
                group: ['status']
            });
            
            return stats;
        } catch (error) {
            console.error('Error getting swap statistics:', error);
            throw new Error(`Failed to get swap statistics: ${error.message}`);
        }
    }
    
    /**
     * Check if client request ID already exists (for idempotency)
     */
    async checkClientRequestId(clientRequestId) {
        try {
            const existingSwap = await Swap.findOne({
                where: { clientRequestId }
            });
            
            const existingPopulation = await TxPopulation.findOne({
                where: { requestId: clientRequestId }
            });
            
            return {
                swapExists: !!existingSwap,
                populationExists: !!existingPopulation,
                existingSwap,
                existingPopulation
            };
        } catch (error) {
            console.error('Error checking client request ID:', error);
            throw new Error(`Failed to check client request ID: ${error.message}`);
        }
    }
    
    /**
     * Get risk policy for a chain
     */
    async getRiskPolicy(chainId) {
        try {
            const policy = await RiskPolicy.findOne({
                where: { chainId }
            });
            
            if (!policy) {
                throw new Error(`No risk policy found for chain ${chainId}`);
            }
            
            return policy;
        } catch (error) {
            console.error('Error getting risk policy:', error);
            throw new Error(`Failed to get risk policy: ${error.message}`);
        }
    }
    
    /**
     * Check if feature is enabled
     */
    async isFeatureEnabled(featureKey) {
        try {
            const feature = await FeatureFlag.findOne({
                where: { key: featureKey, isActive: true }
            });
            
            return feature && feature.value?.enabled === true;
        } catch (error) {
            console.error('Error checking feature flag:', error);
            return false; // Default to disabled if error
        }
    }

    /**
     * Get supported tokens for frontend
     */
    async getSupportedTokens(chainId) {
        try {
            const tokens = await Token.findAll({
                where: { 
                    chainId: parseInt(chainId),
                    isActive: true,
                    blacklisted: false
                },
                order: [['volume24h', 'DESC']]
            });
            
            return tokens;
        } catch (error) {
            console.error('Error getting supported tokens:', error);
            throw new Error(`Failed to get supported tokens: ${error.message}`);
        }
    }

    /**
     * Get token by address
     */
    async getTokenByAddress(address, chainId) {
        try {
            const token = await Token.findOne({
                where: { 
                    address: address.toLowerCase(),
                    chainId: parseInt(chainId)
                }
            });
            
            return token;
        } catch (error) {
            console.error('Error getting token by address:', error);
            throw new Error(`Failed to get token: ${error.message}`);
        }
    }

    /**
     * Execute swap with enhanced error handling
     */
    async executeSwap(swapData, requestInfo) {
        try {
            // Create swap record
            const swap = await this.createSwap({
                ...swapData,
                isCustodial: false, // Frontend swaps are non-custodial
                userAddress: requestInfo.userAddress,
                clientRequestId: swapData.clientRequestId || `frontend_${Date.now()}`
            });

            // Return swap record for frontend
            return swap;
        } catch (error) {
            console.error('Error executing swap:', error);
            throw new Error(`Failed to execute swap: ${error.message}`);
        }
    }

    /**
     * Get user swaps with filtering
     */
    async getUserSwaps(userAddress, options = {}) {
        try {
            const { limit = 20, offset = 0, status } = options;
            
            const whereClause = { userAddress: userAddress.toLowerCase() };
            if (status) {
                whereClause.status = status;
            }

            const swaps = await Swap.findAndCountAll({
                where: whereClause,
                limit,
                offset,
                order: [['createdAt', 'DESC']],
                include: [
                    { model: Transaction, as: 'transaction' }
                ]
            });
            
            return swaps;
        } catch (error) {
            console.error('Error getting user swaps:', error);
            throw new Error(`Failed to get user swaps: ${error.message}`);
        }
    }

    /**
     * Get token statistics
     */
    async getTokenStats(chainId, timeRange = '24h') {
        try {
            const now = new Date();
            let startDate;
            
            switch(timeRange) {
                case '1h':
                    startDate = new Date(now - 60 * 60 * 1000);
                    break;
                case '24h':
                    startDate = new Date(now - 24 * 60 * 60 * 1000);
                    break;
                case '7d':
                    startDate = new Date(now - 7 * 24 * 60 * 60 * 1000);
                    break;
                case '30d':
                    startDate = new Date(now - 30 * 24 * 60 * 60 * 1000);
                    break;
                default:
                    startDate = new Date(now - 24 * 60 * 60 * 1000);
            }

            const whereClause = {
                createdAt: { [Op.gte]: startDate }
            };
            
            if (chainId) {
                whereClause.chainId = parseInt(chainId);
            }

            const stats = await Swap.findAll({
                where: whereClause,
                attributes: [
                    [sequelize.fn('COUNT', sequelize.col('id')), 'totalSwaps'],
                    [sequelize.fn('SUM', sequelize.cast(sequelize.col('amountIn'), 'NUMERIC')), 'totalVolumeIn'],
                    [sequelize.fn('SUM', sequelize.cast(sequelize.col('expectedOut'), 'NUMERIC')), 'totalVolumeOut']
                ]
            });

            return stats[0] || { totalSwaps: 0, totalVolumeIn: 0, totalVolumeOut: 0 };
        } catch (error) {
            console.error('Error getting token stats:', error);
            throw new Error(`Failed to get token stats: ${error.message}`);
        }
    }

    /**
     * Get quote statistics
     */
    async getQuoteStats(chainId, timeRange = '24h') {
        try {
            const now = new Date();
            let startDate;
            
            switch(timeRange) {
                case '1h':
                    startDate = new Date(now - 60 * 60 * 1000);
                    break;
                case '24h':
                    startDate = new Date(now - 24 * 60 * 60 * 1000);
                    break;
                case '7d':
                    startDate = new Date(now - 7 * 24 * 60 * 60 * 1000);
                    break;
                case '30d':
                    startDate = new Date(now - 30 * 24 * 60 * 60 * 1000);
                    break;
                default:
                    startDate = new Date(now - 24 * 60 * 60 * 1000);
            }

            const whereClause = {
                createdAt: { [Op.gte]: startDate }
            };
            
            if (chainId) {
                whereClause.chainId = chainId;
            }

            const stats = await Quote.findAll({
                where: whereClause,
                attributes: [
                    [sequelize.fn('COUNT', sequelize.col('id')), 'totalQuotes'],
                    [sequelize.fn('COUNT', sequelize.literal('CASE WHEN status = \'used\' THEN 1 END')), 'usedQuotes'],
                    [sequelize.fn('COUNT', sequelize.literal('CASE WHEN status = \'expired\' THEN 1 END')), 'expiredQuotes']
                ]
            });

            return stats[0] || { totalQuotes: 0, usedQuotes: 0, expiredQuotes: 0 };
        } catch (error) {
            console.error('Error getting quote stats:', error);
            throw new Error(`Failed to get quote stats: ${error.message}`);
        }
    }
}

export default new SwapDatabaseService();

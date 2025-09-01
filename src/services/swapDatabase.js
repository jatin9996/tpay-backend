import Swap from '../models/Swap.js';
import Quote from '../models/Quote.js';
import SwapAnalytics from '../models/SwapAnalytics.js';
import { Op } from 'sequelize';

/**
 * Swap Database Service
 * Handles all database operations related to swaps, quotes, and analytics
 * Updated to use Sequelize with PostgreSQL
 */

class SwapDatabaseService {
    
    /**
     * Create a new swap record
     * @param {Object} swapData - Swap data to store
     * @returns {Promise<Object>} Created swap record
     */
    async createSwap(swapData) {
        try {
            const swap = await Swap.create(swapData);
            console.log(`✅ Swap record created: ${swap.txHash}`);
            return swap;
        } catch (error) {
            console.error('❌ Error creating swap record:', error);
            throw error;
        }
    }
    
    /**
     * Update swap status
     * @param {string} txHash - Transaction hash
     * @param {string} status - New status
     * @param {Object} additionalData - Additional data to update
     * @returns {Promise<Object>} Updated swap record
     */
    async updateSwapStatus(txHash, status, additionalData = {}) {
        try {
            const updateData = { status, ...additionalData };
            
            if (status === 'completed') {
                updateData.confirmedAt = new Date();
            }
            
            const [updatedCount] = await Swap.update(updateData, {
                where: { txHash },
                returning: true
            });
            
            if (updatedCount === 0) {
                throw new Error(`Swap with txHash ${txHash} not found`);
            }
            
            const updatedSwap = await Swap.findOne({ where: { txHash } });
            console.log(`✅ Swap status updated: ${txHash} -> ${status}`);
            return updatedSwap;
        } catch (error) {
            console.error('❌ Error updating swap status:', error);
            throw error;
        }
    }
    
    /**
     * Get swap by transaction hash
     * @param {string} txHash - Transaction hash
     * @returns {Promise<Object|null>} Swap record or null
     */
    async getSwapByTxHash(txHash) {
        try {
            return await Swap.findOne({ where: { txHash } });
        } catch (error) {
            console.error('❌ Error getting swap by txHash:', error);
            throw error;
        }
    }
    
    /**
     * Get swaps by user address
     * @param {string} userAddress - User's wallet address
     * @param {Object} options - Query options
     * @returns {Promise<Array>} Array of swap records
     */
    async getSwapsByUser(userAddress, options = {}) {
        try {
            const { limit = 50, offset = 0, status, chainId } = options;
            
            const whereClause = { userAddress: userAddress.toLowerCase() };
            if (status) whereClause.status = status;
            if (chainId) whereClause.chainId = chainId;
            
            return await Swap.findAll({
                where: whereClause,
                order: [['createdAt', 'DESC']],
                offset,
                limit
            });
        } catch (error) {
            console.error('❌ Error getting swaps by user:', error);
            throw error;
        }
    }
    
    /**
     * Get swap statistics
     * @param {string} chainId - Chain ID
     * @param {string} timeRange - Time range for stats
     * @returns {Promise<Object>} Swap statistics
     */
    async getSwapStats(chainId, timeRange = '24h') {
        try {
            return await Swap.getStats(chainId, timeRange);
        } catch (error) {
            console.error('❌ Error getting swap stats:', error);
            throw error;
        }
    }
    
    /**
     * Search swaps with filters
     * @param {Object} filters - Search filters
     * @param {Object} options - Query options
     * @returns {Promise<Object>} Search results with pagination
     */
    async searchSwaps(filters = {}, options = {}) {
        try {
            const { page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'DESC' } = options;
            const offset = (page - 1) * limit;
            
            // Build where clause from filters
            const whereClause = {};
            if (filters.chainId) whereClause.chainId = filters.chainId;
            if (filters.status) whereClause.status = filters.status;
            if (filters.tokenIn) whereClause.tokenIn = filters.tokenIn.toLowerCase();
            if (filters.tokenOut) whereClause.tokenOut = filters.tokenOut.toLowerCase();
            if (filters.userAddress) whereClause.userAddress = filters.userAddress.toLowerCase();
            if (filters.mode) whereClause.mode = filters.mode;
            if (filters.fee) whereClause.fee = filters.fee;
            
            // Date range filter
            if (filters.startDate || filters.endDate) {
                whereClause.createdAt = {};
                if (filters.startDate) whereClause.createdAt[Op.gte] = new Date(filters.startDate);
                if (filters.endDate) whereClause.createdAt[Op.lte] = new Date(filters.endDate);
            }
            
            // Text search (using ILIKE for case-insensitive search)
            if (filters.search) {
                whereClause[Op.or] = [
                    { txHash: { [Op.iLike]: `%${filters.search}%` } },
                    { tokenIn: { [Op.iLike]: `%${filters.search}%` } },
                    { tokenOut: { [Op.iLike]: `%${filters.search}%` } }
                ];
            }
            
            const [swaps, total] = await Promise.all([
                Swap.findAll({
                    where: whereClause,
                    order: [[sortBy, sortOrder]],
                    offset,
                    limit
                }),
                Swap.count({ where: whereClause })
            ]);
            
            return {
                swaps,
                pagination: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit),
                    hasNext: page * limit < total,
                    hasPrev: page > 1
                }
            };
        } catch (error) {
            console.error('❌ Error searching swaps:', error);
            throw error;
        }
    }
    
    /**
     * Create a new quote record
     * @param {Object} quoteData - Quote data to store
     * @returns {Promise<Object>} Created quote record
     */
    async createQuote(quoteData) {
        try {
            const quote = await Quote.create(quoteData);
            console.log(`✅ Quote record created: ${quote.quoteId}`);
            return quote;
        } catch (error) {
            console.error('❌ Error creating quote record:', error);
            throw error;
        }
    }
    
    /**
     * Get quote by ID
     * @param {string} quoteId - Quote ID
     * @returns {Promise<Object|null>} Quote record or null
     */
    async getQuoteById(quoteId) {
        try {
            return await Quote.findOne({ where: { quoteId } });
        } catch (error) {
            console.error('❌ Error getting quote by ID:', error);
            throw error;
        }
    }
    
    /**
     * Mark quote as used
     * @param {string} quoteId - Quote ID
     * @param {string} swapId - Associated swap ID
     * @returns {Promise<Object>} Updated quote record
     */
    async markQuoteAsUsed(quoteId, swapId) {
        try {
            const quote = await Quote.findOne({ where: { quoteId } });
            if (!quote) {
                throw new Error(`Quote with ID ${quoteId} not found`);
            }
            
            return await quote.markAsUsed(swapId);
        } catch (error) {
            console.error('❌ Error marking quote as used:', error);
            throw error;
        }
    }
    
    /**
     * Get quote statistics
     * @param {string} chainId - Chain ID
     * @param {string} timeRange - Time range for stats
     * @returns {Promise<Object>} Quote statistics
     */
    async getQuoteStats(chainId, timeRange = '24h') {
        try {
            return await Quote.getStats(chainId, timeRange);
        } catch (error) {
            console.error('❌ Error getting quote stats:', error);
            throw error;
        }
    }
    
    /**
     * Clean up expired quotes
     * @returns {Promise<number>} Number of quotes cleaned up
     */
    async cleanupExpiredQuotes() {
        try {
            const cleanedCount = await Quote.cleanupExpired();
            if (cleanedCount > 0) {
                console.log(`🧹 Cleaned up ${cleanedCount} expired quotes`);
            }
            return cleanedCount;
        } catch (error) {
            console.error('❌ Error cleaning up expired quotes:', error);
            throw error;
        }
    }
    
    /**
     * Create or update swap analytics
     * @param {Object} analyticsData - Analytics data
     * @returns {Promise<Object>} Created/updated analytics record
     */
    async upsertSwapAnalytics(analyticsData) {
        try {
            const { chainId, period, periodStart } = analyticsData;
            
            const [analytics, created] = await SwapAnalytics.findOrCreate({
                where: {
                    chainId,
                    period,
                    periodStart
                },
                defaults: analyticsData
            });
            
            if (!created) {
                // Update existing record
                await analytics.update(analyticsData);
                console.log(`✅ Swap analytics updated: ${chainId} - ${period}`);
            } else {
                console.log(`✅ Swap analytics created: ${chainId} - ${period}`);
            }
            
            return analytics;
        } catch (error) {
            console.error('❌ Error upserting swap analytics:', error);
            throw error;
        }
    }
    
    /**
     * Get latest analytics
     * @param {string} chainId - Chain ID
     * @param {string} period - Time period
     * @returns {Promise<Object|null>} Latest analytics record
     */
    async getLatestAnalytics(chainId, period = '24h') {
        try {
            return await SwapAnalytics.getLatestAnalytics(chainId, period);
        } catch (error) {
            console.error('❌ Error getting latest analytics:', error);
            throw error;
        }
    }
    
    /**
     * Get analytics summary
     * @param {string} chainId - Chain ID
     * @param {string} timeRange - Time range
     * @returns {Promise<Object>} Analytics summary
     */
    async getAnalyticsSummary(chainId, timeRange = '7d') {
        try {
            return await SwapAnalytics.getSummary(chainId, timeRange);
        } catch (error) {
            console.error('❌ Error getting analytics summary:', error);
            throw error;
        }
    }
    
    /**
     * Get database health status
     * @returns {Promise<Object>} Database health information
     */
    async getDatabaseHealth() {
        try {
            const [swapCount, quoteCount, analyticsCount] = await Promise.all([
                Swap.count(),
                Quote.count(),
                SwapAnalytics.count()
            ]);
            
            return {
                status: 'healthy',
                collections: {
                    swaps: swapCount,
                    quotes: quoteCount,
                    analytics: analyticsCount
                },
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error('❌ Error getting database health:', error);
            return {
                status: 'unhealthy',
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }
}

export default new SwapDatabaseService();

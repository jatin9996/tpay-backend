import Token from '../models/Token.js';
import Pool from '../models/Pool.js';

/**
 * Search Service
 * Handles combined search functionality for tokens and pools
 * Implements relevance scoring and result grouping
 * Updated to use Sequelize with PostgreSQL
 */

class SearchService {
    /**
     * Search both tokens and pools with relevance scoring
     * @param {string} query - Search query string
     * @param {number} limit - Maximum results per category
     * @returns {Object} Object containing tokens and pools arrays
     */
    static async search(query, limit = 20) {
        try {
            if (!query || query.trim().length === 0) {
                return {
                    tokens: [],
                    pools: [],
                    totalResults: 0,
                    query: query.trim()
                };
            }

            const trimmedQuery = query.trim();
            
            // Execute searches in parallel for better performance
            const [tokens, pools] = await Promise.all([
                this.searchTokens(trimmedQuery, limit),
                this.searchPools(trimmedQuery, limit)
            ]);

            // Apply relevance scoring and sorting
            const scoredTokens = this.scoreTokens(tokens, trimmedQuery);
            const scoredPools = this.scorePools(pools, trimmedQuery);

            return {
                tokens: scoredTokens,
                pools: scoredPools,
                totalResults: scoredTokens.length + scoredPools.length,
                query: trimmedQuery
            };

        } catch (error) {
            console.error('Search service error:', error);
            throw new Error('Search operation failed');
        }
    }

    /**
     * Search tokens with basic filtering
     * @param {string} query - Search query
     * @param {number} limit - Result limit
     * @returns {Array} Array of matching tokens
     */
    static async searchTokens(query, limit) {
        try {
            return await Token.searchTokens(query, limit);
        } catch (error) {
            console.error('Token search error:', error);
            return [];
        }
    }

    /**
     * Search pools with basic filtering
     * @param {string} query - Search query
     * @param {number} limit - Result limit
     * @returns {Array} Array of matching pools
     */
    static async searchPools(query, limit) {
        try {
            return await Pool.searchPools(query, limit);
        } catch (error) {
            console.error('Pool search error:', error);
            return [];
        }
    }

    /**
     * Score tokens based on relevance to search query
     * @param {Array} tokens - Array of tokens to score
     * @param {string} query - Search query
     * @returns {Array} Sorted array of scored tokens
     */
    static scoreTokens(tokens, query) {
        return tokens.map(token => {
            let score = 0;
            const queryLower = query.toLowerCase();
            
            // Symbol exact match (highest priority)
            if (token.symbol.toLowerCase() === queryLower) {
                score += 1000;
            }
            // Symbol starts with query
            else if (token.symbol.toLowerCase().startsWith(queryLower)) {
                score += 500;
            }
            // Symbol contains query
            else if (token.symbol.toLowerCase().includes(queryLower)) {
                score += 300;
            }
            
            // Name exact match
            if (token.name.toLowerCase() === queryLower) {
                score += 800;
            }
            // Name starts with query
            else if (token.name.toLowerCase().startsWith(queryLower)) {
                score += 400;
            }
            // Name contains query
            else if (token.name.toLowerCase().includes(queryLower)) {
                score += 200;
            }
            
            // Address prefix match
            if (token.address.toLowerCase().startsWith(queryLower)) {
                score += 100;
            }
            
            // Essential token bonus
            if (token.isEssential) {
                score += 50;
            }
            
            return { ...token, relevanceScore: score };
        })
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .map(({ relevanceScore, ...token }) => token); // Remove score from final result
    }

    /**
     * Score pools based on relevance to search query
     * @param {Array} pools - Array of pools to score
     * @param {string} query - Search query
     * @returns {Array} Sorted array of scored pools
     */
    static scorePools(pools, query) {
        return pools.map(pool => {
            let score = 0;
            const queryLower = query.toLowerCase();
            
            // Token symbol exact matches (highest priority)
            if (pool.token0.symbol.toLowerCase() === queryLower || 
                pool.token1.symbol.toLowerCase() === queryLower) {
                score += 1000;
            }
            // Token symbol starts with query
            else if (pool.token0.symbol.toLowerCase().startsWith(queryLower) || 
                     pool.token1.symbol.toLowerCase().startsWith(queryLower)) {
                score += 500;
            }
            // Token symbol contains query
            else if (pool.token0.symbol.toLowerCase().includes(queryLower) || 
                     pool.token1.symbol.toLowerCase().includes(queryLower)) {
                score += 300;
            }
            
            // Token name exact matches
            if (pool.token0.name.toLowerCase() === queryLower || 
                pool.token1.name.toLowerCase() === queryLower) {
                score += 800;
            }
            // Token name starts with query
            else if (pool.token0.name.toLowerCase().startsWith(queryLower) || 
                     pool.token1.name.toLowerCase().startsWith(queryLower)) {
                score += 400;
            }
            // Token name contains query
            else if (pool.token0.name.toLowerCase().includes(queryLower) || 
                     pool.token1.name.toLowerCase().includes(queryLower)) {
                score += 200;
            }
            
            // Address prefix matches
            if (pool.token0.address.toLowerCase().startsWith(queryLower) || 
                pool.token1.address.toLowerCase().startsWith(queryLower) ||
                pool.pairAddress.toLowerCase().startsWith(queryLower)) {
                score += 100;
            }
            
            // Liquidity bonus (higher liquidity = higher score)
            const liquidity = parseFloat(pool.liquidity) || 0;
            if (liquidity > 0) {
                score += Math.min(Math.log10(liquidity) * 10, 100);
            }
            
            return { ...pool, relevanceScore: score };
        })
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .map(({ relevanceScore, ...pool }) => pool); // Remove score from final result
    }

    /**
     * Get empty state suggestions when no search results are found
     * @returns {Object} Object containing default tokens and pools
     */
    static async getEmptyStateDefaults() {
        try {
            const [defaultTokens, defaultPools] = await Promise.all([
                Token.findAll({ 
                    where: { isEssential: true, isActive: true },
                    limit: 5,
                    order: [['symbol', 'ASC']]
                }),
                Pool.findAll({ 
                    where: { isActive: true },
                    limit: 5,
                    order: [['liquidity', 'DESC']]
                })
            ]);

            return {
                tokens: defaultTokens,
                pools: defaultPools,
                message: 'No search results found. Here are some popular options:'
            };
        } catch (error) {
            console.error('Empty state defaults error:', error);
            return {
                tokens: [],
                pools: [],
                message: 'No search results found.'
            };
        }
    }
}

export default SearchService;

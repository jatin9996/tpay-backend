import express from "express";
import SearchService from "../services/searchService.js";
import { serializeBigInts } from "../utils/bigIntSerializer.js";

const router = express.Router();

/**
 * SEARCH ENDPOINT
 * GET /search?q=&limit=20
 * 
 * Searches both tokens and pools with relevance scoring
 * Returns grouped results for better UX
 * 
 * @param {string} q - Search query string
 * @param {number} limit - Maximum results per category (default: 20)
 * @returns {Object} Object containing tokens[], pools[], and metadata
 */
router.get("/", async (req, res) => {
    try {
        const { q: query, limit = 20 } = req.query;
        
        // Validate query parameter
        if (!query || query.trim().length === 0) {
            // Return empty state defaults when no query is provided
            const emptyStateDefaults = await SearchService.getEmptyStateDefaults();
            
            const response = {
                success: true,
                query: "",
                tokens: emptyStateDefaults.tokens,
                pools: emptyStateDefaults.pools,
                totalResults: emptyStateDefaults.tokens.length + emptyStateDefaults.pools.length,
                message: emptyStateDefaults.message,
                isEmptyState: true
            };
            
            const serializedResponse = serializeBigInts(response);
            return res.json(serializedResponse);
        }
        
        // Validate limit parameter
        const parsedLimit = parseInt(limit);
        if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
            return res.status(400).json({
                success: false,
                error: "Limit must be a number between 1 and 100"
            });
        }
        
        // Perform search
        const searchResults = await SearchService.search(query, parsedLimit);
        
        // Check if no results found
        if (searchResults.totalResults === 0) {
            const emptyStateDefaults = await SearchService.getEmptyStateDefaults();
            
            const response = {
                success: true,
                query: searchResults.query,
                tokens: [],
                pools: [],
                totalResults: 0,
                message: emptyStateDefaults.message,
                isEmptyState: true,
                suggestions: {
                    tokens: emptyStateDefaults.tokens,
                    pools: emptyStateDefaults.pools
                }
            };
            
            const serializedResponse = serializeBigInts(response);
            return res.json(serializedResponse);
        }
        
        // Return successful search results
        const response = {
            success: true,
            query: searchResults.query,
            tokens: searchResults.tokens,
            pools: searchResults.pools,
            totalResults: searchResults.totalResults,
            message: `Found ${searchResults.totalResults} results for "${searchResults.query}"`,
            isEmptyState: false
        };
        
        // Serialize any BigInt values before sending response
        const serializedResponse = serializeBigInts(response);
        res.json(serializedResponse);
        
    } catch (error) {
        console.error('Search endpoint error:', error);
        res.status(500).json({
            success: false,
            error: "Search operation failed",
            message: error.message
        });
    }
});

/**
 * SEARCH TOKENS ONLY ENDPOINT
 * GET /search/tokens?q=&limit=20
 * 
 * Searches only tokens with relevance scoring
 * 
 * @param {string} q - Search query string
 * @param {number} limit - Maximum results (default: 20)
 * @returns {Object} Object containing tokens[] and metadata
 */
router.get("/tokens", async (req, res) => {
    try {
        const { q: query, limit = 20 } = req.query;
        
        if (!query || query.trim().length === 0) {
            return res.status(400).json({
                success: false,
                error: "Query parameter 'q' is required"
            });
        }
        
        const parsedLimit = parseInt(limit);
        if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
            return res.status(400).json({
                success: false,
                error: "Limit must be a number between 1 and 100"
            });
        }
        
        const tokens = await SearchService.searchTokens(query, parsedLimit);
        const scoredTokens = SearchService.scoreTokens(tokens, query);
        
        const response = {
            success: true,
            query: query.trim(),
            tokens: scoredTokens,
            totalResults: scoredTokens.length,
            message: `Found ${scoredTokens.length} tokens for "${query.trim()}"`
        };
        
        const serializedResponse = serializeBigInts(response);
        res.json(serializedResponse);
        
    } catch (error) {
        console.error('Token search endpoint error:', error);
        res.status(500).json({
            success: false,
            error: "Token search operation failed",
            message: error.message
        });
    }
});

/**
 * SEARCH POOLS ONLY ENDPOINT
 * GET /search/pools?q=&limit=20
 * 
 * Searches only pools with relevance scoring
 * 
 * @param {string} q - Search query string
 * @param {number} limit - Maximum results (default: 20)
 * @returns {Object} Object containing pools[] and metadata
 */
router.get("/pools", async (req, res) => {
    try {
        const { q: query, limit = 20 } = req.query;
        
        if (!query || query.trim().length === 0) {
            return res.status(400).json({
                success: false,
                error: "Query parameter 'q' is required"
            });
        }
        
        const parsedLimit = parseInt(limit);
        if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
            return res.status(400).json({
                success: false,
                error: "Limit must be a number between 1 and 100"
            });
        }
        
        const pools = await SearchService.searchPools(query, parsedLimit);
        const scoredPools = SearchService.scorePools(pools, query);
        
        const response = {
            success: true,
            query: query.trim(),
            pools: scoredPools,
            totalResults: scoredPools.length,
            message: `Found ${scoredPools.length} pools for "${query.trim()}"`
        };
        
        const serializedResponse = serializeBigInts(response);
        res.json(serializedResponse);
        
    } catch (error) {
        console.error('Pool search endpoint error:', error);
        res.status(500).json({
            success: false,
            error: "Pool search operation failed",
            message: error.message
        });
    }
});

export default router;

/**
 * Pools Router - Handles Uniswap V3 pool information endpoints
 * Provides endpoints for fetching pool data from The Graph subgraph
 */

import express from "express";
import axios from "axios";

const router = express.Router();

// The Graph subgraph URL for Uniswap V3 data
const GRAPH_URL = "https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3";

/**
 * GET POOLS ENDPOINT
 * Fetches top 5 Uniswap V3 pools by total value locked (TVL)
 * Data is retrieved from The Graph's Uniswap V3 subgraph
 * 
 * @returns {Array} Array of pool objects with token symbols and TVL information
 */
router.get("/pools", async (req, res) => {
    try {
        // GraphQL query to fetch top pools by TVL
        const query = `
        {
            pools(first: 5, orderBy: totalValueLockedUSD, orderDirection: desc) {
                id
                token0 { symbol }
                token1 { symbol }
                totalValueLockedUSD
            }
        }
        `;
        
        // Make POST request to The Graph subgraph
        const result = await axios.post(GRAPH_URL, { query });
        
        // Return the pools data from the subgraph response
        res.json(result.data.data.pools);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;

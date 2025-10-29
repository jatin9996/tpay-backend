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
        const result = await axios.post(GRAPH_URL, { query }, { timeout: 10000 });

        // Safely unwrap response and handle subgraph errors
        const graphErrors = result?.data?.errors;
        if (Array.isArray(graphErrors) && graphErrors.length > 0) {
            return res.status(502).json({
                error: "Subgraph responded with errors",
                details: graphErrors.map(e => e?.message || e).slice(0, 3)
            });
        }

        const pools = result?.data?.data?.pools;
        if (!Array.isArray(pools)) {
            return res.status(502).json({
                error: "Invalid subgraph response: missing pools array"
            });
        }

        // Return the pools data from the subgraph response
        res.json(pools);
    } catch (err) {
        // Log helpful context and return a friendly error
        const details = err?.response?.data || err?.message || String(err);
        console.error("/data/pools error:", details);
        res.status(502).json({ error: "Failed to fetch pools from subgraph", details });
    }
});

export default router;

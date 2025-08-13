import express from "express";
import axios from "axios";

const router = express.Router();
const GRAPH_URL = "https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3";

router.get("/pools", async (req, res) => {
    try {
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
        const result = await axios.post(GRAPH_URL, { query });
        res.json(result.data.data.pools);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;

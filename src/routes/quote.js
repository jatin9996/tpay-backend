import express from "express";
import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import config from "../config/env.js";
import { getUniswapAddresses } from "../config/chains.js";
import { validateToken } from "../services/tokenValidation.js";
import { serializeBigInts } from "../utils/bigIntSerializer.js";
import Quote from "../models/Quote.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

let provider, quoter;

const routerABI = JSON.parse(fs.readFileSync(path.join(__dirname, "../../node_modules/@uniswap/v3-periphery/artifacts/contracts/SwapRouter.sol/SwapRouter.json"), 'utf8'));

// Minimal Quoter ABI for single and multi-hop quoting
const quoterABI = {
  abi: [
    {
      inputs: [
        { internalType: "address", name: "tokenIn", type: "address" },
        { internalType: "address", name: "tokenOut", type: "address" },
        { internalType: "uint24", name: "fee", type: "uint24" },
        { internalType: "uint256", name: "amountIn", type: "uint256" },
        { internalType: "uint160", name: "sqrtPriceLimitX96", type: "uint160" }
      ],
      name: "quoteExactInputSingle",
      outputs: [ { internalType: "uint256", name: "amountOut", type: "uint256" } ],
      stateMutability: "nonpayable",
      type: "function"
    },
    {
      inputs: [ { internalType: "bytes", name: "path", type: "bytes" }, { internalType: "uint256", name: "amountIn", type: "uint256" } ],
      name: "quoteExactInput",
      outputs: [ { internalType: "uint256", name: "amountOut", type: "uint256" } ],
      stateMutability: "nonpayable",
      type: "function"
    }
  ]
};

const VALID_FEES = [500, 3000, 10000];
const ANCHORS = () => [config.WETH_ADDRESS, config.USDC_ADDRESS, config.USDT_ADDRESS].filter(Boolean);

async function ensureProvider() {
  if (!provider || !quoter) {
    provider = new ethers.JsonRpcProvider(config.RPC_URL);
    const network = await provider.getNetwork();
    const chainId = (config.FORCE_CHAIN_ID || network.chainId.toString());
    const addresses = getUniswapAddresses(chainId);
    quoter = new ethers.Contract(addresses.quoter, quoterABI.abi, provider);
  }
}

async function getTokenDecimals(token) {
  try {
    const erc20 = new ethers.Contract(token, ["function decimals() view returns (uint8)"], provider);
    return await erc20.decimals();
  } catch {
    return 18;
  }
}

function encodeV3Path(hops) {
  // hops: [tokenA, feeAB, tokenB, feeBC, tokenC]
  const types = [];
  const values = [];
  for (let i = 0; i < hops.length; i++) {
    if (typeof hops[i] === 'string' && ethers.isAddress(hops[i])) {
      types.push("address");
      values.push(hops[i]);
    } else {
      types.push("uint24");
      values.push(hops[i]);
    }
  }
  // Uniswap V3 Path is tightly packed: address (20 bytes) + fee (3 bytes) + address ...
  return ethers.solidityPacked(types, values);
}

function calcMinOutFromSlippage(amountOut, slippagePct = 0.5) {
  const bps = Math.floor(Number(slippagePct) * 100);
  const DENOM = 10_000n;
  return (BigInt(amountOut) * (DENOM - BigInt(bps))) / DENOM;
}

router.post("/best", async (req, res) => {
  try {
    await ensureProvider();
    const { tokenIn, tokenOut, amountIn, slippagePct = 0.5, ttlSec = 600 } = req.body || {};

    if (!tokenIn || !tokenOut || !amountIn) {
      return res.status(400).json({ error: "tokenIn, tokenOut, amountIn are required" });
    }

    const tIn = ethers.getAddress(tokenIn);
    const tOut = ethers.getAddress(tokenOut);
    validateToken(tIn);
    validateToken(tOut);
    if (tIn.toLowerCase() === tOut.toLowerCase()) return res.status(400).json({ error: "tokenIn and tokenOut must differ" });

    const decIn = await getTokenDecimals(tIn);
    const amtInWei = ethers.parseUnits(String(amountIn), decIn);

    const network = await provider.getNetwork();
    const chainId = (config.FORCE_CHAIN_ID || network.chainId.toString());

    const candidates = [];

    // Single-hop candidates across all fee tiers
    for (const fee of VALID_FEES) {
      candidates.push({ kind: 'single', route: [{ tokenIn: tIn, tokenOut: tOut, fee }], pathTokens: [tIn, fee, tOut] });
    }

    // Two-hop via anchors
    const anchors = ANCHORS().map(a => ethers.getAddress(a));
    for (const mid of anchors) {
      if (mid.toLowerCase() === tIn.toLowerCase() || mid.toLowerCase() === tOut.toLowerCase()) continue;
      for (const feeA of VALID_FEES) {
        for (const feeB of VALID_FEES) {
          candidates.push({ kind: 'multi', route: [
            { tokenIn: tIn, tokenOut: mid, fee: feeA },
            { tokenIn: mid, tokenOut: tOut, fee: feeB }
          ], pathTokens: [tIn, feeA, mid, feeB, tOut] });
        }
      }
    }

    // Evaluate all candidates
    const evals = [];
    for (const c of candidates) {
      try {
        if (c.kind === 'single') {
          const out = await quoter.quoteExactInputSingle.staticCall(c.route[0].tokenIn, c.route[0].tokenOut, c.route[0].fee, amtInWei, 0);
          evals.push({ ...c, amountOut: out });
        } else {
          const encodedPath = encodeV3Path(c.pathTokens);
          const out = await quoter.quoteExactInput.staticCall(encodedPath, amtInWei);
          evals.push({ ...c, amountOut: out });
        }
      } catch (_) {
        // ignore failing routes
      }
    }

    if (evals.length === 0) {
      return res.status(400).json({ error: "No executable route/liquidity for this pair" });
    }

    // Pick best by highest amountOut (gas tie-breaker omitted; estimate optional later)
    evals.sort((a, b) => (a.amountOut > b.amountOut ? -1 : a.amountOut < b.amountOut ? 1 : 0));
    const best = evals[0];

    const decOut = await getTokenDecimals(tOut);
    const amountOutStr = ethers.formatUnits(best.amountOut, decOut);
    const minOutWei = calcMinOutFromSlippage(best.amountOut, slippagePct);
    const minOutStr = ethers.formatUnits(minOutWei, decOut);

    const encodedPath = encodeV3Path(best.pathTokens);

    const nowSec = Math.floor(Date.now() / 1000);
    const expiresAtSec = nowSec + Math.min(Math.max(1, Number(ttlSec || 600)), 24 * 60 * 60);
    const quoteId = `q_${ethers.hexlify(ethers.randomBytes(8)).slice(2)}`;

    const response = serializeBigInts({
      route: best.route,
      path: encodedPath,
      amountOut: amountOutStr,
      amountOutMinimum: minOutStr,
      priceImpactPct: "0", // placeholder; requires mid-price context
      midPrice: "",
      executionPrice: "",
      estimatedGas: "0",
      quoteId,
      expiresAt: expiresAtSec
    });

    // Persist
    await Quote.create({
      chainId: Number(chainId),
      tokenIn: tIn.toLowerCase(),
      tokenOut: tOut.toLowerCase(),
      amountIn: String(amountIn),
      route: best.route,
      path: encodedPath,
      amountOut: response.amountOut,
      amountOutMinimum: response.amountOutMinimum,
      priceImpactPct: response.priceImpactPct,
      estimatedGas: response.estimatedGas,
      quoteId,
      expiresAt: new Date(expiresAtSec * 1000)
    });

    return res.json(response);
  } catch (err) {
    console.error("/quote/best failed", err);
    return res.status(500).json({ error: "Internal error", details: err.message });
  }
});

export default router;



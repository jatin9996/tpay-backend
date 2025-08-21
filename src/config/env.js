import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Environment variable validation
const requiredEnvVars = {
    RPC_URL: process.env.RPC_URL,
    PRIVATE_KEY: process.env.PRIVATE_KEY,
    PORT: process.env.PORT || 3001
};

const optionalEnvVars = {
    WETH_ADDRESS: process.env.WETH_ADDRESS || "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619", 
    WMATIC_ADDRESS: process.env.WMATIC_ADDRESS || "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270", 
    POL_ADDRESS: process.env.POL_ADDRESS || "0x455e53CBC86006f77080FAaBcC3B8Ea5d8E7D7eC", 
    USDC_ADDRESS: process.env.USDC_ADDRESS || "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582", 
    USDT_ADDRESS: process.env.USDT_ADDRESS || "0xc2132D05D31c914a87C6611C10748AEb04B58e8Fc",
    // Chain-specific configuration
    DEFAULT_CHAIN_ID: process.env.DEFAULT_CHAIN_ID || "137", // Default to Polygon
    FORCE_CHAIN_ID: process.env.FORCE_CHAIN_ID // Force specific chain ID (optional)
};

// Validate required environment variables
for (const [key, value] of Object.entries(requiredEnvVars)) {
    if (!value && key !== 'PORT') {
        throw new Error(`${key} environment variable is required`);
    }
}

// Validate private key format
if (requiredEnvVars.PRIVATE_KEY && !requiredEnvVars.PRIVATE_KEY.match(/^[0-9a-fA-F]{64}$/)) {
    throw new Error("PRIVATE_KEY must be a 64-character hexadecimal string without 0x prefix");
}

export default { ...requiredEnvVars, ...optionalEnvVars };

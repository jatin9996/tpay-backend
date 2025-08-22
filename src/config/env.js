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
    // Essential test tokens (Sepolia) - Only 2-3 tokens for testing
    WETH_ADDRESS: process.env.WETH_ADDRESS || "0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9", 
    USDC_ADDRESS: process.env.USDC_ADDRESS || "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238", 
    USDT_ADDRESS: process.env.USDT_ADDRESS || "0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0",
    // Chain-specific configuration - Default to Ethereum testnet (Sepolia)
    DEFAULT_CHAIN_ID: process.env.DEFAULT_CHAIN_ID || "11155111", // Default to Sepolia
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

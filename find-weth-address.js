import { ethers } from "ethers";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Common WETH addresses for different networks
const WETH_ADDRESSES = {
    // Ethereum networks (Primary for ERC-20 testing)
    "Ethereum Mainnet": "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    "Ethereum Sepolia Testnet": "0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9",
    "Ethereum Goerli Testnet": "0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6",
    
    // Polygon networks (Alternative)
    "Polygon Mainnet": "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619",
    "Polygon Mumbai Testnet": "0xA6FA4fB5f76172d178d61B04b0ecd319C5d1C0aa",
    "Polygon Amoy Testnet": "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619", // Same as mainnet
    
    // Other networks
    "Base Mainnet": "0x4200000000000000000000000000000000000006",
    "Base Sepolia Testnet": "0x4200000000000000000000000000000000000006"
};

const main = async () => {
    try {
        const RPC_URL = process.env.RPC_URL || "https://sepolia.infura.io/v3/YOUR_API_KEY";
        
        console.log("🔍 Finding WETH address for your network...");
        console.log(`🌐 RPC URL: ${RPC_URL}`);
        console.log("");

        // Create provider
        const provider = new ethers.JsonRpcProvider(RPC_URL);
        
        // Get network info
        const network = await provider.getNetwork();
        console.log(`📡 Network: ${network.name} (Chain ID: ${network.chainId})`);
        console.log("");

        // Try to identify the network and suggest WETH address
        let suggestedWETH = null;
        
        if (network.chainId === 1) {
            suggestedWETH = WETH_ADDRESSES["Ethereum Mainnet"];
            console.log("🎯 Detected: Ethereum Mainnet");
        } else if (network.chainId === 11155111) {
            suggestedWETH = WETH_ADDRESSES["Ethereum Sepolia Testnet"];
            console.log("🎯 Detected: Ethereum Sepolia Testnet");
        } else if (network.chainId === 5) { // Goerli Testnet
            suggestedWETH = WETH_ADDRESSES["Ethereum Goerli Testnet"];
            console.log("🎯 Detected: Ethereum Goerli Testnet");
        } else if (network.chainId === 137) {
            suggestedWETH = WETH_ADDRESSES["Polygon Mainnet"];
            console.log("🎯 Detected: Polygon Mainnet");
        } else if (network.chainId === 80001) {
            suggestedWETH = WETH_ADDRESSES["Polygon Mumbai Testnet"];
            console.log("🎯 Detected: Polygon Mumbai Testnet");
        } else if (network.chainId === 80002) {
            suggestedWETH = WETH_ADDRESSES["Polygon Amoy Testnet"];
            console.log("🎯 Detected: Polygon Amoy Testnet");
        } else if (network.chainId === 8453) {
            suggestedWETH = WETH_ADDRESSES["Base Mainnet"];
            console.log("🎯 Detected: Base Mainnet");
        } else if (network.chainId === 84532) {
            suggestedWETH = WETH_ADDRESSES["Base Sepolia Testnet"];
            console.log("🎯 Detected: Base Sepolia Testnet");
        } else {
            console.log("⚠️  Unknown network - checking common addresses...");
        }

        if (suggestedWETH) {
            console.log(`💡 Suggested WETH address: ${suggestedWETH}`);
            console.log("");
            
            // Test if the suggested address works
            console.log("🧪 Testing suggested WETH address...");
            try {
                const contractCode = await provider.getCode(suggestedWETH);
                if (contractCode === "0x") {
                    console.log("❌ No contract found at suggested address");
                } else {
                    console.log("✅ Contract found at suggested address");
                    
                    // Try to get basic token info
                    const basicAbi = [
                        "function symbol() view returns (string)",
                        "function name() view returns (string)",
                        "function decimals() view returns (uint8)"
                    ];
                    
                    const token = new ethers.Contract(suggestedWETH, basicAbi, provider);
                    
                    try {
                        const symbol = await token.symbol();
                        const name = await token.name();
                        const decimals = await token.decimals();
                        console.log(`   Token: ${name} (${symbol})`);
                        console.log(`   Decimals: ${decimals}`);
                        console.log("   ✅ This appears to be a valid WETH contract!");
                    } catch (error) {
                        console.log(`   ⚠️  Could not get token info: ${error.message}`);
                    }
                }
            } catch (error) {
                console.log(`   ❌ Error testing address: ${error.message}`);
            }
        }

        console.log("");
        console.log("📋 All known WETH addresses:");
        for (const [network, address] of Object.entries(WETH_ADDRESSES)) {
            console.log(`   ${network}: ${address}`);
        }

        console.log("");
        console.log("💡 To use a specific address, set it in your .env file:");
        console.log(`   WETH_ADDRESS=${suggestedWETH || "0x..."}`);
        
    } catch (error) {
        console.error("❌ Error:", error.message);
    }
};

// Run the script
main();

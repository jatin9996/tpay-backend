import { ethers } from "ethers";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Common WETH addresses for different networks
const WETH_ADDRESSES = {
    "Polygon Mainnet": "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619",
    "Polygon Mumbai Testnet": "0x9c3C9283D3e44854697Cd22D3Faa240Cfb032889",
    "Polygon Amoy Testnet": "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619", // Same as mainnet
    "Base Mainnet": "0x4200000000000000000000000000000000000006",
    "Base Sepolia Testnet": "0x4200000000000000000000000000000000000006",
    "Ethereum Mainnet": "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    "Ethereum Sepolia Testnet": "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14"
};

const main = async () => {
    try {
        const RPC_URL = process.env.RPC_URL || "https://rpc-amoy.polygon.technology/";
        
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
        
        if (network.chainId === 137) {
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
        } else if (network.chainId === 1) {
            suggestedWETH = WETH_ADDRESSES["Ethereum Mainnet"];
            console.log("🎯 Detected: Ethereum Mainnet");
        } else if (network.chainId === 11155111) {
            suggestedWETH = WETH_ADDRESSES["Ethereum Sepolia Testnet"];
            console.log("🎯 Detected: Ethereum Sepolia Testnet");
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

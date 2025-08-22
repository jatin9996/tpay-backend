import { ethers } from "ethers";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Configuration
const RPC_URL = process.env.RPC_URL || "https://sepolia.infura.io/v3/YOUR_API_KEY";
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const WETH_ADDRESS = process.env.WETH_ADDRESS || "0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9";
const ROUTER_ADDRESS = process.env.ROUTER_ADDRESS;

// Validate required environment variables
if (!PRIVATE_KEY) {
    console.error("❌ PRIVATE_KEY environment variable is required");
    process.exit(1);
}

if (!ROUTER_ADDRESS) {
    console.error("❌ ROUTER_ADDRESS environment variable is required");
    process.exit(1);
}

// ABI for the approve function
const ABI = ["function approve(address spender, uint256 amount) public returns (bool)"];

const main = async () => {
    try {
        console.log("🚀 Starting WETH approval process...");
        console.log(`🌐 Network: ${RPC_URL}`);
        console.log(`🔑 Wallet: ${new ethers.Wallet(PRIVATE_KEY).address}`);
        console.log(`🪙 WETH Contract: ${WETH_ADDRESS}`);
        console.log(`🔄 Router Contract: ${ROUTER_ADDRESS}`);
        console.log("");

        // Create provider and wallet
        const provider = new ethers.JsonRpcProvider(RPC_URL);
        const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
        
        // Create token contract instance
        const token = new ethers.Contract(WETH_ADDRESS, ABI, wallet);

        console.log("📝 Sending approval transaction...");
        
        // Send approval transaction
        const tx = await token.approve(ROUTER_ADDRESS, ethers.MaxUint256);
        console.log(`📋 Transaction hash: ${tx.hash}`);
        
        console.log("⏳ Waiting for transaction confirmation...");
        
        // Wait for transaction confirmation
        const receipt = await tx.wait();
        
        console.log("✅ WETH approval successful!");
        console.log(`📊 Gas used: ${receipt.gasUsed.toString()}`);
        console.log(`🔗 Transaction hash: ${receipt.hash}`);
        console.log(`📅 Block number: ${receipt.blockNumber}`);
        
        // Verify the approval
        console.log("\n🔍 Verifying approval...");
        const allowanceAbi = ["function allowance(address owner, address spender) view returns (uint256)"];
        const tokenWithAllowance = new ethers.Contract(WETH_ADDRESS, allowanceAbi, provider);
        const allowance = await tokenWithAllowance.allowance(wallet.address, ROUTER_ADDRESS);
        
        if (allowance === ethers.MaxUint256) {
            console.log("✅ Verification successful: Unlimited allowance granted");
        } else {
            console.log(`⚠️  Verification: Allowance is ${ethers.formatEther(allowance)} WETH`);
        }
        
    } catch (error) {
        console.error("❌ WETH approval failed:", error.message);
        process.exit(1);
    }
};

// Run the script
main();

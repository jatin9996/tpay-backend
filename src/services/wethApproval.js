import { ethers } from "ethers";
import config from "../config/env.js";

/**
 * Service for handling WETH token approvals
 */
class WETHApprovalService {
    constructor() {
        this.provider = new ethers.JsonRpcProvider(config.RPC_URL);
        this.wallet = new ethers.Wallet(config.PRIVATE_KEY, this.provider);
        this.wethAddress = config.WETH_ADDRESS;
        this.routerAddress = config.ROUTER_ADDRESS;
        
        // ABI for the approve function
        this.abi = ["function approve(address spender, uint256 amount) public returns (bool)"];
        
        // Contract instance
        this.token = new ethers.Contract(this.wethAddress, this.abi, this.wallet);
    }

    /**
     * Approve WETH spending for the router contract
     * @param {string} spender - The address to approve (defaults to router address)
     * @param {string} amount - The amount to approve (defaults to MaxUint256)
     * @returns {Object} Transaction details
     */
    async approveWETH(spender = this.routerAddress, amount = ethers.MaxUint256) {
        try {
            console.log(`🚀 Approving WETH spending for ${spender}...`);
            console.log(`💰 Amount: ${amount === ethers.MaxUint256 ? 'Unlimited' : ethers.formatEther(amount)} WETH`);
            
            // Send approval transaction
            const tx = await this.token.approve(spender, amount);
            console.log(`📝 Approval transaction hash: ${tx.hash}`);
            
            // Wait for transaction confirmation
            console.log("⏳ Waiting for transaction confirmation...");
            const receipt = await tx.wait();
            
            console.log("✅ WETH approval successful!");
            console.log(`📊 Gas used: ${receipt.gasUsed.toString()}`);
            console.log(`🔗 Transaction hash: ${receipt.hash}`);
            
            return {
                success: true,
                transactionHash: receipt.hash,
                gasUsed: receipt.gasUsed.toString(),
                spender: spender,
                amount: amount === ethers.MaxUint256 ? 'Unlimited' : ethers.formatEther(amount)
            };
            
        } catch (error) {
            console.error("❌ WETH approval failed:", error.message);
            throw new Error(`WETH approval failed: ${error.message}`);
        }
    }

    /**
     * Check current allowance for WETH
     * @param {string} spender - The address to check allowance for
     * @returns {Object} Current allowance information
     */
    async checkAllowance(spender = this.routerAddress) {
        try {
            // ABI for allowance function
            const allowanceAbi = ["function allowance(address owner, address spender) view returns (uint256)"];
            const tokenWithAllowance = new ethers.Contract(this.wethAddress, allowanceAbi, this.provider);
            
            const allowance = await tokenWithAllowance.allowance(this.wallet.address, spender);
            const formattedAllowance = ethers.formatEther(allowance);
            
            console.log(`📊 Current WETH allowance for ${spender}: ${formattedAllowance} WETH`);
            
            return {
                spender: spender,
                allowance: allowance.toString(),
                formattedAllowance: formattedAllowance
            };
            
        } catch (error) {
            console.error("❌ Failed to check allowance:", error.message);
            throw new Error(`Failed to check allowance: ${error.message}`);
        }
    }

    /**
     * Get wallet information
     * @returns {Object} Wallet details
     */
    getWalletInfo() {
        return {
            address: this.wallet.address,
            wethAddress: this.wethAddress,
            routerAddress: this.routerAddress,
            network: this.provider.network
        };
    }
}

export default WETHApprovalService;

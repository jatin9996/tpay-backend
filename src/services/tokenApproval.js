import { ethers } from "ethers";
import config from "../config/env.js";

/**
 * Generic ERC-20 token approval service
 * - Approve spender for any ERC-20 token address
 * - Check allowance using backend wallet as owner (server-signer model)
 */
class TokenApprovalService {
    constructor() {
        this.provider = new ethers.JsonRpcProvider(config.RPC_URL);
        this.wallet = new ethers.Wallet(config.PRIVATE_KEY, this.provider);
        this.routerAddress = config.ROUTER_ADDRESS;
        this.erc20Abi = [
            "function approve(address spender, uint256 amount) returns (bool)",
            "function allowance(address owner, address spender) view returns (uint256)",
            "function decimals() view returns (uint8)",
            "function symbol() view returns (string)",
            "function name() view returns (string)",
        ];
    }

    /**
     * Approve ERC-20 spending for a given token
     * @param {string} tokenAddress - ERC-20 contract address
     * @param {string} spender - Spender address (defaults to configured router)
     * @param {string|undefined} humanAmount - Human-readable amount (e.g., "1.5"); undefined => unlimited
     */
    async approveToken(tokenAddress, spender = this.routerAddress, humanAmount) {
        try {
            const token = new ethers.Contract(tokenAddress, this.erc20Abi, this.wallet);
            const decimals = await token.decimals();
            const symbol = await token.symbol().catch(() => "TOKEN");
            const amount = humanAmount ? ethers.parseUnits(humanAmount, decimals) : ethers.MaxUint256;

            const tx = await token.approve(spender, amount);
            const receipt = await tx.wait();

            return {
                success: true,
                transactionHash: receipt.hash,
                spender,
                tokenAddress,
                amount: humanAmount ?? "Unlimited",
                symbol,
                gasUsed: receipt.gasUsed?.toString?.(),
            };
        } catch (error) {
            throw new Error(`Token approval failed: ${error.message}`);
        }
    }

    /**
     * Check current allowance for backend wallet as owner
     * @param {string} tokenAddress - ERC-20 contract address
     * @param {string} spender - Spender address (defaults to configured router)
     */
    async checkAllowance(tokenAddress, spender = this.routerAddress) {
        try {
            const token = new ethers.Contract(tokenAddress, this.erc20Abi, this.provider);
            const [raw, decimals, symbol] = await Promise.all([
                token.allowance(this.wallet.address, spender),
                token.decimals(),
                token.symbol().catch(() => "TOKEN"),
            ]);

            return {
                owner: this.wallet.address,
                spender,
                tokenAddress,
                allowance: raw.toString(),
                formattedAllowance: ethers.formatUnits(raw, decimals),
                decimals,
                symbol,
            };
        } catch (error) {
            throw new Error(`Failed to check allowance: ${error.message}`);
        }
    }

    /**
     * Get backend wallet and token metadata
     */
    async getTokenInfo(tokenAddress) {
        const token = new ethers.Contract(tokenAddress, this.erc20Abi, this.provider);
        const [name, symbol, decimals] = await Promise.all([
            token.name().catch(() => "Unknown"),
            token.symbol().catch(() => "TOKEN"),
            token.decimals().catch(() => 18),
        ]);
        return {
            owner: this.wallet.address,
            routerAddress: this.routerAddress,
            tokenAddress,
            name,
            symbol,
            decimals,
            network: this.provider.network,
        };
    }
}

export default TokenApprovalService;



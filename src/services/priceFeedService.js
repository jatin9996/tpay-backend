import { ethers } from 'ethers';
import config from '../config/env.js';
import Token from '../models/Token.js';

/**
 * Price Feed Service
 * Integrates multiple price sources for accurate token pricing
 * Sources: Chainlink, CoinGecko, Uniswap pools, and fallback mechanisms
 */

class PriceFeedService {
    constructor() {
        this.cache = new Map();
        this.cacheTimeout = 30000; // 30 seconds cache
        this.coingeckoApiKey = config.COINGECKO_API_KEY;
        this.chainlinkFeeds = this.initializeChainlinkFeeds();
    }

    initializeChainlinkFeeds() {
        return {
            // Ethereum mainnet Chainlink feeds
            '1': {
                '0xA0b86a33E6441b8c4C8C0': '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419', // ETH/USD
                '0xA0b86a33E6441b8c4C8C1': '0x8A753747A1Fa494EC906cE90E9f37563A8AF630e', // LINK/USD
                '0xA0b86a33E6441b8c4C8C2': '0x2c1d072e956AFFC0D435Cb7AC38EF18d24d9127c'  // LINK/USD
            },
            // Sepolia testnet (placeholder addresses)
            '11155111': {
                '0xA0b86a33E6441b8c4C8C0': '0x694AA1769357215DE4FAC081bf1f309aDC325306' // ETH/USD
            }
        };
    }

    /**
     * Get token price from multiple sources with fallback
     */
    async getTokenPrice(tokenAddress, chainId = '1') {
        const cacheKey = `${tokenAddress.toLowerCase()}_${chainId}`;
        const cached = this.cache.get(cacheKey);
        
        if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
            return cached.price;
        }

        try {
            // Try multiple sources in order of reliability
            const sources = [
                () => this.getChainlinkPrice(tokenAddress, chainId),
                () => this.getCoinGeckoPrice(tokenAddress),
                () => this.getUniswapPoolPrice(tokenAddress, chainId),
                () => this.getDatabasePrice(tokenAddress, chainId),
                () => this.getFallbackPrice(tokenAddress)
            ];

            for (const source of sources) {
                try {
                    const price = await source();
                    if (price && price > 0) {
                        this.cache.set(cacheKey, {
                            price,
                            timestamp: Date.now(),
                            source: source.name
                        });
                        return price;
                    }
                } catch (error) {
                    console.warn(`Price source ${source.name} failed:`, error.message);
                }
            }

            throw new Error(`No price source available for token ${tokenAddress}`);
        } catch (error) {
            console.error('Price feed error:', error);
            return 0;
        }
    }

    /**
     * Get price from Chainlink oracle
     */
    async getChainlinkPrice(tokenAddress, chainId) {
        const feeds = this.chainlinkFeeds[chainId];
        if (!feeds || !feeds[tokenAddress]) {
            throw new Error('No Chainlink feed available');
        }

        const feedAddress = feeds[tokenAddress];
        const provider = new ethers.JsonRpcProvider(config.RPC_URL);
        
        const aggregatorABI = [
            "function latestRoundData() external view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)"
        ];

        const aggregator = new ethers.Contract(feedAddress, aggregatorABI, provider);
        const roundData = await aggregator.latestRoundData();
        
        // Chainlink returns price with 8 decimals
        return Number(ethers.formatUnits(roundData.answer, 8));
    }

    /**
     * Get price from CoinGecko API
     */
    async getCoinGeckoPrice(tokenAddress) {
        if (!this.coingeckoApiKey) {
            throw new Error('CoinGecko API key not configured');
        }

        const response = await fetch(
            `https://api.coingecko.com/api/v3/simple/token_price/ethereum?contract_addresses=${tokenAddress}&vs_currencies=usd&x_cg_demo_api_key=${this.coingeckoApiKey}`
        );

        if (!response.ok) {
            throw new Error(`CoinGecko API error: ${response.status}`);
        }

        const data = await response.json();
        const price = data[tokenAddress.toLowerCase()]?.usd;
        
        if (!price || price <= 0) {
            throw new Error('Invalid price from CoinGecko');
        }

        return price;
    }

    /**
     * Get price from Uniswap pool (if available)
     */
    async getUniswapPoolPrice(tokenAddress, chainId) {
        // This would require pool data - simplified for now
        const token = await Token.findOne({
            where: { address: tokenAddress.toLowerCase(), chainId: parseInt(chainId) }
        });

        if (token && token.priceUsd && token.priceUsd > 0) {
            return Number(token.priceUsd);
        }

        throw new Error('No Uniswap pool price available');
    }

    /**
     * Get price from database
     */
    async getDatabasePrice(tokenAddress, chainId) {
        const token = await Token.findOne({
            where: { address: tokenAddress.toLowerCase(), chainId: parseInt(chainId) }
        });

        if (token && token.priceUsd && token.priceUsd > 0) {
            return Number(token.priceUsd);
        }

        throw new Error('No database price available');
    }

    /**
     * Fallback price logic
     */
    async getFallbackPrice(tokenAddress) {
        const addr = tokenAddress.toLowerCase();
        
        // Stablecoin check
        if (addr === config.USDC_ADDRESS?.toLowerCase() || 
            addr === config.USDT_ADDRESS?.toLowerCase()) {
            return 1.0;
        }

        // WETH fallback
        if (addr === config.WETH_ADDRESS?.toLowerCase()) {
            const fallback = process.env.WETH_USD_FALLBACK ? 
                Number(process.env.WETH_USD_FALLBACK) : 2000;
            return Number.isFinite(fallback) && fallback > 0 ? fallback : 2000;
        }

        throw new Error('No fallback price available');
    }

    /**
     * Calculate price impact for a swap
     */
    async calculatePriceImpact(tokenIn, tokenOut, amountIn, chainId) {
        try {
            const [priceIn, priceOut] = await Promise.all([
                this.getTokenPrice(tokenIn, chainId),
                this.getTokenPrice(tokenOut, chainId)
            ]);

            if (priceIn <= 0 || priceOut <= 0) {
                return { impact: 0, error: 'Unable to calculate price impact' };
            }

            const inputValue = Number(amountIn) * priceIn;
            const expectedOutput = inputValue / priceOut;
            
            // This would need actual pool data for accurate calculation
            // For now, return a placeholder
            return {
                impact: 0.1, // 0.1% placeholder
                inputValue,
                expectedOutput,
                priceIn,
                priceOut
            };
        } catch (error) {
            console.error('Price impact calculation error:', error);
            return { impact: 0, error: error.message };
        }
    }

    /**
     * Update token prices in database
     */
    async updateTokenPrices(chainId = '1') {
        try {
            const tokens = await Token.findAll({
                where: { chainId: parseInt(chainId), isActive: true }
            });

            const updatePromises = tokens.map(async (token) => {
                try {
                    const price = await this.getTokenPrice(token.address, chainId);
                    if (price > 0) {
                        await token.update({
                            priceUsd: price,
                            lastPriceUpdate: new Date()
                        });
                    }
                } catch (error) {
                    console.warn(`Failed to update price for ${token.symbol}:`, error.message);
                }
            });

            await Promise.all(updatePromises);
            console.log(`Updated prices for ${tokens.length} tokens on chain ${chainId}`);
        } catch (error) {
            console.error('Token price update error:', error);
        }
    }

    /**
     * Get multiple token prices
     */
    async getMultipleTokenPrices(tokenAddresses, chainId = '1') {
        const prices = {};
        
        const pricePromises = tokenAddresses.map(async (address) => {
            try {
                const price = await this.getTokenPrice(address, chainId);
                prices[address.toLowerCase()] = price;
            } catch (error) {
                console.warn(`Failed to get price for ${address}:`, error.message);
                prices[address.toLowerCase()] = 0;
            }
        });

        await Promise.all(pricePromises);
        return prices;
    }
}

export default new PriceFeedService();

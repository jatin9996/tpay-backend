/**
 * Chain-specific configuration for Uniswap V3
 * Contains addresses for Quoter, Router, and Position Manager contracts on different networks
 */

// Uniswap V3 contract addresses by chain ID
export const UNISWAP_V3_ADDRESSES = {
    // Ethereum Mainnet
    '1': {
        quoter: '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6',
        router: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
        positionManager: '0xC36442b4a4522E871399CD717aBDD847Ab11FE88',
        factory: '0x1F98431c8aD98523631AE4a59f267346ea31F984'
    },
    // Ethereum Testnet (Sepolia) - Primary for ERC-20 testing
    '11155111': {
        quoter: '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6',
        router: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
        positionManager: '0xC36442b4a4522E871399CD717aBDD847Ab11FE88',
        factory: '0x1F98431c8aD98523631AE4a59f267346ea31F984'
    },
    // Ethereum Testnet (Goerli) - Legacy
    '5': {
        quoter: '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6',
        router: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
        positionManager: '0xC36442b4a4522E871399CD717aBDD847Ab11FE88',
        factory: '0x1F98431c8aD98523631AE4a59f267346ea31F984'
    },
    // Polygon (Matic) - Alternative
    '137': {
        quoter: '0x61fFE014bA17989E743c5F6cB21bF9697530B21e',
        router: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
        positionManager: '0xC36442b4a4522E871399CD717aBDD847Ab11FE88',
        factory: '0x1F98431c8aD98523631AE4a59f267346ea31F984'
    },
    // Polygon Testnet (Mumbai) - Alternative testnet
    '80001': {
        quoter: '0x61fFE014bA17989E743c5F6cB21bF9697530B21e',
        router: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
        positionManager: '0xC36442b4a4522E871399CD717aBDD847Ab11FE88',
        factory: '0x1F98431c8aD98523631AE4a59f267346ea31F984'
    },
    // Arbitrum One
    '42161': {
        quoter: '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6',
        router: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
        positionManager: '0xC36442b4a4522E871399CD717aBDD847Ab11FE88',
        factory: '0x1F98431c8aD98523631AE4a59f267346ea31F984'
    },
    // Optimism
    '10': {
        quoter: '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6',
        router: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
        positionManager: '0xC36442b4a4522E871399CD717aBDD847Ab11FE88',
        factory: '0x1F98431c8aD98523631AE4a59f267346ea31F984'
    },
    // Base
    '8453': {
        quoter: '0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a',
        router: '0x2626664c2603336E57B271c5C0b26F421741e481',
        positionManager: '0x03a520b7C06eF2aC8E3D9518754E9a3b0C10D2B9',
        factory: '0x33128a8fc17869897dE68FCB5B4B4c36d3Ee4fC8'
    },
    // BSC (Binance Smart Chain)
    '56': {
        quoter: '0x78D78E420Da98ad378D7799bE8f4AF69033EB077',
        router: '0x1b81D678ffb9C0263b24A97847620C99d213eB14',
        positionManager: '0x7b8A01B39D58278e5E2e6EC0C0c0b2C8Fc8B5b8',
        factory: '0xdB1d10011AD0Ff90774D2C6Ec2e8d0a2e4F50278'
    }
};

/**
 * Get Uniswap V3 addresses for a specific chain ID
 * @param {string|number} chainId - The chain ID
 * @returns {Object} Object containing quoter, router, positionManager, and factory addresses
 * @throws {Error} If the chain ID is not supported
 */
export function getUniswapAddresses(chainId) {
    const chainIdStr = chainId.toString();
    const addresses = UNISWAP_V3_ADDRESSES[chainIdStr];
    
    if (!addresses) {
        throw new Error(`Unsupported chainId for Uniswap V3: ${chainIdStr}. Supported chains: ${Object.keys(UNISWAP_V3_ADDRESSES).join(', ')}`);
    }
    
    return addresses;
}

/**
 * Get supported chain IDs
 * @returns {string[]} Array of supported chain IDs
 */
export function getSupportedChainIds() {
    return Object.keys(UNISWAP_V3_ADDRESSES);
}

/**
 * Check if a chain ID is supported
 * @param {string|number} chainId - The chain ID to check
 * @returns {boolean} True if the chain is supported
 */
export function isChainSupported(chainId) {
    const chainIdStr = chainId.toString();
    return chainIdStr in UNISWAP_V3_ADDRESSES;
}

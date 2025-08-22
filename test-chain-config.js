/**
 * Test script to verify chain-specific configuration
 * Run with: node test-chain-config.js
 */

import { getUniswapAddresses, getSupportedChainIds, isChainSupported } from './src/config/chains.js';

console.log('🔗 Testing Chain-Specific Configuration\n');

// Test 1: Get supported chain IDs
console.log('✅ Supported Chain IDs:');
const supportedChains = getSupportedChainIds();
console.log(supportedChains);
console.log('');

// Test 2: Test Ethereum testnet (Sepolia) - Primary for ERC-20 testing
console.log('✅ Testing Ethereum Testnet (Sepolia) - Primary for ERC-20:');
try {
    const sepoliaAddresses = getUniswapAddresses('11155111');
    console.log('Chain 11155111 (Sepolia):');
    console.log(`  Quoter: ${sepoliaAddresses.quoter}`);
    console.log(`  Router: ${sepoliaAddresses.router}`);
    console.log(`  Position Manager: ${sepoliaAddresses.positionManager}`);
    console.log(`  Factory: ${sepoliaAddresses.factory}`);
    console.log('');
} catch (error) {
    console.error(`❌ Error with Sepolia chain:`, error.message);
}

// Test 3: Test Ethereum mainnet
console.log('✅ Testing Ethereum Mainnet:');
try {
    const mainnetAddresses = getUniswapAddresses('1');
    console.log('Chain 1 (Ethereum Mainnet):');
    console.log(`  Quoter: ${mainnetAddresses.quoter}`);
    console.log(`  Router: ${mainnetAddresses.router}`);
    console.log(`  Position Manager: ${mainnetAddresses.positionManager}`);
    console.log(`  Factory: ${mainnetAddresses.factory}`);
    console.log('');
} catch (error) {
    console.error(`❌ Error with Ethereum mainnet:`, error.message);
}

// Test 4: Test each supported chain
console.log('✅ Testing all supported chains:');
for (const chainId of supportedChains) {
    try {
        const addresses = getUniswapAddresses(chainId);
        console.log(`Chain ${chainId}:`);
        console.log(`  Quoter: ${addresses.quoter}`);
        console.log(`  Router: ${addresses.router}`);
        console.log(`  Position Manager: ${addresses.positionManager}`);
        console.log(`  Factory: ${addresses.factory}`);
        console.log('');
    } catch (error) {
        console.error(`❌ Error with chain ${chainId}:`, error.message);
    }
}

// Test 5: Test unsupported chain
console.log('✅ Testing unsupported chain:');
try {
    getUniswapAddresses('999');
    console.log('❌ Should have thrown an error for unsupported chain');
} catch (error) {
    console.log('✅ Correctly rejected unsupported chain 999');
    console.log(`Error message: ${error.message}`);
}
console.log('');

// Test 6: Test chain support checking
console.log('✅ Testing chain support checking:');
console.log(`Chain 1 (Ethereum Mainnet) supported: ${isChainSupported('1')}`);
console.log(`Chain 11155111 (Sepolia) supported: ${isChainSupported('11155111')}`);
console.log(`Chain 137 (Polygon) supported: ${isChainSupported('137')}`);
console.log(`Chain 999 (Unsupported) supported: ${isChainSupported('999')}`);
console.log('');

console.log('🎉 Chain configuration test completed!');
console.log('🚀 Ready for ERC-20 testing on Ethereum testnet (Sepolia)!');

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

// Test 2: Test each supported chain
console.log('✅ Testing each supported chain:');
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

// Test 3: Test unsupported chain
console.log('✅ Testing unsupported chain:');
try {
    getUniswapAddresses('999');
    console.log('❌ Should have thrown an error for unsupported chain');
} catch (error) {
    console.log('✅ Correctly rejected unsupported chain 999');
    console.log(`Error message: ${error.message}`);
}
console.log('');

// Test 4: Test chain support checking
console.log('✅ Testing chain support checking:');
console.log(`Chain 1 supported: ${isChainSupported('1')}`);
console.log(`Chain 137 supported: ${isChainSupported('137')}`);
console.log(`Chain 999 supported: ${isChainSupported('999')}`);
console.log('');

console.log('🎉 Chain configuration test completed!');

/**
 * Test script to verify Ethereum testnet configuration
 * Run with: node test-ethereum-config.js
 */

import { getUniswapAddresses, getSupportedChainIds, isChainSupported } from './src/config/chains.js';
import config from './src/config/env.js';

console.log('🚀 Testing Ethereum Testnet Configuration\n');

// Test 1: Check environment configuration
console.log('✅ Environment Configuration:');
console.log(`   RPC_URL: ${config.RPC_URL}`);
console.log(`   DEFAULT_CHAIN_ID: ${config.DEFAULT_CHAIN_ID}`);
console.log(`   FORCE_CHAIN_ID: ${config.FORCE_CHAIN_ID || 'Not set'}`);
console.log(`   WETH_ADDRESS: ${config.WETH_ADDRESS}`);
console.log(`   USDC_ADDRESS: ${config.USDC_ADDRESS}`);
console.log(`   USDT_ADDRESS: ${config.USDT_ADDRESS}`);
console.log('');

// Test 2: Verify Ethereum testnet support
console.log('✅ Ethereum Testnet Support:');
const sepoliaChainId = '11155111';
const goerliChainId = '5';
const mainnetChainId = '1';

console.log(`   Sepolia (${sepoliaChainId}): ${isChainSupported(sepoliaChainId) ? '✅ Supported' : '❌ Not Supported'}`);
console.log(`   Goerli (${goerliChainId}): ${isChainSupported(goerliChainId) ? '✅ Supported' : '❌ Not Supported'}`);
console.log(`   Mainnet (${mainnetChainId}): ${isChainSupported(mainnetChainId) ? '✅ Supported' : '❌ Not Supported'}`);
console.log('');

// Test 3: Get Uniswap addresses for Ethereum networks
console.log('✅ Uniswap V3 Addresses for Ethereum Networks:');

try {
    const sepoliaAddresses = getUniswapAddresses(sepoliaChainId);
    console.log(`   Sepolia (${sepoliaChainId}):`);
    console.log(`     Quoter: ${sepoliaAddresses.quoter}`);
    console.log(`     Router: ${sepoliaAddresses.router}`);
    console.log(`     Position Manager: ${sepoliaAddresses.positionManager}`);
    console.log(`     Factory: ${sepoliaAddresses.factory}`);
    console.log('');
} catch (error) {
    console.error(`   ❌ Error with Sepolia: ${error.message}`);
}

try {
    const mainnetAddresses = getUniswapAddresses(mainnetChainId);
    console.log(`   Mainnet (${mainnetChainId}):`);
    console.log(`     Quoter: ${mainnetAddresses.quoter}`);
    console.log(`     Router: ${mainnetAddresses.router}`);
    console.log(`     Position Manager: ${mainnetAddresses.positionManager}`);
    console.log(`     Factory: ${mainnetAddresses.factory}`);
    console.log('');
} catch (error) {
    console.error(`   ❌ Error with Mainnet: ${error.message}`);
}

// Test 4: Check all supported chains
console.log('✅ All Supported Chain IDs:');
const supportedChains = getSupportedChainIds();
console.log(`   Total: ${supportedChains.length} chains`);
console.log(`   Chains: ${supportedChains.join(', ')}`);
console.log('');

// Test 5: Verify default configuration
console.log('✅ Default Configuration Check:');
if (config.DEFAULT_CHAIN_ID === '11155111') {
    console.log('   ✅ Default chain ID is correctly set to Sepolia (11155111)');
} else {
    console.log(`   ⚠️  Default chain ID is ${config.DEFAULT_CHAIN_ID}, expected 11155111`);
}

if (config.WETH_ADDRESS === '0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9') {
    console.log('   ✅ WETH address is correctly set to Sepolia address');
} else {
    console.log(`   ⚠️  WETH address is ${config.WETH_ADDRESS}, expected Sepolia address`);
}

// Test 6: Verify essential token configuration
console.log('✅ Essential Token Configuration:');
console.log(`   Essential tokens configured: ${config.WETH_ADDRESS ? 'WETH' : ''} ${config.USDC_ADDRESS ? 'USDC' : ''} ${config.USDT_ADDRESS ? 'USDT' : ''}`);
console.log(`   Total essential tokens: ${[config.WETH_ADDRESS, config.USDC_ADDRESS, config.USDT_ADDRESS].filter(Boolean).length}`);
console.log('');

console.log('🎉 Ethereum testnet configuration test completed!');
console.log('🚀 Ready for ERC-20 testing on Sepolia with permissionless token listings!');
console.log('');
console.log('📋 Next steps:');
console.log('   1. Set up your .env file with Infura API key');
console.log('   2. Get your private key from MetaMask');
console.log('   3. Get testnet ETH from Sepolia faucet');
console.log('   4. Run: npm start');
console.log('   5. Test permissionless token listing with: POST /tokens/add');

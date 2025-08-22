#!/usr/bin/env node

/**
 * Quick test script to verify TPay Swap API endpoints
 * Run this after starting the server to test basic functionality
 */

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3001';
const ENDPOINTS = [
    { method: 'GET', path: '/dex/chain-info', name: 'Chain Info' },
    { method: 'GET', path: '/dex/operational-status', name: 'Operational Status' },
    { method: 'GET', path: '/dex/tokens', name: 'Supported Tokens' },
    { method: 'GET', path: '/dex/balance/0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619/0x742d35Cc6634C0532925a3b8D4C9Db96C4b4d8b6', name: 'Token Balance' }
];

const TEST_QUOTE = {
    tokenIn: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619', // WETH
    tokenOut: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270', // WMATIC
    amountIn: '0.1',
    fee: 3000
};

async function testEndpoint(method, path, name, body = null) {
    try {
        const options = {
            method,
            headers: body ? { 'Content-Type': 'application/json' } : {}
        };
        
        if (body) {
            options.body = JSON.stringify(body);
        }
        
        const response = await fetch(`${BASE_URL}${path}`, options);
        const data = await response.json();
        
        console.log(`✅ ${name} (${response.status}):`);
        console.log(`   Path: ${method} ${path}`);
        console.log(`   Status: ${response.status}`);
        
        if (response.ok) {
            if (data.chainId) {
                console.log(`   Chain ID: ${data.chainId}`);
            }
            if (data.success !== undefined) {
                console.log(`   Success: ${data.success}`);
            }
        } else {
            console.log(`   Error: ${data.error || 'Unknown error'}`);
        }
        
        console.log('');
        return response.ok;
    } catch (error) {
        console.log(`❌ ${name} - Connection Error:`);
        console.log(`   Path: ${method} ${path}`);
        console.log(`   Error: ${error.message}`);
        console.log('');
        return false;
    }
}

async function testQuoteValidation() {
    console.log('🧪 Testing Quote Validation...\n');
    
    // Test valid quote
    await testEndpoint('POST', '/dex/quote', 'Valid Quote', TEST_QUOTE);
    
    // Test invalid fee
    await testEndpoint('POST', '/dex/quote', 'Invalid Fee (2000)', {
        ...TEST_QUOTE,
        fee: 2000
    });
    
    // Test same token
    await testEndpoint('POST', '/dex/quote', 'Same Token', {
        ...TEST_QUOTE,
        tokenOut: TEST_QUOTE.tokenIn
    });
}

async function testSwapPopulation() {
    console.log('🧪 Testing Swap Population...\n');
    
    const swapParams = {
        ...TEST_QUOTE,
        recipient: '0x742d35Cc6634C0532925a3b8D4C9Db96C4b4d8b6',
        slippageTolerance: 0.5,
        ttlSec: 600
    };
    
    // Test valid swap population
    await testEndpoint('POST', '/dex/swap/populate', 'Valid Swap Population', swapParams);
    
    // Test high slippage (should fail due to operational limits)
    await testEndpoint('POST', '/dex/swap/populate', 'High Slippage (10%)', {
        ...swapParams,
        slippageTolerance: 10.0
    });
    
    // Test short TTL (should fail due to operational limits)
    await testEndpoint('POST', '/dex/swap/populate', 'Short TTL (30s)', {
        ...swapParams,
        ttlSec: 30
    });
}

async function runTests() {
    console.log('🚀 TPay Swap API Test Suite\n');
    console.log(`Base URL: ${BASE_URL}\n`);
    
    // Test basic GET endpoints
    console.log('📡 Testing Basic Endpoints...\n');
    let successCount = 0;
    let totalCount = 0;
    
    for (const endpoint of ENDPOINTS) {
        const success = await testEndpoint(endpoint.method, endpoint.path, endpoint.name);
        if (success) successCount++;
        totalCount++;
    }
    
    // Test quote functionality
    await testQuoteValidation();
    
    // Test swap population
    await testSwapPopulation();
    
    // Summary
    console.log('📊 Test Summary:');
    console.log(`   Basic Endpoints: ${successCount}/${totalCount} successful`);
    console.log(`   Quote Validation: Tested`);
    console.log(`   Swap Population: Tested`);
    console.log('');
    
    if (successCount === totalCount) {
        console.log('🎉 All basic tests passed! Server is working correctly.');
    } else {
        console.log('⚠️  Some tests failed. Check server logs for details.');
    }
    
    console.log('\n💡 Next Steps:');
    console.log('   1. Import TPay_Swap_API.postman_collection.json into Postman');
    console.log('   2. Test with different parameters and edge cases');
    console.log('   3. Verify all validation rules are working');
    console.log('   4. Test custodial swaps if you have a funded private key');
}

// Check if server is running
async function checkServer() {
    try {
        const response = await fetch(`${BASE_URL}/dex/chain-info`);
        if (response.ok) {
            console.log('✅ Server is running and responding');
            return true;
        }
    } catch (error) {
        console.log('❌ Server is not responding');
        console.log('   Make sure to start the server with: npm start');
        return false;
    }
}

// Main execution
async function main() {
    const serverRunning = await checkServer();
    if (serverRunning) {
        await runTests();
    } else {
        process.exit(1);
    }
}

main().catch(console.error);

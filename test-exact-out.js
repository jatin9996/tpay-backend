/**
 * Test script for Exact-Out Quotes (reverse mode) functionality
 * This script tests the new endpoints:
 * - POST /quote/exact-out
 * - POST /swap/populate/exact-out
 * - POST /swap/exact-out
 */

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3000';

// Test configuration
const TEST_CONFIG = {
    tokenIn: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // WETH on Ethereum
    tokenOut: '0xA0b86a33E6441b8c4C8C8C8C8C8C8C8C8C8C8C8', // USDC on Ethereum (example)
    amountOut: '100', // Want to receive exactly 100 USDC
    recipient: '0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6', // Example recipient
    slippageTolerance: 0.5, // 0.5%
    fee: 3000, // 0.3% fee tier
    ttlSec: 600 // 10 minutes
};

async function testExactOutQuote() {
    console.log('🧪 Testing Exact-Out Quote Endpoint...');
    
    try {
        const response = await fetch(`${BASE_URL}/quote/exact-out`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                tokenIn: TEST_CONFIG.tokenIn,
                tokenOut: TEST_CONFIG.tokenOut,
                amountOut: TEST_CONFIG.amountOut,
                slippagePct: TEST_CONFIG.slippageTolerance,
                ttlSec: TEST_CONFIG.ttlSec
            })
        });

        const data = await response.json();
        
        if (response.ok) {
            console.log('✅ Exact-Out Quote successful!');
            console.log('📊 Quote Details:');
            console.log(`   - Required Input Amount: ${data.amountIn}`);
            console.log(`   - Maximum Input Amount: ${data.amountInMaximum}`);
            console.log(`   - Desired Output Amount: ${data.amountOut}`);
            console.log(`   - Quote ID: ${data.quoteId}`);
            console.log(`   - Mode: ${data.mode}`);
            console.log(`   - Route: ${JSON.stringify(data.route, null, 2)}`);
            return data;
        } else {
            console.log('❌ Exact-Out Quote failed:', data.error);
            return null;
        }
    } catch (error) {
        console.error('❌ Error testing exact-out quote:', error.message);
        return null;
    }
}

async function testExactOutPopulate(quoteData) {
    if (!quoteData) {
        console.log('⏭️ Skipping populate test - no quote data available');
        return null;
    }

    console.log('\n🧪 Testing Exact-Out Populate Endpoint...');
    
    try {
        const response = await fetch(`${BASE_URL}/swap/populate/exact-out`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                tokenIn: TEST_CONFIG.tokenIn,
                tokenOut: TEST_CONFIG.tokenOut,
                amountOut: TEST_CONFIG.amountOut,
                recipient: TEST_CONFIG.recipient,
                slippageTolerance: TEST_CONFIG.slippageTolerance,
                fee: TEST_CONFIG.fee,
                ttlSec: TEST_CONFIG.ttlSec
            })
        });

        const data = await response.json();
        
        if (response.ok) {
            console.log('✅ Exact-Out Populate successful!');
            console.log('📋 Transaction Details:');
            console.log(`   - To: ${data.populatedTransaction.to}`);
            console.log(`   - Data: ${data.populatedTransaction.data.substring(0, 66)}...`);
            console.log(`   - Gas Limit: ${data.populatedTransaction.gasLimit}`);
            console.log(`   - Mode: ${data.swapDetails.mode}`);
            console.log(`   - Required Input: ${data.swapDetails.amountIn}`);
            console.log(`   - Desired Output: ${data.swapDetails.amountOut}`);
            return data;
        } else {
            console.log('❌ Exact-Out Populate failed:', data.error);
            return null;
        }
    } catch (error) {
        console.error('❌ Error testing exact-out populate:', error.message);
        return null;
    }
}

async function testExactOutSwap(quoteData) {
    if (!quoteData) {
        console.log('⏭️ Skipping swap test - no quote data available');
        return null;
    }

    console.log('\n🧪 Testing Exact-Out Swap Endpoint...');
    console.log('⚠️  Note: This will execute an actual swap transaction!');
    
    try {
        const response = await fetch(`${BASE_URL}/swap/exact-out`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                tokenIn: TEST_CONFIG.tokenIn,
                tokenOut: TEST_CONFIG.tokenOut,
                amountOut: TEST_CONFIG.amountOut,
                recipient: TEST_CONFIG.recipient,
                slippageTolerance: TEST_CONFIG.slippageTolerance,
                fee: TEST_CONFIG.fee,
                ttlSec: TEST_CONFIG.ttlSec
            })
        });

        const data = await response.json();
        
        if (response.ok) {
            console.log('✅ Exact-Out Swap successful!');
            console.log('🔗 Transaction Details:');
            console.log(`   - Transaction Hash: ${data.txHash}`);
            console.log(`   - Chain ID: ${data.chainId}`);
            console.log(`   - Mode: ${data.swapDetails.mode}`);
            console.log(`   - Status: ${data.swapDetails.status}`);
            return data;
        } else {
            console.log('❌ Exact-Out Swap failed:', data.error);
            return null;
        }
    } catch (error) {
        console.error('❌ Error testing exact-out swap:', error.message);
        return null;
    }
}

async function runTests() {
    console.log('🚀 Starting Exact-Out Functionality Tests...\n');
    
    // Test 1: Exact-Out Quote
    const quoteData = await testExactOutQuote();
    
    // Test 2: Exact-Out Populate (non-custodial)
    const populateData = await testExactOutPopulate(quoteData);
    
    // Test 3: Exact-Out Swap (custodial) - Uncomment to test actual execution
    // const swapData = await testExactOutSwap(quoteData);
    
    console.log('\n🎯 Test Summary:');
    console.log(`   - Quote Test: ${quoteData ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`   - Populate Test: ${populateData ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`   - Swap Test: ⏭️ SKIPPED (uncomment to test)`);
    
    if (quoteData && populateData) {
        console.log('\n🎉 All tests completed successfully!');
        console.log('📝 The Exact-Out functionality is working correctly.');
    } else {
        console.log('\n⚠️  Some tests failed. Check the server logs for details.');
    }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    runTests().catch(console.error);
}

export { testExactOutQuote, testExactOutPopulate, testExactOutSwap, runTests };

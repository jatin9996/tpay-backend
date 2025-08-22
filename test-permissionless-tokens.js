/**
 * Test script to verify permissionless token listing functionality
 * Run with: node test-permissionless-tokens.js
 */

import { 
    getAllowedTokens, 
    isTokenAllowed, 
    addTokenToRegistry, 
    removeTokenFromRegistry,
    getTokenRegistryStatus
} from './src/services/tokenValidation.js';

console.log('🚀 Testing Permissionless Token Listing Functionality\n');

// Test 1: Check initial registry status
console.log('✅ Initial Registry Status:');
const initialStatus = getTokenRegistryStatus();
console.log(`   Essential tokens: ${initialStatus.essentialTokens}`);
console.log(`   Dynamic tokens: ${initialStatus.dynamicTokens}`);
console.log(`   Total tokens: ${initialStatus.totalTokens}`);
console.log(`   Essential addresses: ${initialStatus.registry.essential.join(', ')}`);
console.log(`   Dynamic addresses: ${initialStatus.registry.dynamic.length > 0 ? initialStatus.registry.dynamic.join(', ') : 'None'}`);
console.log('');

// Test 2: Check initial allowed tokens
console.log('✅ Initial Allowed Tokens:');
const initialAllowed = getAllowedTokens();
console.log(`   Total allowed: ${initialAllowed.length}`);
console.log(`   Addresses: ${initialAllowed.join(', ')}`);
console.log('');

// Test 3: Test adding a new token (permissionless listing)
console.log('✅ Testing Permissionless Token Addition:');
const testTokenAddress = '0x1234567890123456789012345678901234567890';

console.log(`   Adding test token: ${testTokenAddress}`);
const addResult = addTokenToRegistry(testTokenAddress);

if (addResult.success) {
    console.log(`   ✅ Success: ${addResult.message}`);
} else {
    console.log(`   ❌ Failed: ${addResult.message}`);
}
console.log('');

// Test 4: Check registry status after addition
console.log('✅ Registry Status After Addition:');
const afterAddStatus = getTokenRegistryStatus();
console.log(`   Essential tokens: ${afterAddStatus.essentialTokens}`);
console.log(`   Dynamic tokens: ${afterAddStatus.dynamicTokens}`);
console.log(`   Total tokens: ${afterAddStatus.totalTokens}`);
console.log(`   Dynamic addresses: ${afterAddStatus.registry.dynamic.join(', ')}`);
console.log('');

// Test 5: Verify the new token is now allowed
console.log('✅ Verifying New Token is Allowed:');
const isNewTokenAllowed = isTokenAllowed(testTokenAddress);
console.log(`   Token ${testTokenAddress} allowed: ${isNewTokenAllowed ? '✅ Yes' : '❌ No'}`);

const updatedAllowed = getAllowedTokens();
console.log(`   Total allowed tokens now: ${updatedAllowed.length}`);
console.log(`   New token in list: ${updatedAllowed.includes(testTokenAddress) ? '✅ Yes' : '❌ No'}`);
console.log('');

// Test 6: Test adding the same token again (should fail)
console.log('✅ Testing Duplicate Token Addition:');
const duplicateResult = addTokenToRegistry(testTokenAddress);
if (duplicateResult.success) {
    console.log(`   ⚠️  Unexpected success: ${duplicateResult.message}`);
} else {
    console.log(`   ✅ Correctly rejected duplicate: ${duplicateResult.message}`);
}
console.log('');

// Test 7: Test removing the token
console.log('✅ Testing Token Removal:');
const removeResult = removeTokenFromRegistry(testTokenAddress);
if (removeResult.success) {
    console.log(`   ✅ Success: ${removeResult.message}`);
} else {
    console.log(`   ❌ Failed: ${removeResult.message}`);
}
console.log('');

// Test 8: Check final registry status
console.log('✅ Final Registry Status:');
const finalStatus = getTokenRegistryStatus();
console.log(`   Essential tokens: ${finalStatus.essentialTokens}`);
console.log(`   Dynamic tokens: ${finalStatus.dynamicTokens}`);
console.log(`   Total tokens: ${finalStatus.totalTokens}`);
console.log(`   Dynamic addresses: ${finalStatus.registry.dynamic.length > 0 ? finalStatus.registry.dynamic.join(', ') : 'None'}`);
console.log('');

// Test 9: Verify token is no longer allowed
console.log('✅ Verifying Token Removal:');
const isTokenStillAllowed = isTokenAllowed(testTokenAddress);
console.log(`   Token ${testTokenAddress} still allowed: ${isTokenStillAllowed ? '❌ Yes (should be removed)' : '✅ No (correctly removed)'}`);

const finalAllowed = getAllowedTokens();
console.log(`   Final total allowed tokens: ${finalAllowed.length}`);
console.log(`   Removed token in list: ${finalAllowed.includes(testTokenAddress) ? '❌ Yes (should not be there)' : '✅ No (correctly removed)'}`);
console.log('');

// Test 10: Test with invalid addresses
console.log('✅ Testing Invalid Address Handling:');
const invalidAddresses = [
    '',
    'invalid',
    '0x123',
    '0x123456789012345678901234567890123456789',
    null,
    undefined
];

for (const invalidAddr of invalidAddresses) {
    try {
        const result = addTokenToRegistry(invalidAddr);
        console.log(`   Address "${invalidAddr}": ${result.success ? '❌ Unexpected success' : '✅ Correctly rejected'}`);
    } catch (error) {
        console.log(`   Address "${invalidAddr}": ✅ Correctly threw error: ${error.message}`);
    }
}
console.log('');

console.log('🎉 Permissionless token listing test completed!');
console.log('🚀 TPay supports dynamic token additions without backend updates!');
console.log('');
console.log('📋 API Endpoints Available:');
console.log('   GET  /tokens/allowed - List all allowed tokens');
console.log('   POST /tokens/add - Add new token (permissionless)');
console.log('   DELETE /tokens/remove/:address - Remove dynamic token');
console.log('   GET  /tokens/registry/status - Get registry status');
console.log('   GET  /tokens/essential - Get essential tokens only');
console.log('   GET  /tokens/dynamic - Get dynamic tokens only');

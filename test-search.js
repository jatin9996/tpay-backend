import axios from 'axios';

/**
 * Test Script for TPay Search API
 * Tests the search functionality with various queries
 */

const BASE_URL = 'http://localhost:3001';

const testSearch = async () => {
    console.log('🧪 Testing TPay Search API...\n');
    
    try {
        // Test 1: Combined search for WETH
        console.log('1️⃣ Testing combined search for "WETH"...');
        const response1 = await axios.get(`${BASE_URL}/search?q=WETH&limit=5`);
        console.log('✅ Success:', response1.data.message);
        console.log(`   Tokens: ${response1.data.tokens.length}, Pools: ${response1.data.pools.length}\n`);
        
        // Test 2: Token-only search for USD
        console.log('2️⃣ Testing token-only search for "USD"...');
        const response2 = await axios.get(`${BASE_URL}/search/tokens?q=USD&limit=10`);
        console.log('✅ Success:', response2.data.message);
        console.log(`   Tokens found: ${response2.data.tokens.length}\n`);
        
        // Test 3: Pool-only search for WETH
        console.log('3️⃣ Testing pool-only search for "WETH"...');
        const response3 = await axios.get(`${BASE_URL}/search/pools?q=WETH&limit=5`);
        console.log('✅ Success:', response3.data.message);
        console.log(`   Pools found: ${response3.data.pools.length}\n`);
        
        // Test 4: Empty state (no query)
        console.log('4️⃣ Testing empty state (no query)...');
        const response4 = await axios.get(`${BASE_URL}/search`);
        console.log('✅ Success:', response4.data.message);
        console.log(`   Default tokens: ${response4.data.tokens.length}, Default pools: ${response4.data.pools.length}\n`);
        
        // Test 5: Search with no results
        console.log('5️⃣ Testing search with no results...');
        const response5 = await axios.get(`${BASE_URL}/search?q=XYZ123`);
        console.log('✅ Success:', response5.data.message);
        console.log(`   Suggestions tokens: ${response5.data.suggestions?.tokens?.length || 0}, Suggestions pools: ${response5.data.suggestions?.pools?.length || 0}\n`);
        
        // Test 6: Search with custom limit
        console.log('6️⃣ Testing search with custom limit...');
        const response6 = await axios.get(`${BASE_URL}/search?q=ETH&limit=3`);
        console.log('✅ Success:', response6.data.message);
        console.log(`   Results: ${response6.data.totalResults}\n`);
        
        console.log('🎉 All tests passed successfully!');
        
    } catch (error) {
        console.error('❌ Test failed:', error.response?.data || error.message);
        
        if (error.code === 'ECONNREFUSED') {
            console.log('\n💡 Make sure the server is running: npm start');
        }
    }
};

// Run tests
testSearch();

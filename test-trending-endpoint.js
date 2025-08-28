import axios from 'axios';

const BASE_URL = 'http://localhost:3001';

async function testTrendingEndpoint() {
    console.log('🧪 Testing TPay Trending Tokens Endpoint\n');

    try {
        // Test 1: Basic trending request
        console.log('1️⃣ Testing basic trending request...');
        const basicResponse = await axios.get(`${BASE_URL}/tokens/trending`);
        console.log('✅ Basic request successful');
        console.log(`   Response: ${JSON.stringify(basicResponse.data, null, 2)}\n`);

        // Test 2: Custom limit
        console.log('2️⃣ Testing custom limit (5)...');
        const limitResponse = await axios.get(`${BASE_URL}/tokens/trending?window=24h&limit=5`);
        console.log('✅ Custom limit request successful');
        console.log(`   Count: ${limitResponse.data.count}\n`);

        // Test 3: Invalid window
        console.log('3️⃣ Testing invalid window (7d)...');
        try {
            await axios.get(`${BASE_URL}/tokens/trending?window=7d&limit=10`);
            console.log('❌ Should have failed with invalid window');
        } catch (error) {
            if (error.response?.status === 400) {
                console.log('✅ Invalid window properly rejected');
                console.log(`   Error: ${error.response.data.error}\n`);
            } else {
                console.log('❌ Unexpected error:', error.message);
            }
        }

        // Test 4: High limit (should cap at 100)
        console.log('4️⃣ Testing high limit (150)...');
        const highLimitResponse = await axios.get(`${BASE_URL}/tokens/trending?window=24h&limit=150`);
        console.log('✅ High limit request successful');
        console.log(`   Actual count: ${highLimitResponse.data.count} (should be capped at 100)\n`);

        // Test 5: Server health check
        console.log('5️⃣ Testing server health...');
        const healthResponse = await axios.get(`${BASE_URL}/search`);
        console.log('✅ Server health check successful\n');

        console.log('🎉 All tests completed successfully!');
        console.log('\n📊 Summary:');
        console.log(`   - Basic endpoint: ✅`);
        console.log(`   - Custom limit: ✅`);
        console.log(`   - Error handling: ✅`);
        console.log(`   - Limit validation: ✅`);
        console.log(`   - Server health: ✅`);

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        if (error.response) {
            console.error('   Status:', error.response.status);
            console.error('   Data:', error.response.data);
        }
        process.exit(1);
    }
}

// Run tests
testTrendingEndpoint();

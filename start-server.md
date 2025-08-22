# TPay Swap API Server Startup Guide

## Prerequisites
- Node.js 18+ installed
- npm or yarn package manager
- A funded wallet private key for custodial swaps (optional)

## Step 1: Install Dependencies
```bash
cd tpay-backend
npm install
```

## Step 2: Environment Configuration
1. Copy `env.template` to `.env`:
```bash
cp env.template .env
```

2. Edit `.env` file with your configuration:
```bash
# Required - Replace with your actual values
RPC_URL=https://polygon-rpc.com
PRIVATE_KEY=your_64_character_private_key_here_without_0x_prefix

# Optional - These have good defaults
PORT=3001
DEFAULT_CHAIN_ID=137
FORCE_CHAIN_ID=137
```

### RPC URL Options:
- **Polygon Mainnet**: `https://polygon-rpc.com` (free)
- **Polygon Mumbai Testnet**: `https://rpc-mumbai.maticvigil.com` (free)
- **Ethereum Mainnet**: `https://eth-mainnet.g.alchemy.com/v2/YOUR_API_KEY`
- **Local Hardhat**: `http://localhost:8545`

### Private Key:
- Must be 64 characters (no 0x prefix)
- Only required if testing custodial swaps (`/dex/swap`)
- For non-custodial testing (`/dex/swap/populate`), you can use any valid format

## Step 3: Start the Server
```bash
npm start
```

You should see:
```
Server running on port 3001
Connected to chain ID: 137
Using Uniswap V3 addresses for chain 137: { quoter: '0x61fFE...', router: '0xE5924...' }
Blockchain initialization completed successfully
```

## Step 4: Test Basic Connectivity
```bash
# Test if server is running
curl http://localhost:3001/dex/chain-info

# Should return chain information
```

## Step 5: Import Postman Collection
1. Open Postman
2. Click "Import" button
3. Select the file: `TPay_Swap_API.postman_collection.json`
4. The collection will be imported with all endpoints ready to test

## Testing Order (Recommended)
1. **Start with GET endpoints** (no blockchain interaction):
   - `GET /dex/chain-info`
   - `GET /dex/operational-status`

2. **Test basic functionality**:
   - `GET /dex/tokens`
   - `GET /dex/balance/{token}/{user}`

3. **Test quote functionality**:
   - `POST /dex/quote` (basic)
   - `POST /dex/quote` (validation tests)

4. **Test swap population** (non-custodial):
   - `POST /dex/swap/populate` (valid params)
   - `POST /dex/swap/populate` (validation tests)

5. **Test custodial swap** (optional):
   - `POST /dex/swap` (requires funded private key)

## Troubleshooting

### Common Issues:

1. **"Failed to initialize blockchain"**
   - Check RPC_URL is accessible
   - Verify network connectivity
   - Try different RPC endpoint

2. **"Invalid private key"**
   - Ensure private key is 64 characters
   - Remove any 0x prefix
   - Check for extra spaces

3. **"Token validation failed"**
   - Verify token addresses in .env
   - Check if tokens exist on the specified chain

4. **"Service temporarily unavailable"**
   - Wait for blockchain initialization
   - Check server logs for specific errors

### Test RPC Endpoints:
- **Polygon**: `https://polygon-rpc.com`
- **Mumbai**: `https://rpc-mumbai.maticvigil.com`
- **Ethereum**: `https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY`

## Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| RPC_URL | Yes | - | Blockchain RPC endpoint |
| PRIVATE_KEY | Yes* | - | 64-char hex private key |
| PORT | No | 3001 | Server port |
| DEFAULT_CHAIN_ID | No | 137 | Default chain (Polygon) |
| FORCE_CHAIN_ID | No | - | Force specific chain |
| WETH_ADDRESS | No | Auto | WETH token address |
| WMATIC_ADDRESS | No | Auto | WMATIC token address |

*Only required for custodial swaps

## Next Steps
After successful testing:
1. Review the `SAFETY_UPGRADES.md` for implementation details
2. Check `test/safety-upgrades.test.js` for unit tests
3. Integrate with frontend using the provided endpoints
4. Monitor server logs for any issues during testing

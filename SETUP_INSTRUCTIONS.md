# TPay Backend Setup Instructions

## Prerequisites

1. **Node.js** (v16 or higher)
2. **PostgreSQL** (v12 or higher)
3. **Git**

## Installation Steps

### 1. Clone and Install Dependencies

```bash
cd tpay-backend
npm install
```

### 2. Environment Configuration

Create a `.env` file in the root directory:

```bash
# PostgreSQL Configuration
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=tpay
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_password_here

# Ethereum Configuration (Sepolia Testnet)
RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_API_KEY
PRIVATE_KEY=your_64_character_private_key_here_without_0x_prefix
DEFAULT_CHAIN_ID=11155111
FORCE_CHAIN_ID=11155111

# Token Addresses (Sepolia Testnet)
WETH_ADDRESS=0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9
USDC_ADDRESS=0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8
USDT_ADDRESS=0x7169D38820dfd117C3FA1f22a697dba58d90BA06

# Price Feed Configuration
COINGECKO_API_KEY=your_coingecko_api_key_here
CHAINLINK_API_KEY=your_chainlink_api_key_here

# Security Configuration
EMERGENCY_PAUSE=false
MAX_SLIPPAGE_THRESHOLD=0.05
MAX_PRICE_DEVIATION=0.03

# Server Configuration
PORT=3001
NODE_ENV=development

# WETH Fallback Price (USD)
WETH_USD_FALLBACK=2000
```

### 3. Database Setup

```bash
# Create PostgreSQL database
psql -U postgres
CREATE DATABASE tpay;
\q

# Initialize database tables
npm run db:init

# Seed with initial data
npm run db:seed
```

### 4. Start the Server

```bash
npm start
```

The server will start on `http://localhost:3001`

## API Endpoints

### Frontend-Optimized Endpoints

- **GET** `/frontend/tokens` - Get all supported tokens
- **GET** `/frontend/token/:address` - Get specific token info
- **POST** `/frontend/quote` - Get swap quote
- **POST** `/frontend/swap/validate` - Validate swap parameters
- **POST** `/frontend/swap/execute` - Execute swap
- **GET** `/frontend/swap/:swapId` - Get swap status
- **GET** `/frontend/user/:address/swaps` - Get user swap history
- **GET** `/frontend/stats` - Get platform statistics
- **GET** `/frontend/health` - Health check

### Legacy Endpoints (Still Available)

- **POST** `/dex/swap` - Custodial swap execution
- **POST** `/dex/swap/populate` - Non-custodial transaction population
- **POST** `/quote` - Quote generation
- **GET** `/tokens` - Token management

## Testing

### Using Postman

1. Import the collection: `TPay_Frontend_API.postman_collection.json`
2. Set environment variables:
   - `base_url`: `http://localhost:3001`
   - `weth_address`: `0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9`
   - `usdc_address`: `0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8`
   - `user_address`: Your test wallet address

### Using cURL

```bash
# Get tokens
curl -X GET "http://localhost:3001/frontend/tokens?chainId=11155111"

# Get quote
curl -X POST "http://localhost:3001/frontend/quote" \
  -H "Content-Type: application/json" \
  -d '{
    "tokenIn": "0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9",
    "tokenOut": "0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8",
    "amountIn": "1.0",
    "slippagePct": 0.5,
    "userAddress": "0x742d35Cc6634C0532925a3b8D4C9Db96C4b4d8b6"
  }'

# Health check
curl -X GET "http://localhost:3001/frontend/health"
```

## Frontend Integration

### React/Next.js Example

```javascript
// API configuration
const API_BASE_URL = 'http://localhost:3001/frontend';

// Get supported tokens
export const getTokens = async (chainId = '11155111') => {
  const response = await fetch(`${API_BASE_URL}/tokens?chainId=${chainId}`);
  const data = await response.json();
  return data.tokens;
};

// Get quote
export const getQuote = async (tokenIn, tokenOut, amountIn, userAddress) => {
  const response = await fetch(`${API_BASE_URL}/quote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tokenIn,
      tokenOut,
      amountIn,
      slippagePct: 0.5,
      userAddress
    })
  });
  const data = await response.json();
  return data.quote;
};

// Execute swap
export const executeSwap = async (swapParams) => {
  const response = await fetch(`${API_BASE_URL}/swap/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(swapParams)
  });
  const data = await response.json();
  return data.swap;
};
```

## Security Features

1. **Rate Limiting**: 60 requests per minute per IP
2. **MEV Protection**: Automatic detection of potential attacks
3. **Slippage Protection**: Maximum slippage limits enforced
4. **Input Validation**: Comprehensive parameter validation
5. **Sanctions Checking**: Address validation against sanctions lists

## Monitoring

### Health Check

```bash
curl http://localhost:3001/frontend/health
```

### Logs

Check console output for:
- Database connection status
- Price feed updates
- Security alerts
- Error messages

## Troubleshooting

### Common Issues

1. **Database Connection Failed**
   - Check PostgreSQL is running
   - Verify connection credentials in `.env`
   - Ensure database exists

2. **Price Feed Errors**
   - Check API keys in `.env`
   - Verify network connectivity
   - Check rate limits on external APIs

3. **Swap Execution Failed**
   - Verify RPC URL and private key
   - Check token addresses are correct
   - Ensure sufficient gas balance

### Debug Mode

Enable debug logging by setting:
```bash
LOG_LEVEL=debug
```

## Production Deployment

### Environment Variables for Production

```bash
NODE_ENV=production
PORT=3001
POSTGRES_URI=postgresql://user:pass@host:port/db
RPC_URL=https://mainnet.infura.io/v3/YOUR_API_KEY
DEFAULT_CHAIN_ID=1
EMERGENCY_PAUSE=false
```

### Security Considerations

1. Use environment variables for sensitive data
2. Enable HTTPS in production
3. Set up proper firewall rules
4. Monitor rate limiting and security alerts
5. Regular database backups

## Support

For technical support:
1. Check the logs for error messages
2. Verify all environment variables are set
3. Test with the provided Postman collection
4. Contact the development team

## API Documentation

Complete API documentation is available in `FRONTEND_API_DOCS.md`

# TPay Frontend API Documentation

## Base URL
```
http://localhost:3001/frontend
```

## Authentication
All endpoints require rate limiting. No API keys needed for basic functionality.

## Endpoints

### 1. Get Supported Tokens
**GET** `/tokens`

Get all supported tokens with current prices and metadata.

**Query Parameters:**
- `chainId` (optional): Chain ID (default: 11155111 for Sepolia)

**Response:**
```json
{
  "success": true,
  "tokens": [
    {
      "address": "0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9",
      "symbol": "WETH",
      "name": "Wrapped Ether",
      "decimals": 18,
      "logoURI": "https://tokens.1inch.io/0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9.png",
      "priceUSD": 2000.50,
      "volume24h": 1500000.00,
      "isStablecoin": false,
      "verified": true
    }
  ],
  "chainId": 11155111,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### 2. Get Token Information
**GET** `/token/:address`

Get specific token information with current price.

**Path Parameters:**
- `address`: Token contract address

**Query Parameters:**
- `chainId` (optional): Chain ID

**Response:**
```json
{
  "success": true,
  "token": {
    "address": "0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9",
    "symbol": "WETH",
    "name": "Wrapped Ether",
    "decimals": 18,
    "logoURI": "https://tokens.1inch.io/0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9.png",
    "priceUSD": 2000.50,
    "volume24h": 1500000.00,
    "marketCap": 50000000000.00,
    "isStablecoin": false,
    "verified": true
  },
  "chainId": 11155111,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### 3. Get Quote
**POST** `/quote`

Get optimized quote for swap with price impact calculation.

**Request Body:**
```json
{
  "tokenIn": "0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9",
  "tokenOut": "0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8",
  "amountIn": "1.0",
  "slippagePct": 0.5,
  "chainId": "11155111",
  "userAddress": "0x742d35Cc6634C0532925a3b8D4C9Db96C4b4d8b6"
}
```

**Response:**
```json
{
  "success": true,
  "quote": {
    "quoteId": "q_abc123def456",
    "tokenIn": {
      "address": "0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9",
      "amount": "1.0"
    },
    "tokenOut": {
      "address": "0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8",
      "amount": "2000.50"
    },
    "priceImpact": 0.1,
    "slippage": 0.5,
    "route": [
      {
        "tokenIn": "0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9",
        "tokenOut": "0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8",
        "fee": 3000
      }
    ],
    "estimatedGas": "150000",
    "expiresAt": 1705312200,
    "fromCache": false
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### 4. Validate Swap
**POST** `/swap/validate`

Validate swap parameters before execution.

**Request Body:**
```json
{
  "tokenIn": "0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9",
  "tokenOut": "0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8",
  "amountIn": "1.0",
  "slippageTolerance": 0.5,
  "userAddress": "0x742d35Cc6634C0532925a3b8D4C9Db96C4b4d8b6"
}
```

**Response:**
```json
{
  "success": true,
  "valid": true,
  "errors": [],
  "warnings": [],
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### 5. Execute Swap
**POST** `/swap/execute`

Execute swap with enhanced security validation.

**Request Body:**
```json
{
  "tokenIn": "0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9",
  "tokenOut": "0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8",
  "amountIn": "1.0",
  "recipient": "0x742d35Cc6634C0532925a3b8D4C9Db96C4b4d8b6",
  "slippageTolerance": 0.5,
  "ttl": 600,
  "userAddress": "0x742d35Cc6634C0532925a3b8D4C9Db96C4b4d8b6",
  "clientRequestId": "unique_request_id"
}
```

**Response:**
```json
{
  "success": true,
  "swap": {
    "id": "swap_uuid_here",
    "status": "pending",
    "txHash": null,
    "tokenIn": {
      "address": "0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9",
      "amount": "1.0"
    },
    "tokenOut": {
      "address": "0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8",
      "amount": "2000.50"
    },
    "gasUsed": null,
    "blockNumber": null
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### 6. Get Swap Status
**GET** `/swap/:swapId`

Get swap status and details.

**Path Parameters:**
- `swapId`: Swap UUID

**Response:**
```json
{
  "success": true,
  "swap": {
    "id": "swap_uuid_here",
    "status": "completed",
    "txHash": "0x1234567890abcdef...",
    "tokenIn": {
      "address": "0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9",
      "amount": "1.0"
    },
    "tokenOut": {
      "address": "0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8",
      "amount": "2000.50"
    },
    "slippage": 0.5,
    "gasUsed": 150000,
    "blockNumber": 12345678,
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:15.000Z"
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### 7. Get User Swap History
**GET** `/user/:address/swaps`

Get user's swap history with pagination.

**Path Parameters:**
- `address`: User wallet address

**Query Parameters:**
- `limit` (optional): Number of results (default: 20)
- `offset` (optional): Pagination offset (default: 0)
- `status` (optional): Filter by status (pending, completed, failed)

**Response:**
```json
{
  "success": true,
  "swaps": [
    {
      "id": "swap_uuid_here",
      "status": "completed",
      "txHash": "0x1234567890abcdef...",
      "tokenIn": {
        "address": "0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9",
        "amount": "1.0"
      },
      "tokenOut": {
        "address": "0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8",
        "amount": "2000.50"
      },
      "slippage": 0.5,
      "gasUsed": 150000,
      "createdAt": "2024-01-15T10:30:00.000Z"
    }
  ],
  "pagination": {
    "total": 25,
    "limit": 20,
    "offset": 0,
    "hasMore": true
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### 8. Get Platform Statistics
**GET** `/stats`

Get platform statistics for dashboard.

**Query Parameters:**
- `chainId` (optional): Chain ID
- `timeRange` (optional): Time range (1h, 24h, 7d, 30d)

**Response:**
```json
{
  "success": true,
  "stats": {
    "swaps": {
      "totalSwaps": 1250,
      "totalVolumeIn": 5000000.00,
      "totalVolumeOut": 5000000.00
    },
    "tokens": {
      "totalTokens": 150,
      "activeTokens": 120
    },
    "quotes": {
      "totalQuotes": 5000,
      "usedQuotes": 1250,
      "expiredQuotes": 3750
    },
    "timeRange": "24h",
    "chainId": 11155111
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### 9. Health Check
**GET** `/health`

Check API health status.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "services": {
    "database": "connected",
    "priceFeeds": "active",
    "security": "enabled",
    "rateLimit": "active"
  },
  "version": "1.0.0"
}
```

## Error Responses

All endpoints return consistent error responses:

```json
{
  "success": false,
  "error": "Error message",
  "details": "Detailed error information",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## Rate Limiting

- **Limit**: 60 requests per minute per IP
- **Headers**: 
  - `X-RateLimit-Limit`: 60
  - `X-RateLimit-Window`: 1m
  - `X-RateLimit-Remaining`: 59

## Security Features

1. **MEV Protection**: Automatic detection of potential MEV attacks
2. **Slippage Protection**: Maximum slippage limits enforced
3. **Rate Limiting**: Prevents abuse and DDoS attacks
4. **Input Validation**: Comprehensive parameter validation
5. **Sanctions Checking**: Address validation against sanctions lists

## Frontend Integration Examples

### React/Next.js Example

```javascript
// Get supported tokens
const getTokens = async () => {
  const response = await fetch('/frontend/tokens?chainId=11155111');
  const data = await response.json();
  return data.tokens;
};

// Get quote
const getQuote = async (tokenIn, tokenOut, amountIn) => {
  const response = await fetch('/frontend/quote', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tokenIn,
      tokenOut,
      amountIn,
      slippagePct: 0.5,
      userAddress: userAddress
    })
  });
  const data = await response.json();
  return data.quote;
};

// Execute swap
const executeSwap = async (swapParams) => {
  const response = await fetch('/frontend/swap/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(swapParams)
  });
  const data = await response.json();
  return data.swap;
};
```

## Testing

Use the provided Postman collections:
- `TPay_Frontend_API.postman_collection.json`
- `TPay_Swap_API.postman_collection.json`

## Support

For technical support or questions, contact the development team.

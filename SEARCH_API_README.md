# TPay Search API Documentation

## Overview

The TPay Search API provides comprehensive search functionality for both tokens and pools, allowing users to quickly find the best markets and tokens. The search results are grouped by type and sorted by relevance score for optimal user experience.

## Features

- **Combined Search**: Search both tokens and pools in a single request
- **Relevance Scoring**: Results are scored and sorted by relevance (symbol match > name match > address prefix)
- **Empty State Handling**: Provides helpful suggestions when no results are found
- **Performance Optimized**: Uses MongoDB indexes and parallel queries for fast results
- **Flexible Limits**: Configurable result limits (1-100 per category)

## API Endpoints

### 1. Combined Search
**GET** `/search?q={query}&limit={limit}`

Searches both tokens and pools simultaneously.

**Query Parameters:**
- `q` (required): Search query string
- `limit` (optional): Maximum results per category (default: 20, max: 100)

**Response Format:**
```json
{
  "success": true,
  "query": "WETH",
  "tokens": [...],
  "pools": [...],
  "totalResults": 5,
  "message": "Found 5 results for \"WETH\"",
  "isEmptyState": false
}
```

**Example Request:**
```bash
GET /search?q=WETH&limit=10
```

### 2. Token-Only Search
**GET** `/search/tokens?q={query}&limit={limit}`

Searches only tokens.

**Example Request:**
```bash
GET /search/tokens?q=USD&limit=15
```

### 3. Pool-Only Search
**GET** `/search/pools?q={query}&limit={limit}`

Searches only pools.

**Example Request:**
```bash
GET /search/pools?q=WETH&limit=10
```

## Relevance Scoring

### Token Scoring
- **Symbol exact match**: 1000 points
- **Symbol starts with query**: 500 points
- **Symbol contains query**: 300 points
- **Name exact match**: 800 points
- **Name starts with query**: 400 points
- **Name contains query**: 200 points
- **Address prefix match**: 100 points
- **Essential token bonus**: 50 points

### Pool Scoring
- **Token symbol exact match**: 1000 points
- **Token symbol starts with query**: 500 points
- **Token symbol contains query**: 300 points
- **Token name exact match**: 800 points
- **Token name starts with query**: 400 points
- **Token name contains query**: 200 points
- **Address prefix match**: 100 points
- **Liquidity bonus**: Up to 100 points based on liquidity

## Database Schema

### Token Collection
```javascript
{
  address: String,        // Token contract address
  symbol: String,         // Token symbol (e.g., "WETH")
  name: String,           // Token name (e.g., "Wrapped Ether")
  decimals: Number,       // Token decimals
  totalSupply: String,    // Total supply as string
  chainId: Number,        // Blockchain network ID
  isEssential: Boolean,   // Whether it's a pre-configured token
  isActive: Boolean,      // Whether the token is active
  createdAt: Date,        // Creation timestamp
  updatedAt: Date         // Last update timestamp
}
```

### Pool Collection
```javascript
{
  pairAddress: String,    // Pool contract address
  token0: {               // First token in the pair
    address: String,
    symbol: String,
    name: String,
    decimals: Number
  },
  token1: {               // Second token in the pair
    address: String,
    symbol: String,
    name: String,
    decimals: Number
  },
  chainId: Number,        // Blockchain network ID
  isActive: Boolean,      // Whether the pool is active
  liquidity: String,      // Total liquidity as string
  volume24h: String,      // 24h volume as string
  fee: Number,            // Pool fee in basis points
  createdAt: Date,        // Creation timestamp
  updatedAt: Date         // Last update timestamp
}
```

## Database Indexes

The following indexes are created for optimal search performance:

### Token Indexes
- `{ symbol: 1, name: 1, address: 1 }` - Compound index for general queries
- `{ symbol: 'text', name: 'text' }` - Text index for full-text search
- `{ chainId: 1, isActive: 1 }` - Filtering by chain and status

### Pool Indexes
- `{ 'token0.symbol': 1, 'token1.symbol': 1 }` - Token symbol pairs
- `{ 'token0.address': 1, 'token1.address': 1 }` - Token address pairs
- `{ pairAddress: 1 }` - Pool address lookup
- `{ chainId: 1, isActive: 1 }` - Filtering by chain and status
- `{ 'token0.symbol': 'text', 'token1.symbol': 'text' }` - Text index for symbols

## Setup Instructions

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Configuration
Create a `.env` file based on `env.template`:
```bash
# MongoDB Configuration
MONGODB_URI=mongodb://localhost:27017/tpay

# Other required variables...
```

### 3. Start MongoDB
Ensure MongoDB is running on your system:
```bash
# Start MongoDB service
mongod
```

### 4. Seed Database
Populate the database with initial data:
```bash
npm run seed
```

### 5. Start Server
```bash
npm start
```

## Testing the API

### Test Search Endpoints
```bash
# Combined search
curl "http://localhost:3001/search?q=WETH&limit=5"

# Token-only search
curl "http://localhost:3001/search/tokens?q=USD&limit=10"

# Pool-only search
curl "http://localhost:3001/search/pools?q=WETH&limit=5"
```

### Test Empty State
```bash
# Search with no query (returns defaults)
curl "http://localhost:3001/search"

# Search with no results (returns suggestions)
curl "http://localhost:3001/search?q=XYZ123"
```

## Error Handling

The API returns appropriate HTTP status codes and error messages:

- **200**: Successful search
- **400**: Invalid parameters (missing query, invalid limit)
- **500**: Internal server error

Error response format:
```json
{
  "success": false,
  "error": "Error description",
  "message": "Detailed error message"
}
```

## Performance Considerations

- **Indexing**: All search fields are properly indexed for fast queries
- **Parallel Queries**: Token and pool searches run concurrently
- **Result Limiting**: Configurable limits prevent excessive data transfer
- **Lean Queries**: Uses MongoDB's lean() method for faster object creation
- **Connection Pooling**: MongoDB connection is reused across requests

## Future Enhancements

- **Fuzzy Search**: Implement fuzzy matching for typos
- **Search Suggestions**: Auto-complete functionality
- **Search Analytics**: Track popular search terms
- **Caching**: Redis integration for frequently searched terms
- **Multi-language Support**: Internationalization for token names

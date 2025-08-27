# TPay Search API Setup Guide

## Quick Start

This guide will help you set up and test the new TPay Search API with MongoDB integration.

## Prerequisites

- Node.js (v16 or higher)
- MongoDB (v4.4 or higher)
- npm or yarn package manager

## Step 1: Install Dependencies

```bash
cd tpay-backend
npm install
```

This will install the new MongoDB dependencies:
- `mongodb` - MongoDB driver
- `mongoose` - MongoDB ODM

## Step 2: Configure Environment

1. Copy the environment template:
```bash
cp env.template .env
```

2. Edit `.env` and add your MongoDB connection string:
```bash
# MongoDB Configuration
MONGODB_URI=mongodb://localhost:27017/tpay

# Other required variables...
RPC_URL=https://sepolia.infura.io/v3/YOUR_API_KEY
PRIVATE_KEY=your_64_character_private_key_here
```

## Step 3: Start MongoDB

### Option A: Local MongoDB
```bash
# Start MongoDB service
mongod

# Or if using MongoDB as a service
sudo systemctl start mongod
```

### Option B: MongoDB Atlas (Cloud)
1. Create a free account at [MongoDB Atlas](https://www.mongodb.com/atlas)
2. Create a cluster
3. Get your connection string
4. Update `.env` with your Atlas connection string

## Step 4: Seed the Database

Populate the database with initial test data:
```bash
npm run seed
```

This will create:
- 5 sample tokens (WETH, USDC, USDT, DAI, LINK)
- 4 sample pools (WETH/USDC, WETH/USDT, USDC/USDT, WETH/DAI)

## Step 5: Start the Server

```bash
npm start
```

The server will start on port 3001 (or your configured PORT).

## Step 6: Test the API

### Test Search Endpoints
```bash
# Combined search
curl "http://localhost:3001/search?q=WETH&limit=5"

# Token-only search
curl "http://localhost:3001/search/tokens?q=USD&limit=10"

# Pool-only search
curl "http://localhost:3001/search/pools?q=WETH&limit=5"
```

### Run Automated Tests
```bash
npm run test:search
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/search` | GET | Combined search for tokens and pools |
| `/search/tokens` | GET | Search tokens only |
| `/search/pools` | GET | Search pools only |

## Query Parameters

- `q` (required): Search query string
- `limit` (optional): Maximum results per category (1-100, default: 20)

## Example Responses

### Successful Search
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

### Empty State (No Results)
```json
{
  "success": true,
  "query": "XYZ123",
  "tokens": [],
  "pools": [],
  "totalResults": 0,
  "message": "No search results found. Here are some popular options:",
  "isEmptyState": true,
  "suggestions": {
    "tokens": [...],
    "pools": [...]
  }
}
```

## Troubleshooting

### Common Issues

1. **MongoDB Connection Failed**
   - Ensure MongoDB is running
   - Check your connection string in `.env`
   - Verify network access (for Atlas)

2. **Port Already in Use**
   - Change PORT in `.env`
   - Kill existing process: `lsof -ti:3001 | xargs kill`

3. **Database Seeding Failed**
   - Check MongoDB connection
   - Ensure you have write permissions
   - Check console for specific error messages

### Debug Mode

Enable debug logging by setting environment variable:
```bash
DEBUG=mongoose:*
npm start
```

## Database Management

### View Collections
```bash
# Connect to MongoDB shell
mongosh

# Switch to tpay database
use tpay

# View collections
show collections

# View sample documents
db.tokens.find().limit(5)
db.pools.find().limit(5)
```

### Reset Database
```bash
# Clear all data
npm run seed
```

## Performance Tips

- **Indexes**: All necessary indexes are created automatically
- **Connection Pooling**: MongoDB connection is reused across requests
- **Query Optimization**: Uses lean() queries for faster results
- **Parallel Processing**: Token and pool searches run concurrently

## Next Steps

1. **Customize Data**: Modify `src/scripts/seedDatabase.js` to add your own tokens/pools
2. **Add Authentication**: Integrate with your existing auth system
3. **Rate Limiting**: Add rate limiting for production use
4. **Caching**: Implement Redis for frequently searched terms
5. **Analytics**: Track search patterns and popular queries

## Support

If you encounter issues:
1. Check the console logs for error messages
2. Verify MongoDB connection and permissions
3. Ensure all environment variables are set correctly
4. Check the [SEARCH_API_README.md](./SEARCH_API_README.md) for detailed API documentation

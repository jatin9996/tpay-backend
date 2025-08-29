# Exact-Out Quotes (Reverse Mode) Implementation

## Overview

This document describes the implementation of Exact-Out Quotes (reverse mode) functionality for the TPay backend. This feature allows users to specify exactly how much of a token they want to receive, and the system calculates the required input amount.

## What/Why

Many UIs allow users to specify "I want to receive exactly X" instead of "I want to spend exactly Y". This reverse mode is particularly useful for:

- **Precise Output Control**: Users know exactly how much they'll receive
- **Budget Planning**: Users can plan their expenses based on desired output
- **DeFi Strategies**: Useful for yield farming, arbitrage, and other DeFi operations
- **User Experience**: More intuitive for users who think in terms of desired outcomes

## New Endpoints

### 1. POST /quote/exact-out

**Purpose**: Get a quote for exact-out swap (how much input needed for desired output)

**Request Body**:
```json
{
  "tokenIn": "0x...",           // Input token address
  "tokenOut": "0x...",          // Output token address  
  "amountOut": "100",           // Desired output amount
  "slippagePct": 0.5,          // Slippage tolerance (default: 0.5%)
  "ttlSec": 600                // Quote TTL in seconds (default: 600)
}
```

**Response**:
```json
{
  "route": [...],               // Best route found
  "path": "0x...",             // Encoded path for swap
  "amountIn": "0.05",          // Required input amount
  "amountInMaximum": "0.05025", // Maximum input with slippage
  "amountOut": "100",          // Desired output amount
  "quoteId": "q_...",          // Unique quote identifier
  "expiresAt": 1234567890,     // Quote expiration timestamp
  "mode": "EXACT_OUT"          // Quote mode
}
```

### 2. POST /swap/populate/exact-out

**Purpose**: Get populated transaction for non-custodial exact-out swap

**Request Body**:
```json
{
  "tokenIn": "0x...",           // Input token address
  "tokenOut": "0x...",          // Output token address
  "amountOut": "100",           // Desired output amount
  "recipient": "0x...",         // Recipient address
  "slippageTolerance": 0.5,    // Slippage tolerance (0.1% to 50%)
  "fee": 3000,                 // Pool fee tier (500, 3000, 10000)
  "ttlSec": 600                // Transaction TTL in seconds
}
```

**Response**:
```json
{
  "success": true,
  "chainId": "1",
  "populatedTransaction": {
    "to": "0x...",              // Router contract address
    "data": "0x...",            // Transaction data
    "gasLimit": 300000          // Estimated gas limit
  },
  "swapDetails": {
    "tokenIn": "0x...",
    "tokenOut": "0x...",
    "amountIn": "0.05",         // Required input amount
    "amountOut": "100",         // Desired output amount
    "mode": "EXACT_OUT"
  }
}
```

### 3. POST /swap/exact-out

**Purpose**: Execute custodial exact-out swap (backend executes transaction)

**Request Body**: Same as populate endpoint

**Response**:
```json
{
  "success": true,
  "chainId": "1",
  "txHash": "0x...",            // Transaction hash
  "swapDetails": {
    "txHash": "0x...",
    "status": "completed",
    "mode": "EXACT_OUT",
    "amountIn": "0.05",
    "amountOut": "100"
  }
}
```

## Technical Implementation

### Database Changes

#### Quote Model Updates
- Added `mode` field with enum: `['EXACT_IN', 'EXACT_OUT']`
- Reordered fields for consistency
- Default mode is `EXACT_IN` for backward compatibility

#### New Swap Model
- Created dedicated Swap model for tracking executed swaps
- Includes `mode` field for both exact-in and exact-out swaps
- Comprehensive tracking of swap details and status

### Core Logic Changes

#### 1. Reverse Math Implementation
```javascript
// For exact-out: calculate amountInMax given desired amountOut
const maxInWei = calcMinOutFromSlippage(best.amountIn, slippagePct, true);
// true flag indicates exact-out mode (adds slippage instead of subtracting)
```

#### 2. Slippage Calculation
```javascript
function calcMinOutFromSlippage(amount, slippagePct, isExactOut = false) {
  const bps = Math.floor(Number(slippagePct) * 100);
  const DENOM = 10_000n;
  
  if (isExactOut) {
    // For exact-out: add slippage to input amount
    return (BigInt(amount) * (DENOM + BigInt(bps))) / DENOM;
  } else {
    // For exact-in: subtract slippage from output amount
    return (BigInt(amount) * (DENOM - BigInt(bps))) / DENOM;
  }
}
```

#### 3. Route Optimization
- **Exact-In**: Optimize for highest `amountOut` given `amountIn`
- **Exact-Out**: Optimize for lowest `amountIn` given `amountOut`

#### 4. Uniswap V3 Integration
- Uses `quoteExactOutputSingle` and `quoteExactOutput` for exact-out quotes
- Uses `exactOutputSingle` for exact-out swaps
- Maintains same fee tier support (500, 3000, 10000)

### Error Handling

#### Quote Failures
- Insufficient liquidity
- Invalid token pairs
- Unsupported fee tiers
- Network/RPC errors

#### Swap Failures
- Slippage tolerance exceeded
- Transaction deadline expired
- Insufficient token approval
- Gas estimation failures

## Usage Examples

### 1. Get Exact-Out Quote
```bash
curl -X POST http://localhost:3000/quote/exact-out \
  -H "Content-Type: application/json" \
  -d '{
    "tokenIn": "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    "tokenOut": "0xA0b86a33E6441b8c4C8C8C8C8C8C8C8C8C8C8C8",
    "amountOut": "100",
    "slippagePct": 0.5
  }'
```

### 2. Get Populated Transaction
```bash
curl -X POST http://localhost:3000/swap/populate/exact-out \
  -H "Content-Type: application/json" \
  -d '{
    "tokenIn": "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    "tokenOut": "0xA0b86a33E6441b8c4C8C8C8C8C8C8C8C8C8C8C8",
    "amountOut": "100",
    "recipient": "0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6",
    "slippageTolerance": 0.5,
    "fee": 3000
  }'
```

### 3. Execute Custodial Swap
```bash
curl -X POST http://localhost:3000/swap/exact-out \
  -H "Content-Type: application/json" \
  -d '{
    "tokenIn": "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    "tokenOut": "0xA0b86a33E6441b8c4C8C8C8C8C8C8C8C8C8C8C8",
    "amountOut": "100",
    "recipient": "0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6",
    "slippageTolerance": 0.5,
    "fee": 3000
  }'
```

## Testing

### Test Script
Run the provided test script to verify functionality:
```bash
node test-exact-out.js
```

### Test Coverage
- ✅ Exact-out quote generation
- ✅ Exact-out transaction population
- ✅ Exact-out swap execution (custodial)
- ✅ Slippage calculation for exact-out mode
- ✅ Route optimization for exact-out
- ✅ Error handling and validation

## Security Considerations

### 1. Slippage Protection
- Exact-out mode uses `amountInMaximum` to prevent excessive input
- Slippage tolerance is validated (0.1% to 50%)
- Transaction reverts if slippage is exceeded

### 2. Input Validation
- Token addresses are validated and normalized
- Amounts are validated for positive values
- Fee tiers are restricted to supported values

### 3. Operational Limits
- Custodial swaps respect operational limits
- TTL validation prevents stale transactions
- Gas estimation with safety buffer

## Performance Considerations

### 1. Route Optimization
- Evaluates single-hop and multi-hop routes
- Caches provider and quoter instances
- Parallel route evaluation where possible

### 2. Database Efficiency
- TTL indexes for automatic cleanup
- Optimized indexes for common queries
- Efficient serialization of BigInt values

### 3. Gas Optimization
- Gas estimation with 20% safety buffer
- Efficient contract calls using staticCall
- Batch operations where possible

## Future Enhancements

### 1. Advanced Routing
- Multi-hop route optimization
- Cross-chain routing support
- MEV protection strategies

### 2. Analytics
- Swap success rate tracking
- Gas usage optimization
- Route performance analysis

### 3. User Experience
- Batch quote requests
- Quote comparison tools
- Historical quote tracking

## Troubleshooting

### Common Issues

#### 1. "No executable route/liquidity"
- Check if tokens have sufficient liquidity
- Verify fee tier support
- Ensure tokens are on supported chains

#### 2. "Slippage tolerance exceeded"
- Increase slippage tolerance
- Reduce output amount
- Check for high volatility

#### 3. "Quote failed"
- Verify RPC endpoint connectivity
- Check Uniswap V3 contract addresses
- Ensure proper token validation

### Debug Mode
Enable detailed logging by setting environment variable:
```bash
DEBUG=1 node src/index.js
```

## Conclusion

The Exact-Out Quotes implementation provides a powerful reverse mode for token swaps, allowing users to specify desired output amounts while maintaining the same security and efficiency as traditional exact-in swaps. The implementation follows TPay's architectural patterns and integrates seamlessly with existing functionality.

For questions or issues, refer to the test script and error handling documentation, or contact the development team.

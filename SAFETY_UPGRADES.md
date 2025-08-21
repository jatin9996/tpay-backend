# Safety & Correctness Upgrades - TPay Swap Router

This document outlines the comprehensive safety and correctness upgrades implemented in the TPay swap router to ensure secure, reliable, and compliant token swapping operations.

## 🚨 Critical Security Improvements

### 1. Fee Tier Validation
- **Before**: No validation of fee parameters
- **After**: Strict validation against valid Uniswap V3 fee tiers
- **Implementation**: Only allows fees: `[500, 3000, 10000]`
- **Code**: ```javascript
const VALID_FEES = new Set([500, 3000, 10000]);
function validateFee(fee) {
    if (!Number.isInteger(fee) || !VALID_FEES.has(Number(fee))) {
        throw new Error("Invalid pool fee; use 500, 3000, or 10000");
    }
    return fee;
}
```

### 2. Deadline Management & TTL Control
- **Before**: Fixed 10-minute deadline
- **After**: Configurable TTL with strict limits
- **Implementation**: 
  - Default TTL: 10 minutes (600 seconds)
  - Maximum TTL: 24 hours (configurable)
  - Minimum TTL: 1 minute
- **Code**: ```javascript
const MAX_TTL_SECONDS = 24 * 60 * 60;
function calculateDeadline(ttlSec = 600) {
    if (ttlSec <= 0 || ttlSec > MAX_TTL_SECONDS) {
        throw new Error(`TTL must be between 1 and ${MAX_TTL_SECONDS} seconds`);
    }
    return Math.floor(Date.now() / 1000) + ttlSec;
}
```

### 3. Quote Error Handling (Critical Fix)
- **Before**: Failed quotes set `expectedAmountOut = 0`, leading to `amountOutMinimum = 0`
- **Risk**: Users could get bad fills if liquidity exists
- **After**: **ABORT** if quote fails unless client explicitly allows "no slippage protection"
- **Code**: ```javascript
// OLD (DANGEROUS):
// expectedAmountOut = ethers.parseUnits("0", await getTokenDecimals(validatedTokenOut));

// NEW (SAFE):
return res.status(400).json({ 
    error: "Failed to get quote for slippage protection. Please try again or contact support if the issue persists." 
});
```

### 4. Address Normalization & Validation
- **Before**: Raw address handling
- **After**: Consistent address normalization using `ethers.getAddress()`
- **Implementation**: All addresses normalized upfront before validation
- **Code**: ```javascript
const normalizedTokenIn = ethers.getAddress(tokenInAddress);
const normalizedTokenOut = ethers.getAddress(tokenOutAddress);
```

### 5. Same Token Guard
- **Before**: No protection against swapping token for itself
- **After**: Explicit guard preventing self-swaps
- **Code**: ```javascript
if (normalizedTokenIn.toLowerCase() === normalizedTokenOut.toLowerCase()) {
    return res.status(400).json({ 
        error: "Cannot swap token for itself" 
    });
}
```

### 6. Reserve Sanity Check
- **Before**: No validation of quote amounts
- **After**: Reject if Quoter returns 0 (no liquidity)
- **Code**: ```javascript
if (quoteAmountOut <= 0n) {
    return res.status(400).json({ 
        error: "No executable route/liquidity for this pair" 
    });
}
```

### 7. Enhanced Slippage Calculation
- **Before**: Basic slippage calculation without validation
- **After**: Strict slippage range validation (0.1% to 50%)
- **Code**: ```javascript
function calcMinOutFromSlippage(expectedOutWei, slippagePct) {
    const bps = Math.round(Number(slippagePct) * 100);
    if (bps < 10 || bps > 5000) {
        throw new Error("Slippage must be between 0.1% and 50%");
    }
    const DENOM = 10_000n;
    return (BigInt(expectedOutWei) * (DENOM - BigInt(bps))) / DENOM;
}
```

## 🏗️ Architecture Improvements

### 8. Non-Custodial Swap Option
- **New Endpoint**: `POST /swap/populate`
- **Benefit**: Eliminates custodial risk
- **Implementation**: Returns populated transaction for user to sign
- **Code**: ```javascript
const populatedTx = await uniswapRouter.exactInputSingle.populateTransaction({
    tokenIn: validatedTokenIn,
    tokenOut: validatedTokenOut,
    fee: validatedFee,
    recipient: validatedRecipient,
    deadline: deadline,
    amountIn: amountInWei,
    amountOutMinimum: amountOutMinimum,
    sqrtPriceLimitX96: 0
});
```

### 9. Chain-Aware Responses
- **Before**: No chain information in responses
- **After**: All endpoints include `chainId` for frontend awareness
- **Implementation**: Consistent chain ID inclusion across all endpoints

## 📊 Operational Limits & Compliance

### 10. Operational Limits Configuration
- **File**: `src/config/operationalLimits.js`
- **Features**:
  - Daily volume caps
  - Per-user limits
  - Slippage restrictions
  - TTL boundaries
  - Gas limits
  - Risk management
  - Compliance monitoring
  - Emergency controls

### 11. Operational Status Endpoint
- **Endpoint**: `GET /operational-status`
- **Purpose**: Check if swaps are enabled and view current limits
- **Use Case**: Frontend can disable swap functionality when limits exceeded

## 🔧 Implementation Details

### Error Handling
All endpoints now provide:
- Specific error messages
- User-friendly descriptions
- Proper HTTP status codes
- Detailed error context

### Validation Flow
1. Address normalization
2. Same token guard
3. Fee validation
4. Operational limits check
5. Quote retrieval with sanity check
6. Slippage calculation
7. Transaction execution/population

### Gas Management
- Dynamic gas estimation
- 20% gas buffer for safety
- Maximum gas limit enforcement
- Gas price monitoring

## 🚀 Usage Examples

### Custodial Swap (Backend executes)
```bash
POST /swap
{
    "tokenIn": "0x...",
    "tokenOut": "0x...",
    "amountIn": "1.0",
    "recipient": "0x...",
    "slippageTolerance": 0.5,
    "fee": 3000,
    "ttlSec": 600
}
```

### Non-Custodial Swap (User signs)
```bash
POST /swap/populate
{
    "tokenIn": "0x...",
    "tokenOut": "0x...",
    "amountIn": "1.0",
    "recipient": "0x...",
    "slippageTolerance": 0.5,
    "fee": 3000,
    "ttlSec": 600
}
```

### Check Operational Status
```bash
GET /operational-status
```

## ⚠️ Important Notes

### Custodial vs Non-Custodial
- **Custodial** (`/swap`): Backend controls user funds - HIGH RISK
- **Non-Custodial** (`/swap/populate`): User maintains control - RECOMMENDED

### Operational Limits
- All custodial swaps are subject to operational limits
- Limits can be adjusted via admin functions
- Emergency controls can pause operations instantly

### Compliance Requirements
- Custodial operations require KYC/AML procedures
- Transaction logging for audit trails
- Sanctions list checking
- Suspicious activity reporting

## 🔍 Testing

### Unit Tests
- Fee validation
- TTL calculation
- Slippage calculation
- Address normalization
- Operational limits validation

### Integration Tests
- Quote endpoint with various scenarios
- Swap execution with different parameters
- Error handling for edge cases
- Chain ID consistency

### Security Tests
- Same token swap prevention
- Invalid fee rejection
- Quote failure handling
- Address validation

## 📈 Performance Impact

- **Minimal overhead**: Most validations are synchronous
- **Gas optimization**: Better gas estimation reduces failed transactions
- **Error reduction**: Fewer failed swaps due to validation
- **User experience**: Clear error messages reduce support requests

## 🔮 Future Enhancements

1. **Multi-hop support**: Exact input with encoded paths
2. **Advanced slippage protection**: Dynamic slippage adjustment
3. **MEV protection**: Flashbots integration
4. **Gas optimization**: EIP-1559 fee management
5. **Batch operations**: Multiple swaps in single transaction

## 📞 Support

For questions about these safety upgrades or to report security issues:
- Review the code changes in `src/routes/swap.js`
- Check operational limits in `src/config/operationalLimits.js`
- Test the new endpoints with various parameters
- Monitor logs for validation failures

---

**Last Updated**: $(date)
**Version**: 2.0.0
**Security Level**: Enhanced
**Compliance**: Operational Limits + Non-Custodial Options

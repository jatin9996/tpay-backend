# 🧪 **TPay Swap API - Mumbai Testnet Testing Guide**

## 🌐 **Testnet Configuration**

### **Network Details:**
- **Network**: Polygon Mumbai Testnet
- **Chain ID**: 80001
- **RPC URL**: `https://rpc-mumbai.maticvigil.com`
- **Block Explorer**: [https://mumbai.polygonscan.com](https://mumbai.polygonscan.com)
- **Faucet**: [https://faucet.polygon.technology](https://faucet.polygon.technology)

### **Testnet Token Addresses:**
| Token | Symbol | Address | Decimals |
|-------|--------|---------|----------|
| **WETH** | WETH | `0xA6FA4fB5f76172d178d61B04b0ecd319C5d1C0aa` | 18 |
| **WMATIC** | WMATIC | `0x9c3C9283D3e44854697Cd22D3Faa240Cfb032889` | 18 |
| **POL** | POL | `0x2e1AD108fF1D8c782fcBbB89AAd783aC49586756` | 18 |
| **USDC** | USDC | `0xe6b8a5CF854791412c1f6EFC7CAf629f5Df1c747` | 6 |
| **USDT** | USDT | `0xA02f6adc7926efeBBd59Fd43A84f4E0ba0C6F1C5` | 6 |

---

## 🚀 **Quick Setup for Testnet**

### **Step 1: Environment Configuration**
```bash
cd tpay-backend
cp env.template .env
```

**Your `.env` file should look like this:**
```bash
# TESTNET CONFIGURATION
RPC_URL=https://rpc-mumbai.maticvigil.com
PRIVATE_KEY=your_64_character_private_key_here_without_0x_prefix

# Optional Environment Variables
PORT=3001
DEFAULT_CHAIN_ID=80001
FORCE_CHAIN_ID=80001

# Token Addresses (Mumbai Testnet)
WETH_ADDRESS=0xA6FA4fB5f76172d178d61B04b0ecd319C5d1C0aa
WMATIC_ADDRESS=0x9c3C9283D3e44854697Cd22D3Faa240Cfb032889
POL_ADDRESS=0x2e1AD108fF1D8c782fcBbB89AAd783aC49586756
USDC_ADDRESS=0xe6b8a5CF854791412c1f6EFC7CAf629f5Df1c747
USDT_ADDRESS=0xA02f6adc7926efeBBd59Fd43A84f4E0ba0C6F1C5
```

### **Step 2: Get Testnet Tokens**
1. **Visit**: [https://faucet.polygon.technology](https://faucet.polygon.technology)
2. **Connect your wallet** (MetaMask)
3. **Switch to Mumbai network**
4. **Request test tokens**:
   - **MATIC**: 0.1 MATIC (for gas fees)
   - **WETH**: 0.01 WETH (for testing swaps)
   - **USDC**: 100 USDC (for testing)

### **Step 3: Install Dependencies & Start Server**
```bash
npm install
npm start
```

**Expected Output:**
```
Server running on port 3001
Connected to chain ID: 80001
Using Uniswap V3 addresses for chain 80001: { quoter: '0x...', router: '0x...' }
Blockchain initialization completed successfully
```

---

## 🧪 **Testnet Testing Checklist**

### **✅ Phase 1: Basic Connectivity**
- [ ] **Chain Info**: Should show Chain ID: 80001
- [ ] **Operational Status**: Should show swaps enabled
- [ ] **Token List**: Should show Mumbai testnet tokens
- [ ] **Balance Queries**: Should work with testnet addresses

### **✅ Phase 2: Quote System**
- [ ] **WETH → WMATIC Quote**: Test basic quote functionality
- [ ] **Fee Validation**: Test 500, 3000, 10000 fee tiers
- [ ] **Invalid Fee**: Test rejection of fee 2000
- [ ] **Same Token**: Test rejection of WETH → WETH

### **✅ Phase 3: Swap Population**
- [ ] **Valid Swap**: Test transaction population
- [ ] **Slippage Limits**: Test 0.1% to 5% range
- [ ] **TTL Limits**: Test 60s to 3600s range
- [ ] **Validation Errors**: Test edge cases

### **✅ Phase 4: Custodial Swaps (Optional)**
- [ ] **Actual Execution**: Test real swap on testnet
- [ ] **Transaction Confirmation**: Verify on Mumbai explorer
- [ ] **Gas Estimation**: Verify gas costs

---

## 🔍 **Testnet-Specific Testing**

### **1. Test Basic Endpoints**
```bash
# Test chain info
curl http://localhost:3001/dex/chain-info

# Expected: Chain ID: 80001, Network: matic
```

### **2. Test Token Validation**
```bash
# Test with Mumbai testnet addresses
curl -X POST http://localhost:3001/dex/quote \
  -H "Content-Type: application/json" \
  -d '{
    "tokenIn": "0xA6FA4fB5f76172d178d61B04b0ecd319C5d1C0aa",
    "tokenOut": "0x9c3C9283D3e44854697Cd22D3Faa240Cfb032889",
    "amountIn": "0.01",
    "fee": 3000
  }'
```

### **3. Test Swap Population**
```bash
curl -X POST http://localhost:3001/dex/swap/populate \
  -H "Content-Type: application/json" \
  -d '{
    "tokenIn": "0xA6FA4fB5f76172d178d61B04b0ecd319C5d1C0aa",
    "tokenOut": "0x9c3C9283D3e44854697Cd22D3Faa240Cfb032889",
    "amountIn": "0.01",
    "recipient": "0x742d35Cc6634C0532925a3b8D4C9Db96C4b4d8b6",
    "slippageTolerance": 0.5,
    "fee": 3000,
    "ttlSec": 600
  }'
```

---

## 📱 **Postman Collection for Testnet**

### **Import the Updated Collection:**
1. **File**: `TPay_Swap_API.postman_collection.json`
2. **Pre-configured**: All endpoints use Mumbai testnet addresses
3. **Variables**: Automatically set for testnet testing

### **Key Testnet Endpoints:**
- **Chain Info**: `GET /dex/chain-info` → Should return Chain ID: 80001
- **Quote**: `POST /dex/quote` → Test with Mumbai token addresses
- **Swap Populate**: `POST /dex/swap/populate` → Non-custodial testing
- **Custodial Swap**: `POST /dex/swap` → Real execution (if funded)

---

## 🎯 **Testnet Testing Scenarios**

### **Scenario 1: Basic Functionality**
1. **Start server** with Mumbai configuration
2. **Test chain info** - verify Chain ID: 80001
3. **Test token list** - verify Mumbai addresses
4. **Test balance queries** - verify connectivity

### **Scenario 2: Quote System**
1. **Test WETH → WMATIC quote** with 0.01 amount
2. **Test different fee tiers** (500, 3000, 10000)
3. **Test validation errors** (invalid fee, same token)
4. **Verify quote amounts** are reasonable

### **Scenario 3: Swap Population**
1. **Test valid swap population** with proper parameters
2. **Test slippage validation** (0.1% to 5%)
3. **Test TTL validation** (60s to 3600s)
4. **Verify transaction data** structure

### **Scenario 4: Real Execution (Optional)**
1. **Fund your test wallet** with Mumbai tokens
2. **Test actual swap execution** on testnet
3. **Verify transaction** on Mumbai explorer
4. **Check gas costs** and execution time

---

## 🚨 **Testnet-Specific Considerations**

### **Advantages of Testnet:**
- ✅ **Free tokens** from faucets
- ✅ **No real money** at risk
- ✅ **Fast transactions** (low gas)
- ✅ **Easy testing** of all features
- ✅ **No mainnet fees**

### **Testnet Limitations:**
- ⚠️ **Limited liquidity** in pools
- ⚠️ **Token prices** may be different
- ⚠️ **Network stability** may vary
- ⚠️ **Pool availability** may be limited

### **Testnet Best Practices:**
1. **Use small amounts** (0.01, 0.001)
2. **Test during low congestion** times
3. **Verify token addresses** are correct
4. **Check pool liquidity** before testing
5. **Monitor gas costs** (should be very low)

---

## 🔧 **Troubleshooting Testnet Issues**

### **Common Testnet Problems:**

#### **1. "Failed to initialize blockchain"**
```bash
# Check RPC URL
RPC_URL=https://rpc-mumbai.maticvigil.com

# Alternative RPC URLs:
RPC_URL=https://polygon-mumbai.g.alchemy.com/v2/YOUR_KEY
RPC_URL=https://rpc-mumbai.maticvigil.com
```

#### **2. "Token validation failed"**
```bash
# Verify Mumbai token addresses
WETH_ADDRESS=0xA6FA4fB5f76172d178d61B04b0ecd319C5d1C0aa
WMATIC_ADDRESS=0x9c3C9283D3e44854697Cd22D3Faa240Cfb032889
```

#### **3. "No executable route/liquidity"**
- Testnet pools may have limited liquidity
- Try smaller amounts (0.001 instead of 0.1)
- Check if pools exist on Mumbai

#### **4. "Service temporarily unavailable"**
- Wait for blockchain initialization
- Check network connectivity
- Verify RPC endpoint is accessible

---

## 📊 **Expected Testnet Results**

### **Successful Responses Should Include:**
- ✅ **Chain ID**: Always "80001" for Mumbai
- ✅ **Success Status**: `"success": true`
- ✅ **Token Addresses**: Mumbai testnet addresses
- ✅ **Quote Amounts**: Reasonable values (may be small)
- ✅ **Gas Estimates**: Low values (testnet gas is cheap)

### **Error Responses Should Include:**
- ✅ **Clear Error Messages**: Specific validation failures
- ✅ **HTTP Status Codes**: 400 for validation, 500 for server errors
- ✅ **Error Details**: Specific field validation errors
- ✅ **Operational Limits**: Clear limit information

---

## 🎉 **Ready for Testnet Testing!**

### **Your Setup is Now:**
- ✅ **Configured for Mumbai testnet**
- ✅ **Using testnet token addresses**
- ✅ **Postman collection updated**
- ✅ **Test script configured**
- ✅ **Environment template ready**

### **Next Steps:**
1. **Copy env.template to .env**
2. **Get testnet tokens** from faucet
3. **Start server** with `npm start`
4. **Import Postman collection**
5. **Run through testing checklist**
6. **Verify all safety features** working

### **Testnet Benefits:**
- 🆓 **Free testing** environment
- 🚀 **Fast execution** times
- 💰 **No real costs** involved
- 🧪 **Safe experimentation**
- 🔍 **Complete feature testing**

**You're now ready to test the complete TPay Swap API on Mumbai testnet!** 🎯

Start with the basic endpoints and work your way through the testing phases. The testnet environment will give you a safe, cost-free way to verify all the safety upgrades and functionality.

# 🚀 **Mumbai Testnet - Quick Reference**

## ⚡ **Quick Setup**
```bash
cd tpay-backend
cp env.template .env
npm install
npm start
```

## 🌐 **Network Info**
- **Network**: Mumbai Testnet
- **Chain ID**: 80001
- **RPC**: `https://rpc-mumbai.maticvigil.com`
- **Explorer**: [mumbai.polygonscan.com](https://mumbai.polygonscan.com)
- **Faucet**: [faucet.polygon.technology](https://faucet.polygon.technology)

## 🪙 **Testnet Tokens**
| Token | Address | Decimals |
|-------|---------|----------|
| **WETH** | `0xA6FA4fB5f76172d178d61B04b0ecd319C5d1C0aa` | 18 |
| **WMATIC** | `0x9c3C9283D3e44854697Cd22D3Faa240Cfb032889` | 18 |
| **USDC** | `0xe6b8a5CF854791412c1f6EFC7CAf629f5Df1c747` | 6 |

## 🧪 **Test Commands**
```bash
# Test connectivity
curl http://localhost:3001/dex/chain-info

# Test quote
curl -X POST http://localhost:3001/dex/quote \
  -H "Content-Type: application/json" \
  -d '{
    "tokenIn": "0xA6FA4fB5f76172d178d61B04b0ecd319C5d1C0aa",
    "tokenOut": "0x9c3C9283D3e44854697Cd22D3Faa240Cfb032889",
    "amountIn": "0.01",
    "fee": 3000
  }'
```

## ✅ **Expected Results**
- **Chain ID**: Always "80001"
- **Success**: `"success": true`
- **Gas**: Very low (testnet)
- **Tokens**: Mumbai addresses

## 🚨 **Common Issues**
- **RPC Error**: Check `https://rpc-mumbai.maticvigil.com`
- **Token Error**: Verify Mumbai addresses
- **Liquidity**: Use small amounts (0.01, 0.001)
- **Gas**: Should be very cheap on testnet

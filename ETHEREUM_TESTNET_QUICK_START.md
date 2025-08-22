# 🚀 Ethereum Testnet Quick Start Guide

## Overview
Your TPay backend has been updated to work with **Ethereum testnet (Sepolia)** for ERC-20 testing instead of Polygon. TPay now supports **permissionless token listings** - any ERC-20 token can be added dynamically without backend updates.

## ✅ What's Been Updated

1. **Chain Configuration** - Added Sepolia testnet support
2. **Default Settings** - Now defaults to Ethereum testnet
3. **Token Configuration** - Simplified to only 2-3 essential tokens for testing
4. **Permissionless Listings** - Any ERC-20 token can be added dynamically
5. **Documentation** - Updated to reflect Ethereum focus and new features
6. **Test Scripts** - Added Ethereum-specific and token listing testing

## 🚀 Quick Setup

### 1. Get Infura API Key
- Visit [Infura.io](https://infura.io/)
- Create free account
- Create new project
- Copy your **Project ID**

### 2. Create .env File
```bash
cp env.template .env
```

Edit `.env` with your values:
```bash
# Required
RPC_URL=https://sepolia.infura.io/v3/YOUR_PROJECT_ID
PRIVATE_KEY=your_64_character_private_key_here

# Optional (already set for Sepolia)
DEFAULT_CHAIN_ID=11155111
FORCE_CHAIN_ID=11155111
```

### 3. Get Your Private Key
- Open MetaMask
- Go to Account Details → Export Private Key
- Copy the 64-character string (without "0x")

### 4. Get Testnet ETH
- Visit [Sepolia Faucet](https://sepoliafaucet.com/)
- Connect your wallet
- Request testnet ETH

## 🧪 Testing Your Setup

### Test Ethereum Configuration
```bash
npm run test:ethereum
```

### Test All Chain Support
```bash
npm run test:chains
```

### Test Permissionless Token Listings
```bash
npm run test:tokens
```

### Start the Server
```bash
npm start
```

## 🔗 Network Information

| Network | Chain ID | RPC URL | Status |
|---------|----------|----------|---------|
| **Sepolia** | 11155111 | `https://sepolia.infura.io/v3/YOUR_KEY` | 🟢 **Primary** |
| Goerli | 5 | `https://goerli.infura.io/v3/YOUR_KEY` | 🟡 Legacy |
| Mainnet | 1 | `https://mainnet.infura.io/v3/YOUR_KEY` | 🟡 Production |

## 🪙 Essential Test Tokens (Sepolia)

**Only 2-3 tokens configured for testing:**
- **WETH**: `0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9`
- **USDC**: `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238`
- **USDT**: `0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0`

## 🆕 Permissionless Token Listings

TPay supports **permissionless token listings** - any ERC-20 token can be added without backend updates:

### Add New Token
```bash
POST /tokens/add
{
  "address": "0x1234567890123456789012345678901234567890"
}
```

### Remove Token
```bash
DELETE /tokens/remove/0x1234567890123456789012345678901234567890
```

### Check Registry Status
```bash
GET /tokens/registry/status
```

### Available Endpoints
- `GET /tokens/allowed` - List all allowed tokens
- `GET /tokens/essential` - Get essential tokens only
- `GET /tokens/dynamic` - Get dynamically added tokens
- `GET /tokens/validate/:address` - Validate specific token

## 🔍 Troubleshooting

### Common Issues

1. **"Invalid RPC URL"**
   - Make sure you have a valid Infura API key
   - Check that the URL format is correct

2. **"Private key format error"**
   - Ensure your private key is exactly 64 characters
   - Remove any "0x" prefix

3. **"Chain not supported"**
   - Verify your RPC URL points to Sepolia
   - Check that `DEFAULT_CHAIN_ID=11155111`

4. **"Insufficient funds"**
   - Get testnet ETH from the faucet
   - Wait for transaction confirmation

5. **"Token not supported"**
   - Use permissionless listing to add new tokens
   - Check token address format

### Verification Commands

```bash
# Check environment variables
node -e "console.log(process.env.RPC_URL)"

# Test chain configuration
npm run test:ethereum

# Test token listings
npm run test:tokens

# Check server status
curl http://localhost:3001/dex/chain-info

# Check token registry
curl http://localhost:3001/tokens/registry/status
```

## 📚 Additional Resources

- [Sepolia Faucet](https://sepoliafaucet.com/)
- [Infura Documentation](https://docs.infura.io/)
- [Ethereum Testnets](https://ethereum.org/en/developers/docs/networks/)
- [Uniswap V3 on Sepolia](https://docs.uniswap.org/contracts/v3/overview)
- [ERC-20 Token Standard](https://eips.ethereum.org/EIPS/eip-20)

## 🎯 Next Steps

1. ✅ Set up your `.env` file
2. ✅ Get testnet ETH
3. ✅ Test the configuration
4. ✅ Test permissionless token listings
5. ✅ Start the server
6. 🚀 Test your ERC-20 swaps with any token!

---

**Need help?** Check the logs or run the test scripts to diagnose any issues.

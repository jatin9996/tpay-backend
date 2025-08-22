# Chain-Specific Configuration for TPay Backend

## Overview

The TPay backend now supports multiple blockchain networks with automatic chain detection and appropriate Uniswap V3 contract addresses. This eliminates the chain mismatch issue where Ethereum mainnet addresses were hardcoded for Polygon operations.

**Primary Focus**: ERC-20 testing on Ethereum testnet (Sepolia)

## Supported Networks

| Chain ID | Network Name | Quoter Address | Router Address | Position Manager | Status |
|-----------|--------------|----------------|----------------|------------------|---------|
| 11155111 | **Ethereum Sepolia Testnet** | 0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6 | 0xE592427A0AEce92De3Edee1F18E0157C05861564 | 0xC36442b4a4522E871399CD717aBDD847Ab11FE88 | **🟢 Primary** |
| 1 | Ethereum Mainnet | 0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6 | 0xE592427A0AEce92De3Edee1F18E0157C05861564 | 0xC36442b4a4522E871399CD717aBDD847Ab11FE88 | 🟡 Production |
| 5 | Ethereum Goerli Testnet | 0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6 | 0xE592427A0AEce92De3Edee1F18E0157C05861564 | 0xC36442b4a4522E871399CD717aBDD847Ab11FE88 | 🟡 Legacy |
| 137 | Polygon (Matic) | 0x61fFE014bA17989E743c5F6cB21bF9697530B21e | 0xE592427A0AEce92De3Edee1F18E0157C05861564 | 0xC36442b4a4522E871399CD717aBDD847Ab11FE88 | 🟡 Alternative |
| 80001 | Polygon Mumbai Testnet | 0x61fFE014bA17989E743c5F6cB21bF9697530B21e | 0xE592427A0AEce92De3Edee1F18E0157C05861564 | 0xC36442b4a4522E871399CD717aBDD847Ab11FE88 | 🟡 Alternative |
| 42161 | Arbitrum One | 0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6 | 0xE592427A0AEce92De3Edee1F18E0157C05861564 | 0xC36442b4a4522E871399CD717aBDD847Ab11FE88 | 🟡 Alternative |
| 10 | Optimism | 0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6 | 0xE592427A0AEce92De3Edee1F18E0157C05861564 | 0xC36442b4a4522E871399CD717aBDD847Ab11FE88 | 🟡 Alternative |
| 8453 | Base | 0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a | 0x2626664c2603336E57B271c5C0b26F421741e481 | 0x03a520b7C06eF2aC8E3D9518754E9a3b0C10D2B9 | 🟡 Alternative |
| 56 | BSC | 0x78D78E420Da98ad378D7799bE8f4AF69033EB077 | 0x1b81D678ffb9C0263b24A97847620C99d213eB14 | 0x7b8A01B39D58278e5E2e6EC0C0c0b2C8Fc8B5b8 | 🟡 Alternative |

## Configuration Files

### 1. `src/config/chains.js`
Contains all chain-specific Uniswap V3 contract addresses and utility functions.

### 2. `src/config/env.js`
Updated to default to Ethereum testnet (Sepolia) for ERC-20 testing.

## Environment Variables

### Required
- `RPC_URL`: The RPC endpoint for your target blockchain network
- `PRIVATE_KEY`: Your wallet's private key for transaction signing

### Optional
- `DEFAULT_CHAIN_ID`: Default chain ID (defaults to 11155111 - Sepolia)
- `FORCE_CHAIN_ID`: Force a specific chain ID (useful for testing)
- `WETH_ADDRESS`: Wrapped ETH address for the target network
- `WMATIC_ADDRESS`: Wrapped MATIC address (Polygon)
- `USDC_ADDRESS`: USDC token address
- `USDT_ADDRESS`: USDT token address

## Quick Start for Ethereum Testnet

### 1. Get Infura API Key
- Visit [Infura.io](https://infura.io/)
- Create free account and project
- Copy your Project ID

### 2. Set Environment Variables
```bash
# .env file
RPC_URL=https://sepolia.infura.io/v3/YOUR_PROJECT_ID
PRIVATE_KEY=your_64_character_private_key_here
DEFAULT_CHAIN_ID=11155111
FORCE_CHAIN_ID=11155111

# Token addresses (Sepolia)
WETH_ADDRESS=0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9
WMATIC_ADDRESS=0x7D1AfA7B718fb893dB30A3aBc0Cfc608aCfeBBbb
USDC_ADDRESS=0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238
USDT_ADDRESS=0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0
```

### 3. Get Testnet ETH
- Visit [Sepolia Faucet](https://sepoliafaucet.com/)
- Connect your wallet
- Request testnet ETH

## How It Works

1. **Automatic Chain Detection**: The backend automatically detects the chain ID from the RPC provider
2. **Dynamic Address Selection**: Based on the detected chain ID, appropriate Uniswap V3 addresses are selected
3. **Fallback Support**: If a chain is not supported, clear error messages are provided
4. **Environment Override**: You can force a specific chain ID using `FORCE_CHAIN_ID`

## New Endpoints

### GET `/swap/chain-info`
Returns information about the current connected blockchain network:

```json
{
  "success": true,
  "currentChain": {
    "chainId": "11155111",
    "name": "sepolia",
    "isSupported": true
  },
  "supportedChains": ["11155111", "1", "5", "137", "80001", "42161", "10", "8453", "56"],
  "rpcUrl": "https://sepolia.infura.io/v3/***"
}
```

## Migration from Hardcoded Addresses

### Before (Hardcoded)
```javascript
const quoterAddress = "0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6"; // Ethereum mainnet
const uniswapRouter = new ethers.Contract(config.ROUTER_ADDRESS, routerABI.abi, wallet);
```

### After (Chain-Specific)
```javascript
const network = await provider.getNetwork();
const chainId = network.chainId.toString();
const uniswapAddresses = getUniswapAddresses(chainId);
const uniswapRouter = new ethers.Contract(uniswapAddresses.router, routerABI.abi, wallet);
const quoter = new ethers.Contract(uniswapAddresses.quoter, quoterABI.abi, provider);
```

## Error Handling

The system now provides clear error messages for unsupported chains:

```
Error: Unsupported chainId for Uniswap V3: 999. Supported chains: 11155111, 1, 5, 137, 80001, 42161, 10, 8453, 56
```

## Testing Different Networks

To test on different networks, simply change your `RPC_URL`:

```bash
# Ethereum Sepolia Testnet (Primary for ERC-20 testing)
RPC_URL=https://sepolia.infura.io/v3/YOUR_PROJECT_ID

# Ethereum Mainnet
RPC_URL=https://mainnet.infura.io/v3/YOUR_PROJECT_ID

# Polygon
RPC_URL=https://polygon-rpc.com
```

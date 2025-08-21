# Chain-Specific Configuration for TPay Backend

## Overview

The TPay backend now supports multiple blockchain networks with automatic chain detection and appropriate Uniswap V3 contract addresses. This eliminates the chain mismatch issue where Ethereum mainnet addresses were hardcoded for Polygon operations.

## Supported Networks

| Chain ID | Network Name | Quoter Address | Router Address | Position Manager |
|-----------|--------------|----------------|----------------|------------------|
| 1 | Ethereum Mainnet | 0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6 | 0xE592427A0AEce92De3Edee1F18E0157C05861564 | 0xC36442b4a4522E871399CD717aBDD847Ab11FE88 |
| 137 | Polygon (Matic) | 0x61fFE014bA17989E743c5F6cB21bF9697530B21e | 0xE592427A0AEce92De3Edee1F18E0157C05861564 | 0xC36442b4a4522E871399CD717aBDD847Ab11FE88 |
| 42161 | Arbitrum One | 0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6 | 0xE592427A0AEce92De3Edee1F18E0157C05861564 | 0xC36442b4a4522E871399CD717aBDD847Ab11FE88 |
| 10 | Optimism | 0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6 | 0xE592427A0AEce92De3Edee1F18E0157C05861564 | 0xC36442b4a4522E871399CD717aBDD847Ab11FE88 |
| 8453 | Base | 0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a | 0x2626664c2603336E57B271c5C0b26F421741e481 | 0x03a520b7C06eF2aC8E3D9518754E9a3b0C10D2B9 |
| 56 | BSC | 0x78D78E420Da98ad378D7799bE8f4AF69033EB077 | 0x1b81D678ffb9C0263b24A97847620C99d213eB14 | 0x7b8A01B39D58278e5E2e6EC0C0c0b2C8Fc8B5b8 |

## Configuration Files

### 1. `src/config/chains.js`
Contains all chain-specific Uniswap V3 contract addresses and utility functions.

### 2. `src/config/env.js`
Updated to remove hardcoded router addresses and add chain configuration options.

## Environment Variables

### Required
- `RPC_URL`: The RPC endpoint for your target blockchain network
- `PRIVATE_KEY`: Your wallet's private key for transaction signing

### Optional
- `DEFAULT_CHAIN_ID`: Default chain ID (defaults to 137 - Polygon)
- `FORCE_CHAIN_ID`: Force a specific chain ID (useful for testing)
- `WETH_ADDRESS`: Wrapped ETH address for the target network
- `WMATIC_ADDRESS`: Wrapped MATIC address (Polygon)
- `USDC_ADDRESS`: USDC token address
- `USDT_ADDRESS`: USDT token address

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
    "chainId": "137",
    "name": "matic",
    "isSupported": true
  },
  "supportedChains": ["1", "137", "42161", "10", "8453", "56"],
  "rpcUrl": "https://***@polygon-rpc.com"
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
Error: Unsupported chainId for Uniswap V3: 999. Supported chains: 1, 137, 42161, 10, 8453, 56
```

## Testing Different Networks

To test on different networks, simply change your `RPC_URL`:

```bash
# Polygon
RPC_URL=https://polygon-rpc.com

# Ethereum Mainnet
RPC_URL=https://mainnet.infura.io/v3/YOUR_PROJECT_ID

# Arbitrum
RPC_URL=https://arb1.arbitrum.io/rpc
```

## Adding New Networks

To add support for a new network, update `src/config/chains.js`:

```javascript
// Add to UNISWAP_V3_ADDRESSES
'999': {
    quoter: '0x...',
    router: '0x...',
    positionManager: '0x...',
    factory: '0x...'
}
```

## Benefits

1. **No More Chain Mismatches**: Automatic detection prevents using wrong contract addresses
2. **Multi-Chain Support**: Easy to deploy and operate on different networks
3. **Maintainable**: Centralized configuration makes updates easier
4. **Flexible**: Environment variables allow easy network switching
5. **Error-Resistant**: Clear error messages for unsupported networks

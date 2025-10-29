// Curated default token lists per chain for token selector fallback
// Note: These are primarily for mainnet (chainId 1). Testnets should rely on DB seed.

const DEFAULT_TOKENS_BY_CHAIN = {
  '1': [
    { address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', symbol: 'WETH', name: 'Wrapped Ether', decimals: 18 },
    { address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', symbol: 'USDC', name: 'USD Coin', decimals: 6 },
    { address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', symbol: 'USDT', name: 'Tether USD', decimals: 6 },
    { address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', symbol: 'WBTC', name: 'Wrapped Bitcoin', decimals: 8 },
    { address: '0x6B175474E89094C44Da98b954EedeAC495271d0F', symbol: 'DAI', name: 'Dai Stablecoin', decimals: 18 },
    { address: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984', symbol: 'UNI', name: 'Uniswap', decimals: 18 },
    { address: '0x514910771AF9Ca656af840dff83E8264EcF986CA', symbol: 'LINK', name: 'Chainlink', decimals: 18 },
    { address: '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9', symbol: 'AAVE', name: 'Aave', decimals: 18 },
    { address: '0xc944E90C64B2c07662A292be6244BDf05Cda44a7', symbol: 'GRT', name: 'The Graph', decimals: 18 },
    { address: '0x912CE59144191C1204E64559FE8253a0e49E6548', symbol: 'ARB', name: 'Arbitrum', decimals: 18 },
    { address: '0x4200000000000000000000000000000000000042', symbol: 'OP', name: 'Optimism', decimals: 18 },
    { address: '0x9f8F72aA9304c8B593d555F12ef6589cC3A579A2', symbol: 'MKR', name: 'Maker', decimals: 18 },
    // Additional blue chips commonly requested
    { address: '0x7D1Afa7B718fb893dB30A3aBc0Cfc608AaCfeBB0', symbol: 'MATIC', name: 'Polygon', decimals: 18 },
    { address: '0x6de037ef9ad2725eb40118bb1702ebb27e4aeb24', symbol: 'RNDR', name: 'Render', decimals: 18 },
    { address: '0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE', symbol: 'SHIB', name: 'Shiba Inu', decimals: 18 }
  ],
  // Sepolia curated test list to ensure selector shows useful tokens during testing
  // Many test tokens do not have canonical contracts; for those we use clearly-marked
  // MOCK symbols with deterministic placeholder addresses. The frontend strips the
  // MOCK prefix for display and icons.
  '11155111': [
    { address: '0x7b79995e5f793a07bc00c21412e50ecae098e7f9', symbol: 'WETH', name: 'Wrapped Ether', decimals: 18 },
    { address: '0x1c7d4b196cb0c7b01d743fbc6116a902379c7238', symbol: 'USDC', name: 'USD Coin', decimals: 6 },
    { address: '0xaa8e23fb1079ea71e0a56f48a2aa51851d8433d0', symbol: 'USDT', name: 'Tether USD', decimals: 6 },
    // Widely used test tokens (placeholders where no canonical Sepolia contract exists)
    { address: '0x1000000000000000000000000000000000000001', symbol: 'MOCKBNB', name: 'BNB', decimals: 18 },
    { address: '0x1000000000000000000000000000000000000002', symbol: 'MOCKMATIC', name: 'Polygon', decimals: 18 },
    { address: '0x1000000000000000000000000000000000000003', symbol: 'MOCKARB', name: 'Arbitrum', decimals: 18 },
    { address: '0x1000000000000000000000000000000000000004', symbol: 'MOCKOP', name: 'Optimism', decimals: 18 },
    { address: '0x1000000000000000000000000000000000000005', symbol: 'MOCKAVAX', name: 'Avalanche', decimals: 18 },
    { address: '0x1000000000000000000000000000000000000006', symbol: 'MOCKTRX', name: 'Tron', decimals: 18 },
    { address: '0x1000000000000000000000000000000000000007', symbol: 'MOCKSHIB', name: 'Shiba Inu', decimals: 18 },
    { address: '0x1000000000000000000000000000000000000008', symbol: 'MOCKDOGE', name: 'Dogecoin', decimals: 8 },
    { address: '0x1000000000000000000000000000000000000009', symbol: 'MOCKRNDR', name: 'Render', decimals: 18 },
    { address: '0x100000000000000000000000000000000000000a', symbol: 'MOCKATOM', name: 'Cosmos', decimals: 18 },
    { address: '0x100000000000000000000000000000000000000b', symbol: 'MOCKWBTC', name: 'Wrapped Bitcoin', decimals: 8 },
    { address: '0x100000000000000000000000000000000000000c', symbol: 'MOCKUNI', name: 'Uniswap', decimals: 18 },
    { address: '0x100000000000000000000000000000000000000d', symbol: 'MOCKLINK', name: 'Chainlink', decimals: 18 },
    { address: '0x100000000000000000000000000000000000000e', symbol: 'MOCKAAVE', name: 'Aave', decimals: 18 },
    { address: '0x100000000000000000000000000000000000000f', symbol: 'MOCKGRT', name: 'The Graph', decimals: 18 },
    { address: '0x1000000000000000000000000000000000000010', symbol: 'MOCKMKR', name: 'Maker', decimals: 18 },
    { address: '0x1000000000000000000000000000000000000011', symbol: 'DAI', name: 'Dai Stablecoin', decimals: 18 }
  ]
};

export function getDefaultTokens(chainId) {
  const id = chainId?.toString() || '1';
  const list = [...(DEFAULT_TOKENS_BY_CHAIN[id] || [])];
  if (id === '1') {
    // Allow env-driven extras for tokens that vary by bridge/wrapper
    const extraSymbols = ['BNB','AVAX','TRX','DOGE','ATOM'];
    for (const sym of extraSymbols) {
      const key = `ADDR_1_${sym}`;
      const addr = process.env[key];
      if (addr) list.push({ address: addr, symbol: sym, name: sym, decimals: 18 });
    }
  }
  return list;
}



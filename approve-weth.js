import 'dotenv/config';
import { ethers } from 'ethers';

const TOKEN_ADDRESS   = '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619'; // WETH on Polygon
const ROUTER_ADDRESS  = process.env.ROUTER_ADDRESS; // use your .env value
const AMOUNT_WEI      = ethers.parseUnits('0.001', 18); // 0.001 WETH

const ERC20_ABI = [
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function decimals() view returns (uint8)'
];

async function main() {
  try {
    console.log('Environment check:');
    console.log('RPC_URL:', process.env.RPC_URL ? 'Set' : 'NOT SET');
    console.log('PRIVATE_KEY:', process.env.PRIVATE_KEY ? 'Set' : 'NOT SET');
    console.log('ROUTER_ADDRESS:', process.env.ROUTER_ADDRESS ? 'Set' : 'NOT SET');
    
    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
    const wallet   = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

    console.log('\nWallet info:');
    console.log('Approver (msg.sender):', await wallet.getAddress());
    console.log('Router (spender):', ROUTER_ADDRESS);
    console.log('Token address:', TOKEN_ADDRESS);

    // Test provider connection
    console.log('\nTesting provider connection...');
    const blockNumber = await provider.getBlockNumber();
    console.log('Current block number:', blockNumber);

    const token = new ethers.Contract(TOKEN_ADDRESS, ERC20_ABI, wallet);

    // Test basic contract interaction first
    console.log('\nTesting contract interaction...');
    try {
      const decimals = await token.decimals();
      console.log('Token decimals:', decimals);
    } catch (error) {
      console.log('Error getting decimals:', error.message);
    }

    // Try to get allowance with error handling
    console.log('\nChecking allowance...');
    try {
      let allowBefore = await token.allowance(await wallet.getAddress(), ROUTER_ADDRESS);
      console.log('Allowance before:', allowBefore.toString());
    } catch (error) {
      console.log('Error getting allowance:', error.message);
      console.log('This might indicate the token contract is not responding properly');
    }

    // Proceed with approval
    console.log('\nProceeding with approval...');
    const tx = await token.approve(ROUTER_ADDRESS, AMOUNT_WEI);
    console.log('Approve tx:', tx.hash);
    await tx.wait();
    console.log('Approval confirmed!');

    // Check allowance after
    try {
      let allowAfter = await token.allowance(await wallet.getAddress(), ROUTER_ADDRESS);
      console.log('Allowance after:', allowAfter.toString());
    } catch (error) {
      console.log('Error getting final allowance:', error.message);
    }

  } catch (error) {
    console.error('Main error:', error);
    console.error('Error details:', {
      code: error.code,
      message: error.message,
      data: error.data
    });
  }
}

main().catch(console.error);

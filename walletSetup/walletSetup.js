// utils/walletSetup.js
import { JsonRpcProvider } from "ethers";
import dotenv from "dotenv";

dotenv.config();

// ===== BSC Provider =====
export const provider = new JsonRpcProvider(
  process.env.BSC_RPC_URL || "https://bsc-dataseed.binance.org/",
);

// ===== USDT (BEP-20) =====
// BSC mainnet USDT — 18 decimals (NOTE: ye 6 nahi hai, BSC pe 18 hi hota hai)
export const usdtAddress =
  process.env.USDT_CONTRACT_ADDRESS ||
  "0x55d398326f99059fF775485246999027B3197955";

// Minimal ERC20/BEP20 ABI — withdrawal ke liye itna kaafi
export const usdtAbi = [
  "function transfer(address to, uint256 amount) public returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function allowance(address owner, address spender) view returns (uint256)",
];

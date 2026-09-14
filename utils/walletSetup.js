import { JsonRpcProvider, Wallet, Contract } from "ethers";
import dotenv from "dotenv";
dotenv.config();

const provider = new JsonRpcProvider("https://bsc-dataseed.binance.org/");

const wallet = new Wallet(process.env.PRIVATE_KEY, provider);

const usdtAddress = "0x55d398326f99059fF775485246999027B3197955";
const usdtABI = [
    "function transfer(address to, uint256 amount) public returns (bool)",
    "function balanceOf(address) view returns (uint256)",
];

const usdtContract = new Contract(usdtAddress, usdtABI, wallet);

export { wallet, usdtContract };

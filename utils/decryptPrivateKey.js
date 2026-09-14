import fs from "fs";
import { Wallet } from "ethers";

const keyfile = fs.readFileSync(
  "/root/new-blockchain/validators/validator1/keystore/UTC--2026-01-19T11-55-58.986723005Z--864e63ef2be2278ae142164a0eec6429abc7aba1",
  "utf8",
);

const password = "abcd";

const wallet = Wallet.fromV3(keyfile, password);
console.log(wallet.getPrivateKeyString());

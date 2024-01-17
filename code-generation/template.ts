import { transfer } from "../src/transfer";
import { FireblocksSDK } from "fireblocks-sdk";

const fs = require("fs");
const path = require("path");

const apiSecret = fs.readFileSync(
  path.resolve("../FB_KEY/fireblocks_secret.key"),
  "utf8"
);
const apiKey = "TODO";
const fireblocks = new FireblocksSDK(apiSecret, apiKey);

// chain: {chain}
const httpProviderURL = "{rpcurl}";
const destinationAddress = "{address}";
const vaultAccountID = "{vault}";
const contractAddress = "{contract}";
const amount = { amount }; //Decimal Number
const tokenName = "{token}";

const assetType = "ETH";
!transfer(
  fireblocks,
  httpProviderURL,
  vaultAccountID,
  destinationAddress,
  assetType,
  tokenName,
  amount,
  contractAddress,
  { rownum }
);

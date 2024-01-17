// Use the code generation script to make these from rows.csv:

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

// chain: Any
const httpProviderURL = "";
const destinationAddress = "TODO";
const vaultAccountID = "TODO";
const contractAddress = "";
const amount = TODO; //Decimal Number
const tokenName = "OPTIONAL";

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
  TODOOPTIONAL
);

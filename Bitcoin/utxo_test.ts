import { transfer } from "../src/transfer";
import { FireblocksSDK } from "fireblocks-sdk";
import { getAvailableUTXOs, signBtcTransaction } from "./bitcoin_raw_signer";

const fs = require("fs");
const path = require("path");

const apiSecret = fs.readFileSync(
  path.resolve("../../FB_KEY/fireblocks_secret.key"),
  "utf8"
);
const apiKey = "";
const fireblocksApi = new FireblocksSDK(apiSecret, apiKey);

// chain: BTC
const destinationAddress = "";
const vaultAccountID = "6";
const amount = 0.25; //Decimal Number

const utxos = getAvailableUTXOs(fireblocksApi, "vaultAccountId", "BTC");
console.log(utxos);

// Assume we have fireblocksApi instance, and we have already retrieved selectedUTXOs
// signBtcTransaction(
//   fireblocksApi,
//   "vaultAccountId",
//   "BTC",
//   "destinationAddress",
//   "0.05",
//   "referenceFile",
//   selectedUTXOs
// );

console.log(msg);

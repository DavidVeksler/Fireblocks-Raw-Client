import { FireblocksSDK } from "fireblocks-sdk";
import {
  fetchTransactionDetails,
  getAvailableUTXOs,
  signBtcTransaction,
} from "./bitcoin_raw_signer";

const fs = require("fs");
const path = require("path");

const apiSecret = fs.readFileSync(
  path.resolve("../../FB_KEY/fireblocks_secret.key"),
  "utf8"
);
const apiKey = "";
const fireblocksApi = new FireblocksSDK(apiSecret, apiKey);

// chain: BTC

// Find out what we can spend
const utxos = getAvailableUTXOs(fireblocksApi, "8", "BTC");
console.log(utxos);
const util = require("util");
console.log(util.inspect(utxos, { showHidden: false, depth: null }));


const selectedUTXOs = [
  {
    txHash: "",
    index: 0,
  },
];

const destinations = [
  { vaultid: "8", amount: "0.0025" },
];

// Send BTC to one or more destinations
const vaultAccountID = "86465";

var msg = signBtcTransaction(
  fireblocksApi,
  vaultAccountID,
  "BTC",
  destinations,
  "rare sat transfer #809809",
  selectedUTXOs
);

 console.log(msg);


//  Check TX Status
// const transactionId = '';

// fetchTransactionDetails(fireblocksApi, transactionId)
//     .then(details => console.log('Transaction Details:', details))
//     .catch(error => console.error(error));

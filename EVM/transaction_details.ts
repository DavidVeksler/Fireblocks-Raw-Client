import Transaction from "@ethereumjs/tx/dist/legacyTransaction";
import { FireblocksSDK } from "fireblocks-sdk";
import Web3 from "web3";
import Common from "@ethereumjs/common";

const { apiSecret, apiKey } = require("./config");
const fireblocksApi = new FireblocksSDK(apiSecret, apiKey);

// Fetches transaction details from the Fireblocks API.
export async function fetchTransactionDetails(txId) {
  try {
    const transactionDetails = await fireblocksApi.getTransactionById(txId);
    console.log(`Fetched transaction details for ID ${txId}:`);
    return transactionDetails;
  } catch (error) {
    console.error(`Error fetching transaction details for ID ${txId}:`, error);
    throw error;
  }
}

// Process command line arguments
const args = process.argv.slice(2); // Removes 'node' and the script name
if (args.length !== 1) {
  console.error("Usage: node script.js <txId>");
  process.exit(1);
}

const txId = args[0];
fetchTransactionDetails(txId)
  .then((transactionDetails) => {
    console.log('status',transactionDetails.status)
    console.log('subStatus', transactionDetails.subStatus)
    console.log('amount', transactionDetails.amount)
    console.log('note', transactionDetails.note)
    // console.log('signature',transactionDetails.signedMessages[0].signature)
    console.log(transactionDetails)    
  })
  .catch((error) => console.error(error));

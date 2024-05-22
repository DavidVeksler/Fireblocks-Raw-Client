import { FireblocksSDK } from "fireblocks-sdk";

const { apiSecret, apiKey } = require('./config'); 
const fireblocksApi = new FireblocksSDK(apiSecret, apiKey);

async function cancelTransaction(txId) {
    try {
        const transactionDetails = await fireblocksApi.cancelTransactionById(txId);
        console.log(`Cancelled ID ${txId}:`, transactionDetails);
        return transactionDetails;
    } catch (error) {
        console.error(`Error cancelling ID ${txId}:`, error);
        throw error;
    }
}

// Process command line arguments
const args = process.argv.slice(2); // Removes 'node' and the script name
if (args.length !== 1) {
    console.error('Usage: node script.js <txId>');
    process.exit(1);
}

const txId = args[0];
cancelTransaction(txId)
    .then(transactionDetails => console.log(transactionDetails))
    .catch(error => console.error(error));

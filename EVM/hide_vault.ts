import { FireblocksSDK } from "fireblocks-sdk";

const { apiSecret, apiKey } = require('./config'); 
const fireblocksApi = new FireblocksSDK(apiSecret, apiKey);


// Define the operations
async function hideVaultAccount(vaultAccountId) {
  try {
    const response = await fireblocksApi.hideVaultAccount(vaultAccountId);
    console.log(`Vault account ${vaultAccountId} hidden:`, response);
    return response;
  } catch (error) {
    console.error(`Error hiding vault account ${vaultAccountId}:`, error);
    throw error;
  }
}

async function unhideVaultAccount(vaultAccountId) {
  try {
    const response = await fireblocksApi.unhideVaultAccount(vaultAccountId);
    console.log(`Vault account ${vaultAccountId} unhidden:`, response);
    return response;
  } catch (error) {
    console.error(`Error unhiding vault account ${vaultAccountId}:`, error);
    throw error;
  }
}

// Process command line arguments for operation and vault account ID
const args = process.argv.slice(2);
if (args.length !== 2 || (args[0] !== "hide" && args[0] !== "unhide")) {
  console.error('Usage: node script.js <hide|unhide> <vaultAccountId>');
  process.exit(1);
}

const operation = args[0];
const vaultAccountId = args[1];

// Perform the requested operation
(operation === "hide" ? hideVaultAccount : unhideVaultAccount)(vaultAccountId)
  .then(response => console.log(response))
  .catch(error => console.error(error));

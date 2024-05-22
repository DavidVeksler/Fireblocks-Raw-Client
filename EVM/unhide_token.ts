import { FireblocksSDK } from "fireblocks-sdk";

const { apiSecret, apiKey } = require('./config');

const fireblocksApi = new FireblocksSDK(apiSecret, apiKey);

async function addContractToVault(vaultAccountId: string, assetId: string) {
  try {
    const response = await fireblocksApi.activateVaultAsset(vaultAccountId, assetId);
    console.log(`Contract ${assetId} added to vault account ${vaultAccountId}:`, response);
    return response;
  } catch (error) {
    console.error(`Error adding contract ${assetId} to vault account ${vaultAccountId}:`, error);
    throw error;
  }
}

// Process command line arguments for operation and vault account ID
const args = process.argv.slice(2);

if (args.length !== 2) {
  console.error('Usage: ts-node unhide_token.ts <vaultAccountId> <assetId>');
  process.exit(1);
}

const vaultAccountId = args[0];
const assetId = args[1];

// Perform the requested operation
addContractToVault(vaultAccountId, assetId)
  .then(() => {
    console.log('Contract added to vault account successfully.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error adding contract to vault account:', error);
    process.exit(1);
  });
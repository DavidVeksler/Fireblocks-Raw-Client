const { apiSecret, apiKey } = require('./config');
import { FireblocksSDK, TransactionStatus } from "fireblocks-sdk";
const { performInternalTransfer } = require("../src/transfer");

const { colorLog } = require("../src/web3_instance");
const fs = require('fs');
const csv = require('csv-parser');
const Web3 = require('web3');

const fireblocksApiClient = new FireblocksSDK(apiSecret, apiKey);
const httpProviderURL = 'https://bsc-dataseed1.bnbchain.org';
const web3 = new Web3(httpProviderURL);
const vaultAccountID = 10;
const amount = 0.001;
const maxPollingAttempts = 10;

// Mapping from NativeToken to assetId
const assetIdMapping: { [key: string]: string } = {
    'Polygon': 'MATIC_POLYGON',
    'BSC': 'BNB_BSC',
    'Avalanche': 'AVAX',
    'Cronos': 'CRO',
    'ETH': 'ETH',
    'Ethereum': 'ETH',
  };

async function main() {
  const vaults: { [key: string]: { vault: string, assetId: string; address: string } } = {};

  // Read the CSV file and store the vault information
fs.createReadStream('vaults_needing_gas.csv')
    .pipe(csv())
    .on('data', (data: any) => {
            console.log('Processing row:', data);
            const nativeToken = data.NativeToken;
            const assetId = assetIdMapping[nativeToken];
            if (assetId) {
                vaults[data.Vault] = {
                    vault: data.Vault,
                    assetId: assetId,
                    address: data.Address
                };
            } else {
                console.warn(`Unsupported NativeToken: ${nativeToken}`);
            }
        })
    .on('end', async () => {
      for (const vault in vaults) {
        const { assetId, address } = vaults[vault];
        console.log(`Transferring ${amount} ${assetId} to vault ${vault} (${address})`);
        const result = await performInternalTransfer(web3, fireblocksApiClient, assetId, amount, vaultAccountID, vault );
        console.log('Transfer result:', result);
        const txid = result.id;
        await pollTransactionStatus(txid);
      }
    });
}

const pollTransactionStatus = async (txid: string) => {
  let currentStatus;
  let pollingAttempts = 0;

  while (
    currentStatus !== TransactionStatus.COMPLETED &&
    currentStatus !== TransactionStatus.FAILED &&
    currentStatus !== TransactionStatus.BLOCKED &&
    currentStatus !== TransactionStatus.CANCELLED &&
    pollingAttempts < maxPollingAttempts
  ) {
    try {
      console.log(colorLog(`Polling for tx ${txid}; status: ${currentStatus}`, "35"));
      const txInfo = await fireblocksApiClient.getTransactionById(txid);
      currentStatus = txInfo.status;
      if (
        currentStatus === TransactionStatus.COMPLETED ||
        currentStatus === TransactionStatus.FAILED ||
        currentStatus === TransactionStatus.BLOCKED ||
        currentStatus === TransactionStatus.CANCELLED
      ) {
        console.log(colorLog(`Transaction ${txid} finished with status: ${currentStatus}`, "32"));
        break;
      }
    } catch (err) {
      console.error(colorLog("Error while polling transaction:", "31"));
      console.error(err);
    }
    pollingAttempts++;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  if (pollingAttempts === maxPollingAttempts) {
    console.log(colorLog(`Reached maximum polling attempts for transaction ${txid}`, "31"));
  }
};

main().catch((error) => {
  console.error('Error occurred:', error);
});
const { apiSecret, apiKey } = require('./config');
import { FireblocksSDK, TransactionStatus } from "fireblocks-sdk";
const { transfer } = require("./src/transfer");
const { colorLog } = require("./src/web3_instance");

const fireblocksApiClient = new FireblocksSDK(apiSecret, apiKey);
const httpProviderURL = 'https://rpc.flashbots.net';
const tokenName = 'ETH';
const assetIdentifier = 'ETH';

async function main() {
  const vaultAccountID = 10;
  const destinationVault = process.argv[2];
  const revert = process.argv[3] === 'revert';
  const amount = .001;

  let result;
  if (revert) {
    result = await transfer(fireblocksApiClient, httpProviderURL, destinationVault, null, assetIdentifier, tokenName, amount, '', 0, null, vaultAccountID);
  } else {
    result = await transfer(fireblocksApiClient, httpProviderURL, vaultAccountID, null, assetIdentifier, tokenName, amount, '', 0, null, destinationVault);
  }

  console.log(result);
  const txid = result.id;

  const pollTransactionStatus = async (txid: string) => {
    let currentStatus;
    while (
      currentStatus !== TransactionStatus.COMPLETED &&
      currentStatus !== TransactionStatus.FAILED &&
      currentStatus !== TransactionStatus.BLOCKED &&
      currentStatus !== TransactionStatus.CANCELLED
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
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  };

  if (txid) {
    await pollTransactionStatus(txid);
  } else {
    console.log(colorLog("No transaction ID found.", "31"));
  }
}

main().catch((error) => {
  console.error('Error occurred:', error);
});
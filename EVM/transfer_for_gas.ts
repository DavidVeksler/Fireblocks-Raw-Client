const { apiSecret, apiKey } = require('./config');
import { FireblocksSDK, TransactionStatus } from "fireblocks-sdk";
const { transfer } = require("./src/transfer");
const { colorLog } = require("./src/web3_instance");

const fireblocksApiClient = new FireblocksSDK(apiSecret, apiKey);
const httpProviderURL = 'https://rpc.flashbots.net';
const vaultAccountID = 123;
const contractAddress = '';
const destinationVault = 456;
//https://eth-converter.com/
const amount = 0; //Decimal Number
const tokenName = 'ETH';
const assetType = 'ETH';

async function main() {
  //Do Not Touch!
  var result = await transfer(fireblocksApiClient, httpProviderURL, vaultAccountID, null, assetType, tokenName, amount, contractAddress, 0, null, destinationVault);
  console.log(result);
  var txid = result.id;

  const pollTransactionStatus = async (txid: string) => {
    var currentStatus;
    while (
      currentStatus !== TransactionStatus.COMPLETED &&
      currentStatus !== TransactionStatus.FAILED &&
      currentStatus !== TransactionStatus.BLOCKED &&
      currentStatus !== TransactionStatus.CANCELLED
    ) {
      try {
        console.log(
          colorLog(
            `Polling for tx ${txid}; status: ${currentStatus}`,
            "35"
          )
        ); // Magenta text

        const txInfo = await fireblocksApiClient.getTransactionById(txid);
        currentStatus = txInfo.status;

        if (
          currentStatus === TransactionStatus.COMPLETED ||
          currentStatus === TransactionStatus.FAILED ||
          currentStatus === TransactionStatus.BLOCKED ||
          currentStatus === TransactionStatus.CANCELLED
        ) {
          console.log(
            colorLog(
              `Transaction ${txid} finished with status: ${currentStatus}`,
              "32"
            )
          ); // Green text for completed status
          break;
        }
      } catch (err) {
        console.error(colorLog("Error while polling transaction:", "31")); // Red text for errors
        console.error(err);
      }
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait for 1 second before the next poll
    }
  };

  if (txid) {
    await pollTransactionStatus(txid);
  } else {
    console.log(colorLog("No transaction ID found.", "31")); // Red text for error
  }
}

main().catch((error) => {
  console.error('Error occurred:', error);
});
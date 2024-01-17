// Function to sign a raw BTC transaction and output the signed transaction for broadcasting
import {
  FireblocksSDK,
  PeerType,
  TransactionOperation,
  TransactionStatus,
} from "fireblocks-sdk";

export async function signBtcTransaction(
  fireblocksApi: FireblocksSDK,
  vaultAccountId,
  assetId,
  destinationAddress,
  transactionAmount,
  referenceFilename = ""
) {
  console.log("Preparing to sign a Bitcoin transaction...");
  console.log(`Vault Account ID: ${vaultAccountId}`);
  console.log(`Destination Address: ${destinationAddress}`);
  console.log(`Amount: ${transactionAmount}`);

  // Log for debugging: Get details of the vault account
  // const vaultAccountDetails = await fireblocksApi.getVaultAccountById(vaultAccountId);
  // console.log(vaultAccountDetails);

  // Transaction note for clarity
  const transactionNote = `Send ${transactionAmount} of ${assetId} from vault ${vaultAccountId} to ${destinationAddress} (Ref: #${referenceFilename})`;
  console.log(transactionNote);

  // Construct the transaction request object
  const txRequest = {
    operation: TransactionOperation.TRANSFER,
    assetId: assetId,
    source: {
      type: PeerType.VAULT_ACCOUNT,
      id: vaultAccountId,
    },
    destination: {
      type: PeerType.ONE_TIME_ADDRESS,
      oneTimeAddress: {
        address: String(destinationAddress),
      },
    },
    amount: transactionAmount.toString(),
    note: transactionNote,
  };

  let transactionInfo;

  // Initiate the transaction creation
  console.log("Creating transaction...");
  const createTxResponse = await fireblocksApi.createTransaction(txRequest);
  console.log(`Transaction ID: ${createTxResponse.id}`);

  // Polling for transaction status
  let txStatus = createTxResponse.status;
  console.log("Polling for transaction status...");

  while (
    txStatus !== TransactionStatus.COMPLETED &&
    txStatus !== TransactionStatus.FAILED &&
    txStatus !== TransactionStatus.BLOCKED
  ) {
    try {
      console.log(
        `Polling Transaction ID ${createTxResponse.id}; Status: ${txStatus}`
      );
      transactionInfo = await fireblocksApi.getTransactionById(
        createTxResponse.id
      );
      txStatus = transactionInfo.status;

      if (
        txStatus === TransactionStatus.FAILED ||
        txStatus === TransactionStatus.BLOCKED
      ) {
        console.error(`Transaction failed/blocked: ID ${createTxResponse.id}`);
        return;
      } else if (txStatus === TransactionStatus.COMPLETED) {
        console.log("Transaction completed successfully.");
        console.log(
          "Signed Transaction Data:",
          JSON.stringify(transactionInfo, null, 2)
        );
      }
    } catch (error) {
      console.error(
        `Error polling Transaction ID ${createTxResponse.id}: ${error}`
      );
    }
    // Wait for 1 second before next poll
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  console.log(`Transaction successfully completed: ID ${createTxResponse.id}`);
}

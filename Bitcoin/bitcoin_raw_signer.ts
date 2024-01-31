// Function to sign a raw BTC transaction and output the signed transaction for broadcasting

import {
  FireblocksSDK,
  PeerType,
  TransactionOperation,
  TransactionStatus,
} from "fireblocks-sdk";

// Retrieves UTXOs for the specified vault account and asset.
export async function getAvailableUTXOs(
  fireblocksApi: FireblocksSDK,
  vaultAccountId: string,
  assetId: string
): Promise<any[]> {
  console.log(`Retrieving UTXOs: Vault Account ID = ${vaultAccountId}, Asset ID = ${assetId}`);

  try {
    const utxos = await fireblocksApi.getUnspentInputs(vaultAccountId, assetId);
    console.log(`Retrieved ${utxos.length} UTXOs:`, utxos);
    return utxos;
  } catch (error) {
    console.error('Error retrieving UTXOs:', error);
    throw error;
  }
}

// Signs a BTC transaction to multiple destinations.
export async function signBtcTransaction(
  fireblocksApi: FireblocksSDK,
  vaultAccountId: string,
  assetId: string,
  destinations: { vaultid: string; amount: string }[],
  referenceFilename: string = "",
  selectedUTXOs: { txHash: string; index: number }[] = []
) {
  console.log('Signing BTC transaction...');

  // Prepare extra parameters for the transaction
  const extraParameters = selectedUTXOs.length > 0 ? { inputsSelection: { inputsToSpend: selectedUTXOs } } : {};

  // Prepare transaction details for each destination
  const transactionNote = `Sending BTC from vault ${vaultAccountId} to multiple destinations (Ref: ${referenceFilename})`;
  console.log(transactionNote);
  const destinationsArray = destinations.map(dest => ({
    destination: {
      type: PeerType.VAULT_ACCOUNT,
      id: dest.vaultid,
    },
    // For external addresses:
    // type: PeerType.ONE_TIME_ADDRESS,
      // oneTimeAddress: {
      //   address: dest.address,
      // },
    amount: dest.amount
  }));

  // Create and send transaction request
  const txRequest = {
    operation: TransactionOperation.TRANSFER,
    assetId: assetId,
    source: { type: PeerType.VAULT_ACCOUNT, id: vaultAccountId },    
    destinations: destinationsArray,
    note: transactionNote,
    extraParameters: extraParameters
  };
  
  console.log('Creating transaction...');
  const createTxResponse = await fireblocksApi.createTransaction(txRequest);
  console.log(`Transaction created: ID = ${createTxResponse.id}`);

  // Poll transaction status until completion
  let txStatus = createTxResponse.status;
  console.log('Polling for transaction status...');
  while (txStatus !== TransactionStatus.COMPLETED && txStatus !== TransactionStatus.FAILED && txStatus !== TransactionStatus.BLOCKED) {
    try {
      const transactionInfo = await fireblocksApi.getTransactionById(createTxResponse.id);
      txStatus = transactionInfo.status;
      console.log(`Transaction ID ${createTxResponse.id} Status: ${txStatus}`);

      if (txStatus === TransactionStatus.FAILED || txStatus === TransactionStatus.BLOCKED) {
        console.error(`Transaction failed or blocked: ID ${createTxResponse.id}`);
        return;
      } else if (txStatus === TransactionStatus.COMPLETED) {
        console.log('Transaction completed successfully:', transactionInfo);
      }
    } catch (error) {
      console.error(`Error polling transaction ID ${createTxResponse.id}:`, error);
    }

    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log(`Transaction completed: ID ${createTxResponse.id}`);
}

// Fetches transaction details from the Fireblocks API.
export async function fetchTransactionDetails(fireblocksApi: FireblocksSDK, txId) {
  try {
    const transactionDetails = await fireblocksApi.getTransactionById(txId);
    console.log(`Fetched transaction details for ID ${txId}:`, transactionDetails);
    return transactionDetails;
  } catch (error) {
    console.error(`Error fetching transaction details for ID ${txId}:`, error);
    throw error;
  }
}

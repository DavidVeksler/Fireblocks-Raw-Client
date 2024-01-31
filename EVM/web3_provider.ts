import { Transaction } from "@ethereumjs/tx";
import Common from "@ethereumjs/common";
import {
  PeerType,
  TransactionStatus,
  TransactionOperation,
  FireblocksSDK,
} from "fireblocks-sdk";
const Web3 = require("web3");

// Utility function for colored console logs
export function colorLog(message, colorCode) {
  return `\x1b[${colorCode}m${message}\x1b[0m`;
}

export async function initWeb3Provider(
  fireblocksApiClient,
  httpProviderUrl,
  vaultAccountId,
  assetId = "FTM",
  tokenName = "ETH",
  amount,
  destAddress,
  filename
) {
  const webProvider = new Web3.providers.HttpProvider(httpProviderUrl);
  let web3;

  // RPC proxy for signing transactions
  const rpcProxy = {
    eth_signTransaction: async ([txData]) => {
      const chainId = await web3.eth.getChainId();
      const customChainParams = { name: "custom", chainId, networkId: chainId };
      const common = Common.forCustomChain(
        "mainnet",
        customChainParams,
        "byzantium"
      );

      const nonce = await web3.eth.getTransactionCount(web3.eth.defaultAccount);
      const tx = new Transaction({ ...txData, nonce }, { common });
      const content = tx.getMessageToSign().toString("hex");

      const note = `Send ${
        amount === 0 ? "full balance" : amount
      } ${tokenName} over ${assetId} from vault ${vaultAccountId} to ${destAddress} (#${filename})`;
      console.log(colorLog(note, "33")); // Yellow text

      try {
        // Creating the transaction
        const { status, id } = await fireblocksApiClient.createTransaction({
          operation: TransactionOperation.RAW,
          assetId,
          source: {
            type: PeerType.VAULT_ACCOUNT,
            id: String(vaultAccountId),
          },
          note,
          extraParameters: {
            rawMessageData: {
              messages: [{ content }],
            },
          },
        });

        // Polling for transaction status
        let currentStatus = status;
        let txInfo;

        // Uncomment for hardcoded txid        
        // txInfo = await fireblocksApiClient.getTransactionById(
        //   "[ADDRESS]"
        // );
        // currentStatus = TransactionStatus.COMPLETED;

        while (
          currentStatus !== TransactionStatus.COMPLETED &&
          currentStatus !== TransactionStatus.FAILED &&
          currentStatus != TransactionStatus.CANCELLED
        ) {
          try {
            console.log(colorLog(`Polling for tx ${id}; status: ${currentStatus}, note: ${note}`, "35")); // Magenta text
            txInfo = await fireblocksApiClient.getTransactionById(id);
            currentStatus = txInfo.status;
          } catch (err) {
            console.error(colorLog("Error while polling transaction:", "31")); // Red text for errors
          }
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }

        if (currentStatus === TransactionStatus.FAILED) {
          throw new Error("Transaction FAILED");
        }
        if (currentStatus === TransactionStatus.CANCELLED) {
          throw new Error("Transaction CANCELLED");
        }

        // Handling transaction information
        // fetch existing transaction
        if (!txInfo) {
          txInfo = await fireblocksApiClient.getTransactionById(id);
        }
        if (!txInfo.signedMessages) {
          throw new Error("txInfo.signedMessages is undefined");
        }

        // Preparing signed transaction
        const signature = txInfo.signedMessages[0].signature;
        const signedTransaction = new Transaction(
          {
            nonce: tx.nonce,
            gasPrice: tx.gasPrice,
            gasLimit: tx.gasLimit,
            to: tx.to,
            value: tx.value,
            data: tx.data,
            s: web3.utils.toBN("0x" + signature.s),
            r: web3.utils.toBN("0x" + signature.r),
            v: chainId * 2 + (signature.v + 35),
          },
          { common }
        );

        return `0x${signedTransaction.serialize().toString("hex")}`;
      } catch (error) {
        console.error("\x1b[31mTransaction error:", error, "\x1b[0m");
      }
    },
  };

  // Custom provider with RPC proxy integration
  const provider = {
    send: (input, callback) => {
      const method = rpcProxy[input.method];
      if (method) {
        method(input.params)
          .then((result) =>
            callback(null, {
              id: input.id,
              jsonrpc: "2.0",
              result,
            })
          )
          .catch((err) => callback(err));
      } else {
        webProvider.send(input, callback);
      }
    },
  };

  web3 = new Web3(provider);

  // Retrieving account addresses
  const accountAddresses = await fireblocksApiClient.getDepositAddresses(
    vaultAccountId,
    assetId
  );
  if (accountAddresses.length === 0) {
    throw new Error(
      `No account addresses found in vault ${vaultAccountId} for asset ${assetId}. Double-check the vault ID.`
    );
  }

  // Setting up default account
  web3.eth.defaultAccount = accountAddresses[0].address;
  console.log(colorLog(`Source address: ${web3.eth.defaultAccount}`, "32"));
  const balanceInWei = await web3.eth.getBalance(web3.eth.defaultAccount);
  const balanceInEther = web3.utils.fromWei(balanceInWei, "ether");
  console.log(colorLog(`Balance in Ether: ${balanceInEther}`, "36")); // Cyan text

  return web3;
}

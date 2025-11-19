/**
 * Web3 instance management with Fireblocks integration (Refactored)
 *
 * Provides Web3 initialization with a custom RPC proxy that routes
 * transaction signing through Fireblocks SDK instead of local keys.
 *
 * Key improvements:
 * - Strong typing throughout
 * - Separated concerns into focused functions
 * - Eliminated code duplication
 * - Better error handling
 * - Removed magic numbers
 * - Clear abstractions
 */

import { Transaction } from "@ethereumjs/tx";
import Common from "@ethereumjs/common";
import {
  PeerType,
  TransactionOperation,
  FireblocksSDK,
  TransactionStatus,
} from "fireblocks-sdk";
import { Web3InitParams } from "../shared/types";
import { Logger } from "../shared/logger";
import { GAS } from "../shared/constants";
import {
  NoAddressesError,
  TransactionError,
  ValidationError,
} from "../shared/errors";
import { pollTransactionUntilSuccess } from "../shared/transaction-poller";
import {
  validateVaultId,
  validateAssetId,
  validateRpcUrl,
  validateRequired,
} from "../shared/validators";

const Web3 = require("web3");

/**
 * Transaction data from Web3
 */
interface Web3TransactionData {
  to?: string;
  data?: string;
  value?: string;
  gasPrice?: string;
  gasLimit?: number;
  nonce?: number;
}

/**
 * Creates a Fireblocks RAW transaction for signing
 *
 * @param fireblocksClient - Fireblocks SDK client
 * @param params - Web3 initialization parameters
 * @param content - Transaction content hash
 * @param existingTransactionId - Optional existing transaction to resume
 * @returns Transaction ID and status
 */
async function createRawTransaction(
  fireblocksClient: FireblocksSDK,
  params: Web3InitParams,
  content: string,
  existingTransactionId?: string
): Promise<{ id: string; status: TransactionStatus }> {
  const note = buildTransactionNote(params);

  Logger.info(note);
  Logger.setWindowTitle(note);

  // Resume existing transaction if provided
  if (existingTransactionId) {
    Logger.info(`Resuming transaction ${existingTransactionId}`);
    const txInfo = await fireblocksClient.getTransactionById(existingTransactionId);
    return { id: txInfo.id, status: txInfo.status };
  }

  // Create new transaction
  const result = await fireblocksClient.createTransaction({
    operation: TransactionOperation.RAW,
    assetId: params.assetId,
    source: {
      type: PeerType.VAULT_ACCOUNT,
      id: String(params.vaultAccountId),
    },
    note,
    extraParameters: {
      rawMessageData: {
        messages: [{ content }],
      },
    },
  });

  Logger.transaction(result.id, result.status, "Transaction created");

  return { id: result.id, status: result.status };
}

/**
 * Builds a human-readable transaction note
 *
 * @param params - Web3 initialization parameters
 * @returns Transaction note string
 */
function buildTransactionNote(params: Web3InitParams): string {
  const amountStr = params.amount === 0 ? "full balance" : String(params.amount);
  const tokenName = params.tokenName || "ETH";
  const filename = params.filename || "transaction";

  return (
    `Send ${amountStr} ${tokenName} over ${params.assetId} ` +
    `from vault ${params.vaultAccountId} to ${params.destAddress} (#${filename})`
  );
}

/**
 * Creates a signed transaction from Fireblocks signature
 *
 * @param originalTx - Original unsigned transaction
 * @param signature - Fireblocks signature
 * @param chainId - Chain ID
 * @param common - EthereumJS Common instance
 * @returns Serialized signed transaction
 */
function createSignedTransaction(
  originalTx: Transaction,
  signature: any,
  chainId: number,
  common: Common
): string {
  const Web3 = require("web3");
  const web3 = new Web3();

  const signedTransaction = new Transaction(
    {
      nonce: originalTx.nonce,
      gasPrice: originalTx.gasPrice,
      gasLimit: originalTx.gasLimit,
      to: originalTx.to,
      value: originalTx.value,
      data: originalTx.data,
      s: web3.utils.toBN("0x" + signature.s),
      r: web3.utils.toBN("0x" + signature.r),
      v: chainId * 2 + (signature.v + 35),
    },
    { common }
  );

  return `0x${signedTransaction.serialize().toString("hex")}`;
}

/**
 * Handles the transaction signing flow through Fireblocks
 *
 * @param fireblocksClient - Fireblocks SDK client
 * @param params - Web3 initialization parameters
 * @param txData - Transaction data
 * @param web3 - Web3 instance
 * @returns Serialized signed transaction
 */
async function signTransactionViaFireblocks(
  fireblocksClient: FireblocksSDK,
  params: Web3InitParams,
  txData: Web3TransactionData,
  web3: any
): Promise<string> {
  // Get chain ID and create common instance
  const chainId = await web3.eth.getChainId();
  const customChainParams = { name: "custom", chainId, networkId: chainId };
  const common = Common.forCustomChain("mainnet", customChainParams, "byzantium");

  // Get nonce
  const nonce = await web3.eth.getTransactionCount(web3.eth.defaultAccount);

  // Create transaction and get message to sign
  const tx = new Transaction({ ...txData, nonce }, { common });
  const content = tx.getMessageToSign().toString("hex");

  // Create or resume Fireblocks transaction
  const { id: txId, status } = await createRawTransaction(
    fireblocksClient,
    params,
    content,
    params.existingTransactionId
  );

  // Poll until transaction is signed
  const txInfo = await pollTransactionUntilSuccess(fireblocksClient, txId);

  // Validate signature exists
  if (!txInfo.signedMessages || txInfo.signedMessages.length === 0) {
    throw new TransactionError(
      "Transaction completed but no signed messages found",
      txId,
      TransactionStatus.COMPLETED
    );
  }

  // Create and return signed transaction
  const signature = txInfo.signedMessages[0].signature;
  return createSignedTransaction(tx, signature, chainId, common);
}

/**
 * Creates a custom Web3 provider with Fireblocks RPC proxy
 *
 * @param fireblocksClient - Fireblocks SDK client
 * @param params - Web3 initialization parameters
 * @param httpProvider - Base HTTP provider
 * @param web3 - Web3 instance
 * @returns Custom provider with RPC proxy
 */
function createFireblocksProvider(
  fireblocksClient: FireblocksSDK,
  params: Web3InitParams,
  httpProvider: any,
  web3: any
): any {
  // RPC proxy that intercepts eth_signTransaction
  const rpcProxy: Record<string, Function> = {
    eth_signTransaction: async ([txData]: [Web3TransactionData]) => {
      try {
        return await signTransactionViaFireblocks(
          fireblocksClient,
          params,
          txData,
          web3
        );
      } catch (error) {
        Logger.error("Transaction signing error", error);
        throw error;
      }
    },
  };

  // Custom provider that routes to proxy or base provider
  return {
    send: (input: any, callback: Function) => {
      const method = rpcProxy[input.method];

      if (method) {
        // Route to our custom handler
        method(input.params)
          .then((result: any) =>
            callback(null, {
              id: input.id,
              jsonrpc: "2.0",
              result,
            })
          )
          .catch((err: any) => callback(err));
      } else {
        // Route to base HTTP provider
        httpProvider.send(input, callback);
      }
    },
  };
}

/**
 * Retrieves and sets the default account from vault
 *
 * @param fireblocksClient - Fireblocks SDK client
 * @param vaultAccountId - Vault account ID
 * @param assetId - Asset ID
 * @param web3 - Web3 instance
 * @throws {NoAddressesError} If no addresses found in vault
 */
async function setupDefaultAccount(
  fireblocksClient: FireblocksSDK,
  vaultAccountId: string | number,
  assetId: string,
  web3: any
): Promise<void> {
  const accountAddresses = await fireblocksClient.getDepositAddresses(
    vaultAccountId,
    assetId
  );

  if (!accountAddresses || accountAddresses.length === 0) {
    throw new NoAddressesError(vaultAccountId, assetId, {
      operation: "setupDefaultAccount",
    });
  }

  web3.eth.defaultAccount = accountAddresses[0].address;

  // Log account information
  Logger.success(`Source address: ${web3.eth.defaultAccount}`);

  const balanceInWei = await web3.eth.getBalance(web3.eth.defaultAccount);
  const balanceInEther = web3.utils.fromWei(balanceInWei, "ether");

  Logger.balance(web3.eth.defaultAccount, balanceInEther, "ETH");
}

/**
 * Initializes a Web3 instance with Fireblocks integration
 *
 * Creates a custom Web3 provider that intercepts eth_signTransaction calls
 * and routes them through Fireblocks SDK for secure, non-custodial signing.
 *
 * @param params - Web3 initialization parameters
 * @returns Configured Web3 instance with Fireblocks integration
 * @throws {ValidationError} If parameters are invalid
 * @throws {NoAddressesError} If vault has no addresses for the asset
 * @throws {TransactionError} If transaction operations fail
 *
 * @example
 * ```typescript
 * const web3 = await initWeb3Instance({
 *   fireblocksApiClient,
 *   httpProviderUrl: "https://eth-sepolia.g.alchemy.com/v2/...",
 *   vaultAccountId: "0",
 *   assetId: "ETH_TEST3",
 *   tokenName: "ETH",
 *   amount: 0.01,
 *   destAddress: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
 *   filename: "my-transfer"
 * });
 * ```
 */
export async function initWeb3Instance(
  params: Web3InitParams
): Promise<any>;

/**
 * Legacy signature for backward compatibility
 * @deprecated Use the params object version instead
 */
export async function initWeb3Instance(
  fireblocksApiClient: FireblocksSDK,
  httpProviderUrl: string,
  vaultAccountId: string | number,
  assetId: string,
  tokenName?: string,
  amount?: number,
  destAddress?: string,
  filename?: string,
  existingTransactionId?: string
): Promise<any>;

/**
 * Implementation
 */
export async function initWeb3Instance(
  paramsOrClient: Web3InitParams | FireblocksSDK,
  httpProviderUrl?: string,
  vaultAccountId?: string | number,
  assetId?: string,
  tokenName: string = "ETH",
  amount: number = 0,
  destAddress?: string,
  filename?: string,
  existingTransactionId?: string
): Promise<any> {
  // Handle both signatures
  let params: Web3InitParams;

  if ("fireblocksApiClient" in paramsOrClient) {
    // New params object signature
    params = paramsOrClient;
  } else {
    // Legacy individual parameters signature
    validateRequired(httpProviderUrl, "httpProviderUrl");
    validateRequired(vaultAccountId, "vaultAccountId");
    validateRequired(assetId, "assetId");
    validateRequired(destAddress, "destAddress");

    params = {
      fireblocksApiClient: paramsOrClient,
      httpProviderUrl: httpProviderUrl!,
      vaultAccountId: vaultAccountId!,
      assetId: assetId!,
      tokenName,
      amount,
      destAddress: destAddress!,
      filename,
      existingTransactionId,
    };
  }

  // Validate required parameters
  validateVaultId(params.vaultAccountId);
  validateAssetId(params.assetId);
  validateRpcUrl(params.httpProviderUrl);

  // Create base HTTP provider
  const httpProvider = new Web3.providers.HttpProvider(params.httpProviderUrl);

  // Create Web3 instance (will be updated with custom provider)
  let web3 = new Web3(httpProvider);

  // Create custom provider with Fireblocks integration
  const customProvider = createFireblocksProvider(
    params.fireblocksApiClient,
    params,
    httpProvider,
    web3
  );

  // Update Web3 with custom provider
  web3 = new Web3(customProvider);

  // Setup default account from vault
  await setupDefaultAccount(
    params.fireblocksApiClient,
    params.vaultAccountId,
    params.assetId,
    web3
  );

  return web3;
}

/**
 * Legacy export for backward compatibility
 * @deprecated Import from shared/logger instead
 */
export { colorize as colorLog } from "../shared/logger";

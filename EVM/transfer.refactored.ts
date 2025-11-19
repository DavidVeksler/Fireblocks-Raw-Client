/**
 * Unified transfer engine for Fireblocks Raw Client (Refactored)
 *
 * Handles three types of transfers:
 * 1. Native token transfers (ETH, MATIC, etc.)
 * 2. ERC20 token transfers
 * 3. Internal vault-to-vault transfers
 *
 * Key improvements:
 * - Strong typing with interfaces
 * - Separated concerns into focused functions
 * - Better error handling with custom errors
 * - Removed magic numbers
 * - Added validation
 * - Improved gas estimation
 * - Better logging
 */

import { FireblocksSDK, PeerType } from "fireblocks-sdk";
import { initWeb3Instance } from "./web3_instance.refactored";
import {
  TransferParams,
  InternalTransferParams,
  ERC20TransferParams,
  NativeTransferParams,
  ERC20Contract,
  GasEstimate,
} from "../shared/types";
import { Logger } from "../shared/logger";
import { GAS, BALANCE_THRESHOLDS } from "../shared/constants";
import {
  InsufficientBalanceError,
  TransactionError,
  GasEstimationError,
  ValidationError,
} from "../shared/errors";
import {
  validateAmount,
  validateEthereumAddress,
  validateVaultId,
  validateAssetId,
} from "../shared/validators";

/**
 * Standard ERC20 ABI for token transfers
 */
const ERC20_ABI = JSON.parse(
  '[{"inputs":[],"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"owner","type":"address"},{"indexed":true,"internalType":"address","name":"spender","type":"address"},{"indexed":false,"internalType":"uint256","name":"value","type":"uint256"}],"name":"Approval","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"previousOwner","type":"address"},{"indexed":true,"internalType":"address","name":"newOwner","type":"address"}],"name":"OwnershipTransferred","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"from","type":"address"},{"indexed":true,"internalType":"address","name":"to","type":"address"},{"indexed":false,"internalType":"uint256","name":"value","type":"uint256"}],"name":"Transfer","type":"event"},{"inputs":[{"internalType":"address","name":"owner","type":"address"},{"internalType":"address","name":"spender","type":"address"}],"name":"allowance","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"approve","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"account","type":"address"}],"name":"balanceOf","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"burn","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"decimals","outputs":[{"internalType":"uint8","name":"","type":"uint8"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"subtractedValue","type":"uint256"}],"name":"decreaseAllowance","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"getOwner","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"addedValue","type":"uint256"}],"name":"increaseAllowance","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"string","name":"name","type":"string"},{"internalType":"string","name":"symbol","type":"string"},{"internalType":"uint8","name":"decimals","type":"uint8"},{"internalType":"uint256","name":"amount","type":"uint256"},{"internalType":"bool","name":"mintable","type":"bool"},{"internalType":"address","name":"owner","type":"address"}],"name":"initialize","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"mint","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"mintable","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"name","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"renounceOwnership","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"symbol","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"totalSupply","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"recipient","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"transfer","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"sender","type":"address"},{"internalType":"address","name":"recipient","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"transferFrom","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"newOwner","type":"address"}],"name":"transferOwnership","outputs":[],"stateMutability":"nonpayable","type":"function"}]'
);

/**
 * Performs an internal vault-to-vault transfer
 *
 * @param web3 - Web3 instance
 * @param params - Internal transfer parameters
 * @returns Transaction result
 */
async function performInternalTransfer(
  web3: any,
  params: InternalTransferParams
): Promise<any> {
  let { amount } = params;

  // Handle full balance transfers
  if (amount === 0) {
    amount = await calculateMaxInternalTransferAmount(web3, params.assetId);
  }

  // Validate amount is reasonable for internal transfers
  if (amount > BALANCE_THRESHOLDS.LARGE_INTERNAL_TRANSFER_WARNING) {
    Logger.warn(
      `Large internal transfer detected: ${amount} ${params.assetId}. ` +
      `This exceeds the warning threshold of ${BALANCE_THRESHOLDS.LARGE_INTERNAL_TRANSFER_WARNING}.`
    );
  }

  const transactionNote = buildInternalTransferNote(params, amount);
  Logger.info(transactionNote);

  const payload = {
    assetId: params.assetId,
    amount: String(amount),
    source: {
      type: PeerType.VAULT_ACCOUNT,
      id: String(params.sourceVaultId),
    },
    destination: {
      type: PeerType.VAULT_ACCOUNT,
      id: String(params.destinationVaultId),
    },
    note: transactionNote,
  };

  const result = await params.fireblocksApiClient.createTransaction(payload);
  Logger.success("Internal transfer created", { transactionId: result.id });

  return result;
}

/**
 * Calculates the maximum transferable amount for internal transfers
 *
 * @param web3 - Web3 instance
 * @param assetId - Asset identifier
 * @returns Maximum amount that can be transferred
 */
async function calculateMaxInternalTransferAmount(
  web3: any,
  assetId: string
): Promise<number> {
  const maxSpendableInWei = await web3.eth.getBalance(web3.eth.defaultAccount);

  if (assetId === "ETH") {
    // For ETH, subtract gas fees
    const gasPrice = await web3.eth.getGasPrice();
    const gasLimit = BigInt(GAS.SIMPLE_TRANSFER_LIMIT);
    const gasFee = BigInt(gasPrice) * gasLimit;
    const amountInWei = BigInt(maxSpendableInWei) - gasFee;

    if (amountInWei < 0n) {
      throw new InsufficientBalanceError(
        gasFee.toString(),
        maxSpendableInWei.toString(),
        { operation: "calculateMaxInternalTransferAmount" }
      );
    }

    // Convert to ETH
    return Number(web3.utils.fromWei(amountInWei.toString(), "ether"));
  } else {
    // For other assets, return full balance
    const balance = await web3.eth.getBalance(web3.eth.defaultAccount);
    Logger.info(`Max spendable balance: ${balance}`);
    return Number(balance);
  }
}

/**
 * Builds a transaction note for internal transfers
 */
function buildInternalTransferNote(
  params: InternalTransferParams,
  amount: number
): string {
  return (
    `Transfer from vault ${params.sourceVaultId} ` +
    `to vault ${params.destinationVaultId} ` +
    `for ${amount} ${params.assetId}`
  );
}

/**
 * Estimates gas for a transaction
 *
 * @param web3 - Web3 instance
 * @param estimateGasFn - Function that estimates gas
 * @returns Gas estimate with buffer applied
 */
async function estimateGasWithBuffer(
  web3: any,
  estimateGasFn: () => Promise<number>
): Promise<number> {
  try {
    const estimatedGas = await estimateGasFn();
    const gasWithBuffer = Math.floor(estimatedGas * GAS.ESTIMATION_BUFFER);

    Logger.info(`Gas estimated: ${estimatedGas}, with buffer: ${gasWithBuffer}`);

    return gasWithBuffer;
  } catch (error) {
    throw new GasEstimationError(
      error instanceof Error ? error.message : String(error),
      { operation: "estimateGasWithBuffer" }
    );
  }
}

/**
 * Handles ERC20 token transfers
 *
 * @param params - ERC20 transfer parameters
 */
async function handleErc20Transfer(params: ERC20TransferParams): Promise<void> {
  const { web3, contractAddress, recipientAddress, amount } = params;

  // Validate recipient address
  validateEthereumAddress(recipientAddress, "recipientAddress");

  // Create contract instance
  const erc20Contract = new web3.eth.Contract(
    ERC20_ABI,
    contractAddress
  ) as ERC20Contract;

  // Get token decimals and balance
  const tokenDecimals = await erc20Contract.methods.decimals().call();
  const accountBalanceInSmallestUnit = await erc20Contract.methods
    .balanceOf(web3.eth.defaultAccount)
    .call();

  Logger.info(
    `ERC20 contract balance: ${web3.utils.fromWei(
      accountBalanceInSmallestUnit.toString(),
      "ether"
    )}`
  );

  // Convert amount to smallest token unit
  const transferAmountInSmallestUnit = convertToSmallestTokenUnit(
    amount,
    tokenDecimals,
    web3
  );

  // Validate sufficient balance
  if (BigInt(transferAmountInSmallestUnit) > BigInt(accountBalanceInSmallestUnit)) {
    throw new InsufficientBalanceError(
      transferAmountInSmallestUnit.toString(),
      accountBalanceInSmallestUnit.toString(),
      {
        operation: "handleErc20Transfer",
        contractAddress,
        tokenDecimals,
      }
    );
  }

  Logger.info(
    `Initiating transfer of ${amount} tokens ` +
    `(${transferAmountInSmallestUnit} in smallest unit)`
  );

  // Get current gas price
  const currentGasPrice = web3.utils.toBN(await web3.eth.getGasPrice());
  Logger.info(`Current gas price: ${currentGasPrice.toString()} wei`);

  // Estimate gas with buffer
  const gasLimit = await estimateGasWithBuffer(web3, () =>
    erc20Contract.methods
      .transfer(recipientAddress, transferAmountInSmallestUnit)
      .estimateGas({ from: web3.eth.defaultAccount })
  );

  // Prepare transaction data
  const transactionData = erc20Contract.methods
    .transfer(recipientAddress, transferAmountInSmallestUnit)
    .encodeABI();

  // Sign and send transaction
  const signedTransaction = await web3.eth.signTransaction({
    to: contractAddress,
    data: transactionData,
    value: web3.utils.toBN("0x00"),
    gasPrice: currentGasPrice,
    gasLimit,
  });

  Logger.info("Transaction signed, broadcasting...");

  const transactionReceipt = await web3.eth.sendSignedTransaction(
    signedTransaction.raw || signedTransaction
  );

  Logger.success(
    `ERC20 transfer completed. Transaction hash: ${transactionReceipt.transactionHash}`
  );
}

/**
 * Handles native token transfers (ETH, MATIC, etc.)
 *
 * @param params - Native transfer parameters
 */
async function handleNativeTokenTransfer(params: NativeTransferParams): Promise<void> {
  const { web3, recipientAddress, amount } = params;

  // Validate recipient address
  validateEthereumAddress(recipientAddress, "recipientAddress");

  // Get account balance
  const accountBalanceInWei = web3.utils.toBN(
    await web3.eth.getBalance(web3.eth.defaultAccount)
  );

  Logger.info(`Account balance: ${accountBalanceInWei.toString()} wei`);

  if (accountBalanceInWei.isZero()) {
    throw new InsufficientBalanceError("0", "0", {
      operation: "handleNativeTokenTransfer",
      message: "Account balance is zero",
    });
  }

  // Get current gas price
  const currentGasPrice = web3.utils.toBN(await web3.eth.getGasPrice());
  Logger.info(`Current gas price: ${currentGasPrice.toString()} wei`);

  // Convert transfer amount to Wei
  const transferAmountInWei = web3.utils.toBN(
    web3.utils.toWei(amount.toString(), "ether")
  );

  // Validate sufficient balance
  if (transferAmountInWei.gt(accountBalanceInWei)) {
    throw new InsufficientBalanceError(
      transferAmountInWei.toString(),
      accountBalanceInWei.toString(),
      { operation: "handleNativeTokenTransfer" }
    );
  }

  Logger.info(`Initiating native token transfer of ${amount} Ether`);

  // Sign and send transaction
  const signedTransaction = await web3.eth.signTransaction({
    to: recipientAddress,
    value: transferAmountInWei,
    gasPrice: currentGasPrice,
    gasLimit: GAS.SIMPLE_TRANSFER_LIMIT,
  });

  const transactionReceipt = await web3.eth.sendSignedTransaction(
    signedTransaction.raw || signedTransaction
  );

  Logger.success(
    `Native token transfer completed. Transaction hash: ${transactionReceipt.transactionHash}`
  );
}

/**
 * Converts an amount to smallest token unit based on decimals
 *
 * @param amount - Amount in token units
 * @param decimals - Token decimals
 * @param web3 - Web3 instance
 * @returns Amount in smallest unit (as BigInt)
 */
function convertToSmallestTokenUnit(
  amount: number,
  decimals: number,
  web3: any
): bigint {
  // Convert using web3's toWei (assumes 18 decimals)
  const amountInWeiEquivalent = web3.utils.toWei(amount.toString(), "ether");

  // Adjust for actual token decimals
  const decimalsDifference = 18 - decimals;
  const amountInSmallestUnit =
    BigInt(amountInWeiEquivalent) / 10n ** BigInt(decimalsDifference);

  return amountInSmallestUnit;
}

/**
 * Unified transfer function supporting three transfer types
 *
 * Automatically routes to the appropriate handler based on parameters:
 * - Internal transfer: if destinationVault > 0
 * - ERC20 transfer: if erc20ContractAddress provided
 * - Native transfer: otherwise
 *
 * @param params - Transfer parameters
 * @returns Transaction result
 *
 * @example
 * ```typescript
 * // Native token transfer
 * await transfer({
 *   fireblocksApiClient,
 *   ethereumProviderUrl: "https://...",
 *   sourceVaultAccountId: "0",
 *   recipientAddress: "0x...",
 *   assetIdentifier: "ETH_TEST3",
 *   assetSymbol: "ETH",
 *   transferAmount: 0.01
 * });
 *
 * // ERC20 token transfer
 * await transfer({
 *   ...params,
 *   erc20ContractAddress: "0x..."
 * });
 *
 * // Internal vault transfer
 * await transfer({
 *   ...params,
 *   destinationVault: 5
 * });
 * ```
 */
export async function transfer(params: TransferParams): Promise<any>;

/**
 * Legacy signature for backward compatibility
 * @deprecated Use the params object version instead
 */
export async function transfer(
  fireblocksApiClient: FireblocksSDK,
  ethereumProviderUrl: string,
  sourceVaultAccountId: string | number,
  recipientAddress: string,
  assetIdentifier: string,
  assetSymbol: string,
  transferAmount?: number,
  erc20ContractAddress?: string,
  transactionFilename?: string,
  existingTransactionId?: string,
  destinationVault?: number
): Promise<any>;

/**
 * Implementation
 */
export async function transfer(
  paramsOrClient: TransferParams | FireblocksSDK,
  ethereumProviderUrl?: string,
  sourceVaultAccountId?: string | number,
  recipientAddress?: string,
  assetIdentifier?: string,
  assetSymbol?: string,
  transferAmount: number = 0,
  erc20ContractAddress?: string,
  transactionFilename?: string,
  existingTransactionId?: string,
  destinationVault: number = 0
): Promise<any> {
  // Handle both signatures
  let params: TransferParams;

  if ("fireblocksApiClient" in paramsOrClient) {
    // New params object signature
    params = paramsOrClient;
  } else {
    // Legacy individual parameters signature
    params = {
      fireblocksApiClient: paramsOrClient,
      ethereumProviderUrl: ethereumProviderUrl!,
      sourceVaultAccountId: sourceVaultAccountId!,
      recipientAddress: recipientAddress!,
      assetIdentifier: assetIdentifier!,
      assetSymbol: assetSymbol!,
      transferAmount,
      erc20ContractAddress,
      transactionFilename,
      existingTransactionId,
      destinationVault,
    };
  }

  // Set defaults
  const amount = params.transferAmount ?? 0;
  const destVault = params.destinationVault ?? 0;

  // Validate parameters
  validateVaultId(params.sourceVaultAccountId, "sourceVaultAccountId");
  validateAssetId(params.assetIdentifier, "assetIdentifier");
  validateAmount(amount, "transferAmount");

  // Initialize Web3 instance with Fireblocks
  const web3 = await initWeb3Instance({
    fireblocksApiClient: params.fireblocksApiClient,
    httpProviderUrl: params.ethereumProviderUrl,
    vaultAccountId: params.sourceVaultAccountId,
    assetId: params.assetIdentifier,
    tokenName: params.assetSymbol,
    amount,
    destAddress: params.recipientAddress,
    filename: params.transactionFilename,
    existingTransactionId: params.existingTransactionId,
  });

  // Route to appropriate transfer handler
  if (destVault > 0) {
    // Internal vault-to-vault transfer
    Logger.info("Performing internal vault-to-vault transfer");
    return performInternalTransfer(web3, {
      fireblocksApiClient: params.fireblocksApiClient,
      assetId: params.assetSymbol || "ETH",
      amount,
      sourceVaultId: params.sourceVaultAccountId,
      destinationVaultId: destVault,
    });
  } else if (params.erc20ContractAddress) {
    // ERC20 token transfer
    Logger.info("Performing ERC20 token transfer");
    await handleErc20Transfer({
      web3,
      contractAddress: params.erc20ContractAddress,
      recipientAddress: params.recipientAddress,
      amount,
    });
  } else {
    // Native token transfer
    Logger.info("Performing native token transfer");
    await handleNativeTokenTransfer({
      web3,
      recipientAddress: params.recipientAddress,
      amount,
    });
  }

  Logger.success("Transfer process completed");
}

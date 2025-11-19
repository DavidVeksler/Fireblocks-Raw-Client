/**
 * Bitcoin raw transaction signing via Fireblocks (Refactored)
 *
 * Provides utilities for:
 * - Retrieving available UTXOs from vault accounts
 * - Signing Bitcoin transactions with multiple destinations
 * - Selective UTXO spending
 * - Transaction polling until completion
 *
 * Key improvements:
 * - Strong typing with interfaces
 * - Better error handling
 * - Fixed undefined variable bug (txId -> transactionId)
 * - Removed code duplication
 * - Better logging
 * - Input validation
 */

import {
  FireblocksSDK,
  PeerType,
  TransactionOperation,
  TransactionStatus,
} from "fireblocks-sdk";
import { BtcDestination, BtcTransactionParams, UTXO } from "../shared/types";
import { Logger } from "../shared/logger";
import { VALIDATION } from "../shared/constants";
import {
  TransactionError,
  ValidationError,
  VaultError,
} from "../shared/errors";
import { pollTransactionUntilSuccess } from "../shared/transaction-poller";
import {
  validateVaultId,
  validateAssetId,
  validateNonEmptyArray,
  validateRange,
} from "../shared/validators";

/**
 * Retrieves available UTXOs for a vault account
 *
 * @param fireblocksApi - Fireblocks SDK client
 * @param vaultAccountId - Vault account ID
 * @param assetId - Asset ID (e.g., "BTC")
 * @returns Array of available UTXOs
 * @throws {VaultError} If UTXO retrieval fails
 *
 * @example
 * ```typescript
 * const utxos = await getAvailableUTXOs(fireblocksApi, "0", "BTC");
 * console.log(`Found ${utxos.length} UTXOs`);
 * ```
 */
export async function getAvailableUTXOs(
  fireblocksApi: FireblocksSDK,
  vaultAccountId: string,
  assetId: string
): Promise<UTXO[]> {
  // Validate inputs
  validateVaultId(vaultAccountId, "vaultAccountId");
  validateAssetId(assetId, "assetId");

  Logger.info(`Retrieving UTXOs: Vault ${vaultAccountId}, Asset ${assetId}`);

  try {
    const utxos = await fireblocksApi.getUnspentInputs(vaultAccountId, assetId);

    Logger.success(`Retrieved ${utxos.length} UTXOs`);

    return utxos as UTXO[];
  } catch (error) {
    throw new VaultError(
      `Failed to retrieve UTXOs for asset ${assetId}`,
      vaultAccountId,
      {
        operation: "getAvailableUTXOs",
        assetId,
        error: error instanceof Error ? error.message : String(error),
      }
    );
  }
}

/**
 * Validates Bitcoin transaction destinations
 *
 * @param destinations - Array of destinations to validate
 * @throws {ValidationError} If destinations are invalid
 */
function validateDestinations(destinations: BtcDestination[]): void {
  validateNonEmptyArray(destinations, "destinations");

  if (destinations.length > VALIDATION.MAX_BTC_DESTINATIONS) {
    throw new ValidationError(
      "destinations",
      destinations,
      `Too many destinations. Maximum is ${VALIDATION.MAX_BTC_DESTINATIONS}`
    );
  }

  destinations.forEach((dest, index) => {
    if (!dest.vaultid) {
      throw new ValidationError(
        `destinations[${index}].vaultid`,
        dest,
        "vaultid is required"
      );
    }

    if (!dest.amount) {
      throw new ValidationError(
        `destinations[${index}].amount`,
        dest,
        "amount is required"
      );
    }

    // Validate amount is a valid number
    const amount = parseFloat(dest.amount);
    if (isNaN(amount) || amount <= 0) {
      throw new ValidationError(
        `destinations[${index}].amount`,
        dest.amount,
        "must be a positive number"
      );
    }
  });
}

/**
 * Validates selected UTXOs
 *
 * @param utxos - Array of UTXOs to validate
 * @throws {ValidationError} If UTXOs are invalid
 */
function validateUTXOs(utxos: UTXO[]): void {
  if (utxos.length === 0) {
    return; // Empty array is valid (means use all available)
  }

  utxos.forEach((utxo, index) => {
    if (!utxo.txHash) {
      throw new ValidationError(
        `selectedUTXOs[${index}].txHash`,
        utxo,
        "txHash is required"
      );
    }

    if (utxo.index === undefined || utxo.index === null) {
      throw new ValidationError(
        `selectedUTXOs[${index}].index`,
        utxo,
        "index is required"
      );
    }

    if (utxo.index < 0) {
      throw new ValidationError(
        `selectedUTXOs[${index}].index`,
        utxo.index,
        "must be non-negative"
      );
    }
  });
}

/**
 * Builds transaction note for Bitcoin transfer
 *
 * @param params - BTC transaction parameters
 * @returns Human-readable transaction note
 */
function buildBtcTransactionNote(params: BtcTransactionParams): string {
  const destinationCount = params.destinations.length;
  const totalAmount = params.destinations.reduce(
    (sum, dest) => sum + parseFloat(dest.amount),
    0
  );
  const refNote = params.referenceFilename
    ? ` (Ref: ${params.referenceFilename})`
    : "";

  return (
    `Sending ${totalAmount} BTC from vault ${params.vaultAccountId} ` +
    `to ${destinationCount} destination(s)${refNote}`
  );
}

/**
 * Prepares destinations array for Fireblocks API
 *
 * @param destinations - Array of destination definitions
 * @returns Formatted destinations for API
 */
function prepareDestinations(destinations: BtcDestination[]): any[] {
  return destinations.map((dest) => ({
    destination: {
      type: PeerType.VAULT_ACCOUNT,
      id: dest.vaultid,
    },
    amount: dest.amount,
  }));

  // For external addresses (commented out for reference):
  // type: PeerType.ONE_TIME_ADDRESS,
  // oneTimeAddress: {
  //   address: dest.address,
  // },
}

/**
 * Prepares extra parameters for UTXO selection
 *
 * @param selectedUTXOs - Optional array of specific UTXOs to spend
 * @returns Extra parameters object for API
 */
function prepareExtraParameters(selectedUTXOs?: UTXO[]): any {
  if (!selectedUTXOs || selectedUTXOs.length === 0) {
    return {};
  }

  return {
    inputsSelection: {
      inputsToSpend: selectedUTXOs.map((utxo) => ({
        txHash: utxo.txHash,
        index: utxo.index,
      })),
    },
  };
}

/**
 * Signs a Bitcoin transaction to multiple destinations
 *
 * Supports:
 * - Multiple destination vaults
 * - Optional selective UTXO spending
 * - Automatic transaction polling
 * - Failed transaction cancellation
 *
 * @param params - BTC transaction parameters
 * @returns Transaction information on completion
 * @throws {ValidationError} If parameters are invalid
 * @throws {TransactionError} If transaction fails
 *
 * @example
 * ```typescript
 * // Simple transfer to one destination
 * await signBtcTransaction({
 *   fireblocksApi,
 *   vaultAccountId: "0",
 *   assetId: "BTC",
 *   destinations: [{ vaultid: "5", amount: "0.001" }],
 *   referenceFilename: "btc-transfer-001"
 * });
 *
 * // Transfer with specific UTXO selection
 * await signBtcTransaction({
 *   fireblocksApi,
 *   vaultAccountId: "0",
 *   assetId: "BTC",
 *   destinations: [
 *     { vaultid: "5", amount: "0.0005" },
 *     { vaultid: "6", amount: "0.0005" }
 *   ],
 *   selectedUTXOs: [
 *     { txHash: "abc123...", index: 0 }
 *   ]
 * });
 * ```
 */
export async function signBtcTransaction(
  params: BtcTransactionParams
): Promise<any>;

/**
 * Legacy signature for backward compatibility
 * @deprecated Use the params object version instead
 */
export async function signBtcTransaction(
  fireblocksApi: FireblocksSDK,
  vaultAccountId: string,
  assetId: string,
  destinations: BtcDestination[],
  referenceFilename?: string,
  selectedUTXOs?: UTXO[]
): Promise<any>;

/**
 * Implementation
 */
export async function signBtcTransaction(
  paramsOrClient: BtcTransactionParams | FireblocksSDK,
  vaultAccountId?: string,
  assetId?: string,
  destinations?: BtcDestination[],
  referenceFilename: string = "",
  selectedUTXOs: UTXO[] = []
): Promise<any> {
  // Handle both signatures
  let params: BtcTransactionParams;

  if ("fireblocksApi" in paramsOrClient) {
    // New params object signature
    params = paramsOrClient;
  } else {
    // Legacy individual parameters signature
    params = {
      fireblocksApi: paramsOrClient,
      vaultAccountId: vaultAccountId!,
      assetId: assetId!,
      destinations: destinations!,
      referenceFilename,
      selectedUTXOs,
    };
  }

  // Validate inputs
  validateVaultId(params.vaultAccountId, "vaultAccountId");
  validateAssetId(params.assetId, "assetId");
  validateDestinations(params.destinations);

  if (params.selectedUTXOs) {
    validateUTXOs(params.selectedUTXOs);
  }

  Logger.section("Bitcoin Transaction Signing");

  // Build transaction note
  const transactionNote = buildBtcTransactionNote(params);
  Logger.info(transactionNote);

  // Prepare transaction request
  const txRequest = {
    operation: TransactionOperation.TRANSFER,
    assetId: params.assetId,
    source: {
      type: PeerType.VAULT_ACCOUNT,
      id: params.vaultAccountId,
    },
    destinations: prepareDestinations(params.destinations),
    note: transactionNote,
    extraParameters: prepareExtraParameters(params.selectedUTXOs),
  };

  // Create transaction
  Logger.info("Creating Bitcoin transaction...");
  const createTxResponse = await params.fireblocksApi.createTransaction(txRequest);

  Logger.transaction(
    createTxResponse.id,
    createTxResponse.status,
    "Bitcoin transaction created"
  );

  // Poll until completion
  try {
    const transactionInfo = await pollTransactionUntilSuccess(
      params.fireblocksApi,
      createTxResponse.id
    );

    Logger.success("Bitcoin transaction completed successfully");

    return transactionInfo;
  } catch (error) {
    if (error instanceof TransactionError) {
      Logger.error(
        `Bitcoin transaction ${error.status}: ${createTxResponse.id}`,
        error
      );
    }

    throw error;
  }
}

/**
 * Gets total balance from UTXOs
 *
 * @param utxos - Array of UTXOs
 * @returns Total balance in BTC
 */
export function calculateUTXOBalance(utxos: UTXO[]): number {
  return utxos.reduce((total, utxo) => {
    const amount = utxo.amount ? parseFloat(utxo.amount) : 0;
    return total + amount;
  }, 0);
}

/**
 * Filters UTXOs by minimum amount
 *
 * @param utxos - Array of UTXOs
 * @param minAmount - Minimum amount threshold
 * @returns Filtered UTXOs
 */
export function filterUTXOsByAmount(utxos: UTXO[], minAmount: number): UTXO[] {
  return utxos.filter((utxo) => {
    const amount = utxo.amount ? parseFloat(utxo.amount) : 0;
    return amount >= minAmount;
  });
}

/**
 * Selects UTXOs to meet a target amount
 *
 * Uses a greedy algorithm to select the smallest set of UTXOs
 * that meets or exceeds the target amount.
 *
 * @param utxos - Available UTXOs
 * @param targetAmount - Target amount to reach
 * @returns Selected UTXOs
 * @throws {ValidationError} If target cannot be met
 */
export function selectUTXOsForAmount(
  utxos: UTXO[],
  targetAmount: number
): UTXO[] {
  // Sort UTXOs by amount (descending)
  const sortedUTXOs = [...utxos].sort((a, b) => {
    const amountA = a.amount ? parseFloat(a.amount) : 0;
    const amountB = b.amount ? parseFloat(b.amount) : 0;
    return amountB - amountA;
  });

  const selected: UTXO[] = [];
  let currentTotal = 0;

  for (const utxo of sortedUTXOs) {
    if (currentTotal >= targetAmount) {
      break;
    }

    selected.push(utxo);
    currentTotal += utxo.amount ? parseFloat(utxo.amount) : 0;
  }

  if (currentTotal < targetAmount) {
    throw new ValidationError(
      "targetAmount",
      targetAmount,
      `Insufficient UTXOs. Required: ${targetAmount}, Available: ${currentTotal}`
    );
  }

  Logger.info(
    `Selected ${selected.length} UTXOs totaling ${currentTotal} BTC for target ${targetAmount} BTC`
  );

  return selected;
}

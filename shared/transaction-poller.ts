/**
 * Transaction polling utility for Fireblocks transactions
 *
 * Provides a reusable, configurable transaction polling mechanism
 * that eliminates code duplication across multiple files.
 */

import { FireblocksSDK, TransactionStatus } from "fireblocks-sdk";
import { PollingConfig, PollingResult, isTerminalStatus, isFailedStatus } from "./types";
import { POLLING } from "./constants";
import { Logger } from "./logger";
import { TransactionError, TransactionTimeoutError } from "./errors";

/**
 * Polls a Fireblocks transaction until it reaches a terminal status
 *
 * @param fireblocksClient - Initialized Fireblocks SDK client
 * @param transactionId - Transaction ID to poll
 * @param config - Optional polling configuration
 * @returns Polling result with final status and transaction info
 * @throws {TransactionTimeoutError} If polling exceeds timeout
 * @throws {TransactionError} If transaction fails
 */
export async function pollTransaction(
  fireblocksClient: FireblocksSDK,
  transactionId: string,
  config: PollingConfig = {}
): Promise<PollingResult> {
  const {
    intervalMs = POLLING.INTERVAL_MS,
    timeoutMs = POLLING.TIMEOUT_MS,
    onStatusChange,
  } = config;

  const startTime = Date.now();
  let currentStatus: TransactionStatus;
  let transactionInfo: any;

  // Get initial status
  try {
    transactionInfo = await fireblocksClient.getTransactionById(transactionId);
    currentStatus = transactionInfo.status;

    Logger.transaction(transactionId, currentStatus, "Initial status");
    onStatusChange?.(currentStatus);
  } catch (error) {
    throw new TransactionError(
      "Failed to fetch initial transaction status",
      transactionId,
      undefined,
      { operation: "pollTransaction" }
    );
  }

  // Poll until terminal status
  while (!isTerminalStatus(currentStatus)) {
    // Check timeout
    if (Date.now() - startTime > timeoutMs) {
      throw new TransactionTimeoutError(transactionId, timeoutMs, {
        operation: "pollTransaction",
        lastStatus: currentStatus,
      });
    }

    // Wait before next poll
    await sleep(intervalMs);

    // Fetch updated status
    try {
      transactionInfo = await fireblocksClient.getTransactionById(transactionId);
      currentStatus = transactionInfo.status;

      Logger.polling(transactionId, currentStatus);
      onStatusChange?.(currentStatus);
    } catch (error) {
      Logger.warn(`Error polling transaction ${transactionId}, will retry...`);
      // Continue polling despite errors
      continue;
    }
  }

  // Handle failed transactions
  let cancelled = false;
  if (isFailedStatus(currentStatus)) {
    cancelled = await cancelFailedTransaction(fireblocksClient, transactionId, currentStatus);
  }

  return {
    finalStatus: currentStatus,
    transactionInfo,
    cancelled,
  };
}

/**
 * Cancels a failed transaction
 *
 * @param fireblocksClient - Initialized Fireblocks SDK client
 * @param transactionId - Transaction ID to cancel
 * @param status - Current transaction status
 * @returns True if successfully cancelled, false otherwise
 */
async function cancelFailedTransaction(
  fireblocksClient: FireblocksSDK,
  transactionId: string,
  status: TransactionStatus
): Promise<boolean> {
  try {
    await fireblocksClient.cancelTransactionById(transactionId);
    Logger.warn(`Cancelled transaction ${transactionId} with status ${status}`);
    return true;
  } catch (error) {
    Logger.error(`Failed to cancel transaction ${transactionId}`, error);
    return false;
  }
}

/**
 * Polls a transaction and throws if it fails
 *
 * @param fireblocksClient - Initialized Fireblocks SDK client
 * @param transactionId - Transaction ID to poll
 * @param config - Optional polling configuration
 * @returns Transaction info on success
 * @throws {TransactionError} If transaction fails or is cancelled
 */
export async function pollTransactionUntilSuccess(
  fireblocksClient: FireblocksSDK,
  transactionId: string,
  config: PollingConfig = {}
): Promise<any> {
  const result = await pollTransaction(fireblocksClient, transactionId, config);

  if (result.finalStatus === TransactionStatus.COMPLETED) {
    Logger.success(`Transaction ${transactionId} completed successfully`);
    return result.transactionInfo;
  }

  // Transaction failed or was cancelled
  throw new TransactionError(
    `Transaction ${result.finalStatus.toLowerCase()}`,
    transactionId,
    result.finalStatus,
    { cancelled: result.cancelled }
  );
}

/**
 * Polls multiple transactions concurrently
 *
 * @param fireblocksClient - Initialized Fireblocks SDK client
 * @param transactionIds - Array of transaction IDs to poll
 * @param config - Optional polling configuration
 * @returns Array of polling results
 */
export async function pollTransactions(
  fireblocksClient: FireblocksSDK,
  transactionIds: string[],
  config: PollingConfig = {}
): Promise<PollingResult[]> {
  const pollPromises = transactionIds.map((txId) =>
    pollTransaction(fireblocksClient, txId, config)
  );

  return Promise.all(pollPromises);
}

/**
 * Resumes polling for an existing transaction
 *
 * Useful for resuming operations after a script failure or restart.
 *
 * @param fireblocksClient - Initialized Fireblocks SDK client
 * @param transactionId - Existing transaction ID
 * @param config - Optional polling configuration
 * @returns Polling result
 */
export async function resumeTransaction(
  fireblocksClient: FireblocksSDK,
  transactionId: string,
  config: PollingConfig = {}
): Promise<PollingResult> {
  Logger.info(`Resuming transaction ${transactionId}`);

  // Check if transaction is already complete
  const txInfo = await fireblocksClient.getTransactionById(transactionId);

  if (isTerminalStatus(txInfo.status)) {
    Logger.info(`Transaction ${transactionId} already in terminal status: ${txInfo.status}`);
    return {
      finalStatus: txInfo.status,
      transactionInfo: txInfo,
      cancelled: false,
    };
  }

  // Continue polling
  return pollTransaction(fireblocksClient, transactionId, config);
}

/**
 * Helper function to sleep for a specified duration
 *
 * @param ms - Milliseconds to sleep
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Checks if a transaction is in a terminal state
 *
 * @param fireblocksClient - Initialized Fireblocks SDK client
 * @param transactionId - Transaction ID to check
 * @returns Transaction status if terminal, undefined otherwise
 */
export async function checkTransactionStatus(
  fireblocksClient: FireblocksSDK,
  transactionId: string
): Promise<TransactionStatus | undefined> {
  try {
    const txInfo = await fireblocksClient.getTransactionById(transactionId);
    return isTerminalStatus(txInfo.status) ? txInfo.status : undefined;
  } catch (error) {
    Logger.error(`Failed to check transaction status for ${transactionId}`, error);
    return undefined;
  }
}

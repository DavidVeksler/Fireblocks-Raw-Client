/**
 * Input validation utilities for Fireblocks Raw Client
 *
 * Provides reusable validation functions to ensure data integrity
 * and prevent runtime errors.
 */

import { REGEX, VALIDATION } from "./constants";
import { ValidationError } from "./errors";

/**
 * Validates an Ethereum address format
 *
 * @param address - Address to validate
 * @param fieldName - Field name for error messages
 * @throws {ValidationError} If address is invalid
 */
export function validateEthereumAddress(
  address: string,
  fieldName: string = "address"
): void {
  if (!address || typeof address !== "string") {
    throw new ValidationError(
      fieldName,
      address,
      "Address is required and must be a string"
    );
  }

  if (!REGEX.ETH_ADDRESS.test(address)) {
    throw new ValidationError(
      fieldName,
      address,
      "Invalid Ethereum address format (must start with 0x and be 40 hex characters)"
    );
  }
}

/**
 * Validates a transaction amount
 *
 * @param amount - Amount to validate
 * @param fieldName - Field name for error messages
 * @param allowZero - Whether to allow zero (for full balance transfers)
 * @throws {ValidationError} If amount is invalid
 */
export function validateAmount(
  amount: number,
  fieldName: string = "amount",
  allowZero: boolean = true
): void {
  if (typeof amount !== "number" || isNaN(amount)) {
    throw new ValidationError(fieldName, amount, "Must be a valid number");
  }

  if (amount < 0) {
    throw new ValidationError(fieldName, amount, "Cannot be negative");
  }

  if (!allowZero && amount === 0) {
    throw new ValidationError(fieldName, amount, "Cannot be zero");
  }

  if (amount > 0 && amount < VALIDATION.MIN_TRANSACTION_AMOUNT) {
    throw new ValidationError(
      fieldName,
      amount,
      `Must be at least ${VALIDATION.MIN_TRANSACTION_AMOUNT} or 0`
    );
  }
}

/**
 * Validates a vault ID
 *
 * @param vaultId - Vault ID to validate
 * @param fieldName - Field name for error messages
 * @throws {ValidationError} If vault ID is invalid
 */
export function validateVaultId(
  vaultId: string | number,
  fieldName: string = "vaultId"
): void {
  if (vaultId === undefined || vaultId === null) {
    throw new ValidationError(fieldName, vaultId, "Vault ID is required");
  }

  const vaultIdStr = String(vaultId);
  if (vaultIdStr.trim() === "") {
    throw new ValidationError(fieldName, vaultId, "Vault ID cannot be empty");
  }

  // Check if it's a valid number when converted
  const vaultIdNum = Number(vaultIdStr);
  if (isNaN(vaultIdNum) || vaultIdNum < 0) {
    throw new ValidationError(
      fieldName,
      vaultId,
      "Vault ID must be a non-negative number"
    );
  }
}

/**
 * Validates an asset ID
 *
 * @param assetId - Asset ID to validate
 * @param fieldName - Field name for error messages
 * @throws {ValidationError} If asset ID is invalid
 */
export function validateAssetId(
  assetId: string,
  fieldName: string = "assetId"
): void {
  if (!assetId || typeof assetId !== "string") {
    throw new ValidationError(
      fieldName,
      assetId,
      "Asset ID is required and must be a string"
    );
  }

  if (assetId.trim() === "") {
    throw new ValidationError(fieldName, assetId, "Asset ID cannot be empty");
  }
}

/**
 * Validates a Fireblocks transaction ID
 *
 * @param txId - Transaction ID to validate
 * @param fieldName - Field name for error messages
 * @throws {ValidationError} If transaction ID is invalid
 */
export function validateTransactionId(
  txId: string,
  fieldName: string = "transactionId"
): void {
  if (!txId || typeof txId !== "string") {
    throw new ValidationError(
      fieldName,
      txId,
      "Transaction ID is required and must be a string"
    );
  }

  if (!REGEX.FIREBLOCKS_TX_ID.test(txId)) {
    throw new ValidationError(
      fieldName,
      txId,
      "Invalid Fireblocks transaction ID format (must be a UUID)"
    );
  }
}

/**
 * Validates an RPC URL
 *
 * @param url - RPC URL to validate
 * @param fieldName - Field name for error messages
 * @throws {ValidationError} If URL is invalid
 */
export function validateRpcUrl(
  url: string,
  fieldName: string = "rpcUrl"
): void {
  if (!url || typeof url !== "string") {
    throw new ValidationError(
      fieldName,
      url,
      "RPC URL is required and must be a string"
    );
  }

  try {
    const urlObj = new URL(url);
    if (!["http:", "https:", "ws:", "wss:"].includes(urlObj.protocol)) {
      throw new Error("Invalid protocol");
    }
  } catch (error) {
    throw new ValidationError(
      fieldName,
      url,
      "Must be a valid HTTP/HTTPS/WS/WSS URL"
    );
  }
}

/**
 * Validates CLI arguments
 *
 * @param args - Arguments array
 * @param expectedCount - Expected number of arguments
 * @param usageMessage - Usage message to display on error
 * @throws {ValidationError} If arguments are invalid
 */
export function validateCliArguments(
  args: string[],
  expectedCount: number,
  usageMessage: string
): void {
  if (args.length !== expectedCount) {
    console.error(`\x1b[31mError: Expected ${expectedCount} arguments, got ${args.length}\x1b[0m`);
    console.error(`\x1b[33mUsage: ${usageMessage}\x1b[0m`);
    process.exit(1);
  }
}

/**
 * Validates a file path exists
 *
 * @param filePath - File path to validate
 * @param fieldName - Field name for error messages
 * @throws {ValidationError} If file doesn't exist
 */
export function validateFileExists(
  filePath: string,
  fieldName: string = "filePath"
): void {
  const fs = require("fs");

  if (!filePath || typeof filePath !== "string") {
    throw new ValidationError(
      fieldName,
      filePath,
      "File path is required and must be a string"
    );
  }

  if (!fs.existsSync(filePath)) {
    throw new ValidationError(fieldName, filePath, "File does not exist");
  }
}

/**
 * Validates that a value is not null or undefined
 *
 * @param value - Value to validate
 * @param fieldName - Field name for error messages
 * @throws {ValidationError} If value is null or undefined
 */
export function validateRequired<T>(
  value: T | null | undefined,
  fieldName: string
): asserts value is T {
  if (value === null || value === undefined) {
    throw new ValidationError(fieldName, value, "Value is required");
  }
}

/**
 * Validates an array is not empty
 *
 * @param array - Array to validate
 * @param fieldName - Field name for error messages
 * @throws {ValidationError} If array is empty
 */
export function validateNonEmptyArray<T>(
  array: T[],
  fieldName: string = "array"
): void {
  if (!Array.isArray(array) || array.length === 0) {
    throw new ValidationError(
      fieldName,
      array,
      "Must be a non-empty array"
    );
  }
}

/**
 * Validates a number is within a range
 *
 * @param value - Value to validate
 * @param min - Minimum value (inclusive)
 * @param max - Maximum value (inclusive)
 * @param fieldName - Field name for error messages
 * @throws {ValidationError} If value is out of range
 */
export function validateRange(
  value: number,
  min: number,
  max: number,
  fieldName: string = "value"
): void {
  if (typeof value !== "number" || isNaN(value)) {
    throw new ValidationError(fieldName, value, "Must be a valid number");
  }

  if (value < min || value > max) {
    throw new ValidationError(
      fieldName,
      value,
      `Must be between ${min} and ${max}`
    );
  }
}

/**
 * Safely validates and returns a parsed number
 *
 * @param value - Value to parse
 * @param fieldName - Field name for error messages
 * @returns Parsed number
 * @throws {ValidationError} If value cannot be parsed as a number
 */
export function parseAndValidateNumber(
  value: string | number,
  fieldName: string = "value"
): number {
  const num = typeof value === "string" ? parseFloat(value) : value;

  if (isNaN(num)) {
    throw new ValidationError(
      fieldName,
      value,
      "Cannot be parsed as a number"
    );
  }

  return num;
}

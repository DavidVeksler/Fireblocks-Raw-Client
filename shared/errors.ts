/**
 * Custom error classes for Fireblocks Raw Client
 *
 * Provides structured error handling with context information
 * for better debugging and error reporting.
 */

import { ErrorContext } from "./types";

/**
 * Base error class for all Fireblocks-related errors
 */
export class FireblocksError extends Error {
  public readonly context?: ErrorContext;
  public readonly timestamp: Date;

  constructor(message: string, context?: ErrorContext) {
    super(message);
    this.name = this.constructor.name;
    this.context = context;
    this.timestamp = new Date();

    // Maintains proper stack trace for where error was thrown
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Returns a formatted error message with context
   */
  getDetailedMessage(): string {
    if (!this.context) {
      return this.message;
    }

    const contextStr = Object.entries(this.context)
      .map(([key, value]) => `${key}=${value}`)
      .join(", ");

    return `${this.message} [${contextStr}]`;
  }
}

/**
 * Error thrown when transaction fails
 */
export class TransactionError extends FireblocksError {
  public readonly transactionId?: string;
  public readonly status?: string;

  constructor(
    message: string,
    transactionId?: string,
    status?: string,
    context?: ErrorContext
  ) {
    super(message, context);
    this.transactionId = transactionId;
    this.status = status;
  }
}

/**
 * Error thrown when balance is insufficient
 */
export class InsufficientBalanceError extends FireblocksError {
  public readonly required: string;
  public readonly available: string;

  constructor(required: string, available: string, context?: ErrorContext) {
    super(
      `Insufficient balance: required ${required}, available ${available}`,
      context
    );
    this.required = required;
    this.available = available;
  }
}

/**
 * Error thrown when validation fails
 */
export class ValidationError extends FireblocksError {
  public readonly field: string;
  public readonly value: any;

  constructor(field: string, value: any, reason: string, context?: ErrorContext) {
    super(`Validation failed for ${field}: ${reason}`, context);
    this.field = field;
    this.value = value;
  }
}

/**
 * Error thrown when configuration is invalid or missing
 */
export class ConfigurationError extends FireblocksError {
  constructor(message: string, context?: ErrorContext) {
    super(`Configuration error: ${message}`, context);
  }
}

/**
 * Error thrown when API calls fail
 */
export class ApiError extends FireblocksError {
  public readonly statusCode?: number;
  public readonly endpoint?: string;

  constructor(
    message: string,
    statusCode?: number,
    endpoint?: string,
    context?: ErrorContext
  ) {
    super(message, context);
    this.statusCode = statusCode;
    this.endpoint = endpoint;
  }
}

/**
 * Error thrown when vault operations fail
 */
export class VaultError extends FireblocksError {
  public readonly vaultId: string | number;

  constructor(message: string, vaultId: string | number, context?: ErrorContext) {
    super(`Vault ${vaultId}: ${message}`, context);
    this.vaultId = vaultId;
  }
}

/**
 * Error thrown when no addresses found in vault
 */
export class NoAddressesError extends VaultError {
  public readonly assetId: string;

  constructor(vaultId: string | number, assetId: string, context?: ErrorContext) {
    super(
      `No account addresses found for asset ${assetId}`,
      vaultId,
      context
    );
    this.assetId = assetId;
  }
}

/**
 * Error thrown when transaction times out during polling
 */
export class TransactionTimeoutError extends TransactionError {
  public readonly timeoutMs: number;

  constructor(
    transactionId: string,
    timeoutMs: number,
    context?: ErrorContext
  ) {
    super(
      `Transaction timed out after ${timeoutMs}ms`,
      transactionId,
      "TIMEOUT",
      context
    );
    this.timeoutMs = timeoutMs;
  }
}

/**
 * Error thrown when CSV processing fails
 */
export class CsvProcessingError extends FireblocksError {
  public readonly filePath: string;
  public readonly row?: number;

  constructor(
    message: string,
    filePath: string,
    row?: number,
    context?: ErrorContext
  ) {
    const rowInfo = row !== undefined ? ` at row ${row}` : "";
    super(`CSV processing error in ${filePath}${rowInfo}: ${message}`, context);
    this.filePath = filePath;
    this.row = row;
  }
}

/**
 * Error thrown when gas estimation fails
 */
export class GasEstimationError extends FireblocksError {
  constructor(message: string, context?: ErrorContext) {
    super(`Gas estimation failed: ${message}`, context);
  }
}

/**
 * Error thrown when network operations fail
 */
export class NetworkError extends FireblocksError {
  public readonly retryCount?: number;

  constructor(message: string, retryCount?: number, context?: ErrorContext) {
    const retryInfo = retryCount !== undefined ? ` (after ${retryCount} retries)` : "";
    super(`Network error${retryInfo}: ${message}`, context);
    this.retryCount = retryCount;
  }
}

/**
 * Error handler utility functions
 */
export class ErrorHandler {
  /**
   * Wraps an async function with error handling
   */
  static async withErrorHandling<T>(
    fn: () => Promise<T>,
    errorMessage: string,
    context?: ErrorContext
  ): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (error instanceof FireblocksError) {
        throw error; // Re-throw our custom errors
      }

      // Wrap unknown errors
      throw new FireblocksError(
        `${errorMessage}: ${error instanceof Error ? error.message : String(error)}`,
        context
      );
    }
  }

  /**
   * Converts unknown errors to FireblocksError
   */
  static normalize(error: unknown, defaultMessage: string = "An error occurred"): FireblocksError {
    if (error instanceof FireblocksError) {
      return error;
    }

    if (error instanceof Error) {
      return new FireblocksError(error.message);
    }

    return new FireblocksError(
      typeof error === "string" ? error : defaultMessage
    );
  }

  /**
   * Logs an error with full context
   */
  static logError(error: unknown, additionalContext?: ErrorContext): void {
    const normalizedError = this.normalize(error);

    const context = {
      ...normalizedError.context,
      ...additionalContext,
    };

    console.error(`\x1b[31m[ERROR] ${normalizedError.getDetailedMessage()}\x1b[0m`);

    if (Object.keys(context).length > 0) {
      console.error("\x1b[31mContext:\x1b[0m", context);
    }

    if (normalizedError.stack) {
      console.error("\x1b[31mStack trace:\x1b[0m");
      console.error(normalizedError.stack);
    }
  }
}

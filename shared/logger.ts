/**
 * Centralized logging utility with colored console output
 *
 * Provides consistent logging across the application with support for:
 * - Color-coded messages by severity
 * - Structured error logging
 * - Context-aware log messages
 * - Transaction-specific logging
 */

import { LogLevel, LogColor, ErrorContext } from "./types";

/**
 * ANSI color codes mapping
 */
const COLOR_MAP: Record<LogLevel, LogColor> = {
  [LogLevel.DEBUG]: LogColor.WHITE,
  [LogLevel.INFO]: LogColor.CYAN,
  [LogLevel.WARN]: LogColor.YELLOW,
  [LogLevel.ERROR]: LogColor.RED,
  [LogLevel.SUCCESS]: LogColor.GREEN,
};

/**
 * Wraps a message with ANSI color codes
 *
 * @param message - The message to colorize
 * @param colorCode - ANSI color code
 * @returns Colored message string
 */
export function colorize(message: string, colorCode: string): string {
  return `\x1b[${colorCode}m${message}\x1b[0m`;
}

/**
 * Formats a timestamp for log messages
 *
 * @returns Formatted timestamp string
 */
function getTimestamp(): string {
  return new Date().toISOString();
}

/**
 * Core logging function with color support
 *
 * @param level - Log level
 * @param message - Message to log
 * @param data - Optional additional data to log
 */
function log(level: LogLevel, message: string, data?: any): void {
  const color = COLOR_MAP[level];
  const timestamp = getTimestamp();
  const prefix = colorize(`[${timestamp}] [${level}]`, color);
  const coloredMessage = colorize(message, color);

  if (data !== undefined) {
    console.log(`${prefix} ${coloredMessage}`, data);
  } else {
    console.log(`${prefix} ${coloredMessage}`);
  }
}

/**
 * Logger class with convenient methods for different log levels
 */
export class Logger {
  /**
   * Log debug information (white)
   */
  static debug(message: string, data?: any): void {
    log(LogLevel.DEBUG, message, data);
  }

  /**
   * Log general information (cyan)
   */
  static info(message: string, data?: any): void {
    log(LogLevel.INFO, message, data);
  }

  /**
   * Log warnings (yellow)
   */
  static warn(message: string, data?: any): void {
    log(LogLevel.WARN, message, data);
  }

  /**
   * Log errors (red)
   */
  static error(message: string, error?: Error | any): void {
    if (error instanceof Error) {
      log(LogLevel.ERROR, `${message}: ${error.message}`);
      if (error.stack) {
        console.error(colorize(error.stack, LogColor.RED));
      }
    } else if (error) {
      log(LogLevel.ERROR, message, error);
    } else {
      log(LogLevel.ERROR, message);
    }
  }

  /**
   * Log success messages (green)
   */
  static success(message: string, data?: any): void {
    log(LogLevel.SUCCESS, message, data);
  }

  /**
   * Log transaction-specific information
   */
  static transaction(txId: string, status: string, note?: string): void {
    const message = note
      ? `Transaction ${txId} - ${status}: ${note}`
      : `Transaction ${txId} - ${status}`;
    this.info(message);
  }

  /**
   * Log transaction polling status (magenta)
   */
  static polling(txId: string, status: string, note?: string): void {
    const message = note
      ? `Polling tx ${txId}; status: ${status}; ${note}`
      : `Polling tx ${txId}; status: ${status}`;
    console.log(colorize(message, LogColor.MAGENTA));
  }

  /**
   * Log balance information
   */
  static balance(address: string, balance: string, unit: string = "ETH"): void {
    this.info(`Address ${address}: ${balance} ${unit}`);
  }

  /**
   * Log vault information
   */
  static vault(vaultId: string | number, assetId: string, message: string): void {
    this.info(`Vault ${vaultId} [${assetId}]: ${message}`);
  }

  /**
   * Log with custom color
   */
  static custom(message: string, color: LogColor, data?: any): void {
    const coloredMessage = colorize(message, color);
    if (data !== undefined) {
      console.log(coloredMessage, data);
    } else {
      console.log(coloredMessage);
    }
  }

  /**
   * Log error with context information
   */
  static errorWithContext(message: string, context: ErrorContext, error?: Error): void {
    const contextStr = Object.entries(context)
      .map(([key, value]) => `${key}=${value}`)
      .join(", ");

    const fullMessage = `${message} [${contextStr}]`;
    this.error(fullMessage, error);
  }

  /**
   * Log a separator line for visual organization
   */
  static separator(char: string = "-", length: number = 80): void {
    console.log(char.repeat(length));
  }

  /**
   * Log a section header
   */
  static section(title: string): void {
    this.separator("=");
    console.log(colorize(`  ${title}`, LogColor.CYAN));
    this.separator("=");
  }

  /**
   * Set the terminal window title (useful for tracking long-running operations)
   */
  static setWindowTitle(title: string): void {
    process.stdout.write(`\x1b]2;${title}\x07`);
  }
}

/**
 * Legacy compatibility: colorLog function
 * @deprecated Use Logger.custom() instead
 */
export function colorLog(message: string, colorCode: string): string {
  return colorize(message, colorCode);
}

/**
 * Export color codes for direct use
 */
export { LogColor };

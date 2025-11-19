/**
 * Shared type definitions for Fireblocks Raw Client
 *
 * This module provides comprehensive type safety across the application.
 * All interfaces and types are exported for use in other modules.
 */

import { FireblocksSDK, TransactionStatus } from "fireblocks-sdk";
import { Contract } from "web3-eth-contract";

/**
 * Fireblocks API credentials configuration
 */
export interface FireblocksConfig {
  readonly apiKey: string;
  readonly apiSecret: string;
}

/**
 * Parameters for initializing a Web3 instance with Fireblocks integration
 */
export interface Web3InitParams {
  readonly fireblocksApiClient: FireblocksSDK;
  readonly httpProviderUrl: string;
  readonly vaultAccountId: string | number;
  readonly assetId: string;
  readonly tokenName?: string;
  readonly amount: number;
  readonly destAddress: string;
  readonly filename?: string;
  readonly existingTransactionId?: string;
}

/**
 * Parameters for executing a transfer operation
 */
export interface TransferParams {
  readonly fireblocksApiClient: FireblocksSDK;
  readonly ethereumProviderUrl: string;
  readonly sourceVaultAccountId: string | number;
  readonly recipientAddress: string;
  readonly assetIdentifier: string;
  readonly assetSymbol: string;
  readonly transferAmount?: number;
  readonly erc20ContractAddress?: string;
  readonly transactionFilename?: string;
  readonly existingTransactionId?: string;
  readonly destinationVault?: number;
}

/**
 * Parameters for internal vault-to-vault transfers
 */
export interface InternalTransferParams {
  readonly fireblocksApiClient: FireblocksSDK;
  readonly assetId: string;
  readonly amount: number;
  readonly sourceVaultId: string | number;
  readonly destinationVaultId: string | number;
}

/**
 * Parameters for ERC20 token transfers
 */
export interface ERC20TransferParams {
  readonly web3: any; // Web3 instance
  readonly contractAddress: string;
  readonly recipientAddress: string;
  readonly amount: number;
}

/**
 * Parameters for native token transfers (ETH, MATIC, etc.)
 */
export interface NativeTransferParams {
  readonly web3: any; // Web3 instance
  readonly recipientAddress: string;
  readonly amount: number;
}

/**
 * Bitcoin transaction destination
 */
export interface BtcDestination {
  readonly vaultid: string;
  readonly amount: string;
}

/**
 * Bitcoin UTXO (Unspent Transaction Output)
 */
export interface UTXO {
  readonly txHash: string;
  readonly index: number;
  readonly amount?: string;
  readonly address?: string;
}

/**
 * Parameters for signing Bitcoin transactions
 */
export interface BtcTransactionParams {
  readonly fireblocksApi: FireblocksSDK;
  readonly vaultAccountId: string;
  readonly assetId: string;
  readonly destinations: BtcDestination[];
  readonly referenceFilename?: string;
  readonly selectedUTXOs?: UTXO[];
}

/**
 * Transaction polling configuration
 */
export interface PollingConfig {
  readonly intervalMs?: number;
  readonly timeoutMs?: number;
  readonly onStatusChange?: (status: TransactionStatus) => void;
}

/**
 * Transaction polling result
 */
export interface PollingResult {
  readonly finalStatus: TransactionStatus;
  readonly transactionInfo: any;
  readonly cancelled: boolean;
}

/**
 * CSV row data structure
 */
export interface CsvRow {
  [key: string]: string;
}

/**
 * CSV processing configuration
 */
export interface CsvConfig {
  readonly filePath: string;
  readonly skipHeader?: boolean;
  readonly delimiter?: string;
}

/**
 * Gas estimation result
 */
export interface GasEstimate {
  readonly gasLimit: number;
  readonly gasPrice: string;
  readonly estimatedCost: string;
}

/**
 * Balance information
 */
export interface BalanceInfo {
  readonly balance: string;
  readonly balanceInEther: string;
  readonly balanceInWei: string;
}

/**
 * Vault account information
 */
export interface VaultInfo {
  readonly vaultId: string | number;
  readonly assetId: string;
  readonly addresses: string[];
  readonly balance: string;
}

/**
 * ERC20 token contract interface
 */
export interface ERC20Contract extends Contract {
  methods: {
    transfer(recipient: string, amount: any): any;
    balanceOf(address: string): any;
    decimals(): any;
    symbol(): any;
    name(): any;
  };
}

/**
 * CLI argument configuration
 */
export interface CliArguments {
  readonly command?: string;
  readonly args: string[];
  readonly flags: Map<string, string | boolean>;
}

/**
 * Logger color codes
 */
export enum LogColor {
  RED = "31",
  GREEN = "32",
  YELLOW = "33",
  BLUE = "34",
  MAGENTA = "35",
  CYAN = "36",
  WHITE = "37",
}

/**
 * Log level enumeration
 */
export enum LogLevel {
  DEBUG = "DEBUG",
  INFO = "INFO",
  WARN = "WARN",
  ERROR = "ERROR",
  SUCCESS = "SUCCESS",
}

/**
 * Transaction result
 */
export interface TransactionResult {
  readonly id: string;
  readonly status: TransactionStatus;
  readonly txHash?: string;
}

/**
 * Error context for enhanced error messages
 */
export interface ErrorContext {
  readonly operation: string;
  readonly vaultId?: string | number;
  readonly assetId?: string;
  readonly amount?: number;
  readonly txId?: string;
  readonly [key: string]: any;
}

/**
 * Type guard to check if a transaction status is terminal
 */
export function isTerminalStatus(status: TransactionStatus): boolean {
  return (
    status === TransactionStatus.COMPLETED ||
    status === TransactionStatus.FAILED ||
    status === TransactionStatus.BLOCKED ||
    status === TransactionStatus.CANCELLED
  );
}

/**
 * Type guard to check if a transaction status indicates failure
 */
export function isFailedStatus(status: TransactionStatus): boolean {
  return (
    status === TransactionStatus.FAILED ||
    status === TransactionStatus.BLOCKED ||
    status === TransactionStatus.REJECTED
  );
}

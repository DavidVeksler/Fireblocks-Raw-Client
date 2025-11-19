/**
 * Application-wide constants for Fireblocks Raw Client
 *
 * Centralizes all magic numbers, default values, and configuration constants
 * to improve maintainability and prevent inconsistencies.
 */

/**
 * Gas-related constants for EVM transactions
 */
export const GAS = {
  /** Standard gas limit for simple ETH transfers */
  SIMPLE_TRANSFER_LIMIT: 21000,

  /** Gas estimation buffer multiplier (20% safety margin) */
  ESTIMATION_BUFFER: 1.2,

  /** Maximum gas price in gwei to prevent excessive fees */
  MAX_GAS_PRICE_GWEI: 500,
} as const;

/**
 * Transaction polling configuration
 */
export const POLLING = {
  /** Polling interval in milliseconds */
  INTERVAL_MS: 1000,

  /** Maximum polling duration before timeout (10 minutes) */
  TIMEOUT_MS: 600000,

  /** Number of retry attempts for failed polls */
  MAX_RETRIES: 3,
} as const;

/**
 * Balance thresholds for various operations
 */
export const BALANCE_THRESHOLDS = {
  /** Minimum ETH balance for gas operations */
  MIN_ETH_FOR_GAS: 0.0005,

  /** Minimum balance to consider an account active */
  MIN_ACTIVE_BALANCE: 0.0001,

  /** Minimum balance for consolidation operations */
  MIN_CONSOLIDATION_BALANCE: 0.0009,

  /** Warning threshold for large internal transfers (in ETH) */
  LARGE_INTERNAL_TRANSFER_WARNING: 10,
} as const;

/**
 * Ethereum unit conversion helpers
 */
export const ETH_UNITS = {
  /** Wei per Ether (10^18) */
  WEI_PER_ETHER: "1000000000000000000",

  /** Gwei per Ether (10^9) */
  GWEI_PER_ETHER: 1000000000,
} as const;

/**
 * Token decimal places
 */
export const TOKEN_DECIMALS = {
  /** Standard ERC20 decimals */
  STANDARD: 18,

  /** USDC/USDT decimals */
  STABLECOIN: 6,

  /** WBTC decimals */
  WRAPPED_BTC: 8,
} as const;

/**
 * File paths and directories
 */
export const PATHS = {
  /** Fireblocks API secret key location */
  API_SECRET: "../FB_KEY/fireblocks_secret.key",

  /** CSV input directory */
  CSV_INPUT_DIR: "./csv",

  /** Generated scripts output directory */
  GENERATED_SCRIPTS_DIR: "./generated",
} as const;

/**
 * CSV processing configuration
 */
export const CSV = {
  /** Default field separator */
  SEPARATOR: ",",

  /** Line separator */
  LINE_SEPARATOR: "\n",

  /** Default encoding */
  ENCODING: "utf8" as const,
} as const;

/**
 * Network RPC endpoints (examples - should be configured per environment)
 */
export const RPC_ENDPOINTS = {
  ETHEREUM_MAINNET: "https://eth-mainnet.g.alchemy.com/v2/",
  ETHEREUM_SEPOLIA: "https://eth-sepolia.g.alchemy.com/v2/",
  POLYGON_MAINNET: "https://polygon-rpc.com",
  BSC_MAINNET: "https://bsc-dataseed.binance.org",
} as const;

/**
 * Common asset identifiers used by Fireblocks
 */
export const ASSETS = {
  ETH: "ETH",
  ETH_TEST3: "ETH_TEST3",
  MATIC: "MATIC_POLYGON",
  BTC: "BTC",
  USDC: "USDC",
  USDT: "USDT",
} as const;

/**
 * Timeout values for various operations
 */
export const TIMEOUTS = {
  /** API request timeout */
  API_REQUEST_MS: 30000,

  /** Web3 provider timeout */
  WEB3_PROVIDER_MS: 60000,

  /** CSV processing timeout per row */
  CSV_PROCESSING_PER_ROW_MS: 5000,
} as const;

/**
 * Retry configuration for network operations
 */
export const RETRY = {
  /** Maximum number of retry attempts */
  MAX_ATTEMPTS: 3,

  /** Initial backoff delay in milliseconds */
  INITIAL_BACKOFF_MS: 1000,

  /** Backoff multiplier for exponential backoff */
  BACKOFF_MULTIPLIER: 2,
} as const;

/**
 * Validation constraints
 */
export const VALIDATION = {
  /** Minimum transaction amount to prevent dust */
  MIN_TRANSACTION_AMOUNT: 0.000001,

  /** Maximum number of destinations for Bitcoin multi-send */
  MAX_BTC_DESTINATIONS: 100,

  /** Maximum CSV rows to process in one batch */
  MAX_CSV_BATCH_SIZE: 1000,
} as const;

/**
 * Regular expressions for validation
 */
export const REGEX = {
  /** Ethereum address pattern */
  ETH_ADDRESS: /^0x[a-fA-F0-9]{40}$/,

  /** Transaction hash pattern */
  TX_HASH: /^0x[a-fA-F0-9]{64}$/,

  /** Fireblocks transaction ID pattern */
  FIREBLOCKS_TX_ID: /^[a-f0-9-]{36}$/,
} as const;

/**
 * Default values for optional parameters
 */
export const DEFAULTS = {
  /** Default token name for logging */
  TOKEN_NAME: "ETH",

  /** Default filename for transactions */
  TRANSACTION_FILENAME: "transaction",

  /** Default destination vault (0 = external address) */
  DESTINATION_VAULT: 0,

  /** Default transfer amount (0 = full balance) */
  TRANSFER_AMOUNT: 0,
} as const;

/**
 * Error messages
 */
export const ERROR_MESSAGES = {
  INSUFFICIENT_BALANCE: "Insufficient balance for the transfer",
  INVALID_ADDRESS: "Invalid Ethereum address format",
  INVALID_AMOUNT: "Invalid transfer amount",
  NO_VAULT_ADDRESSES: "No account addresses found in vault",
  TRANSACTION_FAILED: "Transaction failed",
  TRANSACTION_CANCELLED: "Transaction was cancelled",
  API_KEY_MISSING: "Fireblocks API key is not configured",
  CONFIG_FILE_MISSING: "Configuration file not found",
} as const;

/**
 * Success messages
 */
export const SUCCESS_MESSAGES = {
  TRANSFER_COMPLETED: "Transfer completed successfully",
  TRANSACTION_CREATED: "Transaction created successfully",
  VAULT_HIDDEN: "Vault account hidden successfully",
  VAULT_UNHIDDEN: "Vault account unhidden successfully",
  TOKEN_ACTIVATED: "Token activated in vault successfully",
} as const;

/**
 * Type-safe constant access
 */
export type GasConstants = typeof GAS;
export type PollingConstants = typeof POLLING;
export type BalanceThresholds = typeof BALANCE_THRESHOLDS;
export type AssetIds = typeof ASSETS;

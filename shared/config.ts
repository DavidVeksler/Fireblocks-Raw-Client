/**
 * Configuration management for Fireblocks Raw Client
 *
 * Provides centralized, type-safe configuration loading with validation
 * and error handling. Replaces the previous EVM/config.ts.
 */

import * as fs from "fs";
import * as path from "path";
import { FireblocksSDK } from "fireblocks-sdk";
import { FireblocksConfig } from "./types";
import { ConfigurationError } from "./errors";
import { Logger } from "./logger";
import { PATHS } from "./constants";

/**
 * Loads Fireblocks API secret from file
 *
 * @param secretPath - Path to the secret key file
 * @returns API secret string
 * @throws {ConfigurationError} If file cannot be read
 */
function loadApiSecret(secretPath: string = PATHS.API_SECRET): string {
  const resolvedPath = path.resolve(secretPath);

  try {
    if (!fs.existsSync(resolvedPath)) {
      throw new ConfigurationError(
        `API secret file not found at: ${resolvedPath}`,
        { secretPath: resolvedPath }
      );
    }

    const secret = fs.readFileSync(resolvedPath, "utf8").trim();

    if (!secret) {
      throw new ConfigurationError(
        `API secret file is empty: ${resolvedPath}`,
        { secretPath: resolvedPath }
      );
    }

    return secret;
  } catch (error) {
    if (error instanceof ConfigurationError) {
      throw error;
    }

    throw new ConfigurationError(
      `Failed to read API secret file: ${error instanceof Error ? error.message : String(error)}`,
      { secretPath: resolvedPath }
    );
  }
}

/**
 * Loads Fireblocks API key from environment or returns empty string
 *
 * @returns API key string
 */
function loadApiKey(): string {
  // First check environment variable
  if (process.env.FIREBLOCKS_API_KEY) {
    return process.env.FIREBLOCKS_API_KEY;
  }

  // Return empty string to maintain backward compatibility
  // Users should set this in their environment or code
  Logger.warn(
    "FIREBLOCKS_API_KEY environment variable not set. " +
    "Please configure your API key."
  );

  return "";
}

/**
 * Loads Fireblocks configuration
 *
 * @param apiKeyOverride - Optional API key to override environment
 * @param secretPathOverride - Optional secret file path to override default
 * @returns Fireblocks configuration object
 * @throws {ConfigurationError} If configuration cannot be loaded
 */
export function loadConfig(
  apiKeyOverride?: string,
  secretPathOverride?: string
): FireblocksConfig {
  const apiSecret = loadApiSecret(secretPathOverride);
  const apiKey = apiKeyOverride || loadApiKey();

  if (!apiKey) {
    Logger.warn(
      "API key is empty. Some operations may fail. " +
      "Set FIREBLOCKS_API_KEY environment variable or provide it explicitly."
    );
  }

  return {
    apiKey,
    apiSecret,
  };
}

/**
 * Creates and initializes a Fireblocks SDK client
 *
 * @param config - Optional configuration object
 * @returns Initialized Fireblocks SDK client
 * @throws {ConfigurationError} If client cannot be initialized
 */
export function createFireblocksClient(config?: FireblocksConfig): FireblocksSDK {
  try {
    const fbConfig = config || loadConfig();

    if (!fbConfig.apiKey) {
      throw new ConfigurationError(
        "API key is required to create Fireblocks client"
      );
    }

    if (!fbConfig.apiSecret) {
      throw new ConfigurationError(
        "API secret is required to create Fireblocks client"
      );
    }

    const client = new FireblocksSDK(fbConfig.apiSecret, fbConfig.apiKey);

    Logger.info("Fireblocks SDK client initialized successfully");

    return client;
  } catch (error) {
    if (error instanceof ConfigurationError) {
      throw error;
    }

    throw new ConfigurationError(
      `Failed to create Fireblocks client: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Validates Fireblocks configuration
 *
 * @param config - Configuration to validate
 * @throws {ConfigurationError} If configuration is invalid
 */
export function validateConfig(config: FireblocksConfig): void {
  if (!config.apiKey || config.apiKey.trim() === "") {
    throw new ConfigurationError("API key is missing or empty");
  }

  if (!config.apiSecret || config.apiSecret.trim() === "") {
    throw new ConfigurationError("API secret is missing or empty");
  }

  // Basic validation of secret format (should look like a private key)
  if (config.apiSecret.length < 100) {
    Logger.warn("API secret seems unusually short. Please verify it's correct.");
  }
}

/**
 * Gets configuration with validation
 *
 * @returns Validated Fireblocks configuration
 * @throws {ConfigurationError} If configuration is invalid
 */
export function getValidatedConfig(): FireblocksConfig {
  const config = loadConfig();
  validateConfig(config);
  return config;
}

/**
 * Legacy compatibility export for existing code
 * @deprecated Use loadConfig() instead
 */
export const apiSecret = loadApiSecret();
export const apiKey = loadApiKey();

/**
 * Legacy compatibility export
 * @deprecated Use createFireblocksClient() instead
 */
export function getFireblocksClient(): FireblocksSDK {
  return createFireblocksClient();
}

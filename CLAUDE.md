# CLAUDE.md - AI Assistant Guide for Fireblocks Raw Client

## Project Overview

**Fireblocks Raw Client** is a TypeScript toolkit for sending raw transactions to Fireblocks to perform operations on unsupported tokens, hidden vaults, and UTXO-based blockchains. This project enables non-custodial transaction signing through the Fireblocks API while maintaining full control over transaction parameters.

**Primary Use Cases:**
- Transferring unsupported ERC20 tokens via raw transactions
- Managing hidden vault accounts
- Bulk asset consolidation and distribution
- Multi-chain gas distribution
- Bitcoin UTXO-based transaction signing
- CSV-driven batch operations
- Fee estimation across multiple chains

---

## Repository Structure

```
Fireblocks-Raw-Client/
├── Bitcoin/                    # Bitcoin/UTXO blockchain utilities
│   ├── bitcoin_raw_signer.ts   # BTC transaction signing and UTXO management
│   └── utxo_test.ts            # Example BTC operations
│
├── EVM/                        # Ethereum and EVM-compatible chain utilities
│   ├── config.ts               # API credentials loader
│   ├── web3_instance.ts        # Web3 + Fireblocks RPC proxy integration
│   ├── transfer.ts             # Core transfer engine (ERC20, native, internal)
│   ├── transaction_details.ts  # Transaction detail fetching
│   ├── example.ts              # Usage template
│   │
│   ├── # Vault Management
│   ├── hide_vault.ts           # Hide/unhide vault accounts
│   ├── unhide_token.ts         # Activate asset contracts in vaults
│   ├── get_vault_balance_all_assets.ts  # Vault inventory
│   │
│   ├── # Transfer Utilities
│   ├── deposit_eth_gas_to_vault.ts      # Bidirectional vault-to-vault ETH
│   ├── transfer_for_gas.ts              # Internal vault transfers with polling
│   ├── deposit_gas_to_many_specified_tokens_and_chains.ts  # Multi-chain gas deposits
│   │
│   ├── # Batch Operations
│   ├── consolidate_unsupported_assets_with_raw_transactions.ts  # Bulk consolidation
│   ├── search_addresses_with_min_balances_from_csv.ts  # Balance checker
│   ├── gas_addresses_with_min_balances_from_csv.ts     # Gas balance checker
│   │
│   ├── # Utilities
│   ├── estimate_tx_fees_for_all_chains.ts  # Fee estimation
│   └── cancel_fireblocks_transaction.ts    # Transaction cancellation
│
├── code-generation/            # CSV to TypeScript code generation
│   ├── generate.ts             # CSV parser and code generator
│   ├── template.ts             # Code generation template
│   └── executeTsScripts.ts     # Batch script executor
│
├── tsconfig.json               # TypeScript compiler configuration
├── package.json                # Dependencies and metadata
├── .gitignore                  # Git ignore rules
├── README.md                   # Project documentation
└── CLAUDE.md                   # This file (AI assistant guide)
```

---

## Core Architecture

### Transaction Flow

```
User Script
    ↓
initWeb3Instance() - Creates Web3 with custom provider
    ↓
Custom RPC Proxy - Intercepts eth_signTransaction
    ↓
Fireblocks SDK - Creates RAW transaction
    ↓
Transaction Polling - Monitors status (COMPLETED/FAILED/BLOCKED)
    ↓
Transaction Signing - Retrieves signature from Fireblocks
    ↓
Serialize & Broadcast - Sends signed transaction to blockchain
```

### Key Components

#### 1. **Web3 Instance with Fireblocks Integration** (`web3_instance.ts`)
- Custom RPC proxy that intercepts `eth_signTransaction` calls
- Routes signing through Fireblocks SDK instead of local keys
- Implements transaction polling with status monitoring
- Automatically handles nonce, gas price, and chain ID
- Colored console logging for visibility
- Automatic cancellation of failed transactions

**Pattern:**
```typescript
const web3 = await initWeb3Instance(
  fireblocksApiClient,
  httpProviderUrl,
  vaultAccountId,
  assetId,
  tokenName,
  amount,
  destAddress,
  filename,
  existingTransactionId // Optional - resume failed transactions
);
```

#### 2. **Transfer Engine** (`transfer.ts`)
- Unified interface for three transfer types:
  - **Native tokens** (ETH, MATIC, BNB, etc.)
  - **ERC20 tokens** (via contract ABI)
  - **Internal transfers** (vault-to-vault)
- Automatic balance validation
- Dynamic gas estimation with 1.2x buffer
- Full balance support (sends max minus gas)
- Token decimal handling

**Pattern:**
```typescript
await transfer(
  fireblocksApiClient,
  ethereumProviderUrl,
  sourceVaultAccountId,
  recipientAddress,
  assetIdentifier,       // e.g., "ETH_TEST3"
  assetSymbol,           // e.g., "ETH"
  transferAmount,        // 0 = send full balance
  erc20ContractAddress,  // undefined for native tokens
  transactionFilename,   // For logging/tracking
  existingTransactionId, // Resume failed tx
  destinationVault       // >0 for internal transfers
);
```

#### 3. **Bitcoin UTXO Signing** (`bitcoin_raw_signer.ts`)
- Retrieves available UTXOs for vault accounts
- Supports multi-destination transactions
- Selective UTXO spending
- Transaction polling until completion

**Pattern:**
```typescript
const utxos = await getAvailableUTXOs(fireblocksApi, vaultId, "BTC");
await signBtcTransaction(
  fireblocksApi,
  vaultId,
  "BTC",
  destinations,         // Array of {vaultid, amount}
  referenceFilename,
  selectedUTXOs         // Optional - specify which UTXOs to spend
);
```

---

## Development Conventions

### TypeScript Configuration
- **Target:** ES2020
- **Module System:** CommonJS
- **Type Checking:** Relaxed (`noImplicitAny: false`, `noImplicitThis: false`)
- **Interop:** ESModule interop enabled
- **Source Maps:** Enabled for debugging

### Code Style Patterns

#### 1. **Colored Console Logging**
Use ANSI color codes for better visibility:
```typescript
console.log(colorLog("Success message", "32")); // Green
console.log(colorLog("Warning message", "33")); // Yellow
console.error(colorLog("Error message", "31")); // Red
console.log(colorLog("Info message", "36"));    // Cyan
console.log(colorLog("Status message", "35"));  // Magenta
```

Or inline:
```typescript
console.log(`\x1b[32mGreen text\x1b[0m`);
console.error(`\x1b[31mRed error text\x1b[0m`);
```

#### 2. **Transaction Polling Pattern**
Always poll until terminal status:
```typescript
let currentStatus = initialStatus;
let txInfo;

while (
  currentStatus !== TransactionStatus.COMPLETED &&
  currentStatus !== TransactionStatus.FAILED &&
  currentStatus !== TransactionStatus.BLOCKED &&
  currentStatus !== TransactionStatus.CANCELLED
) {
  txInfo = await fireblocksApiClient.getTransactionById(txId);
  currentStatus = txInfo.status;
  console.log(colorLog(`Polling tx ${txId}; status: ${currentStatus}`, "35"));
  await new Promise(resolve => setTimeout(resolve, 1000));
}

// Cancel failed transactions automatically
if (
  currentStatus === TransactionStatus.FAILED ||
  currentStatus === TransactionStatus.BLOCKED ||
  currentStatus === TransactionStatus.REJECTED
) {
  await fireblocksApiClient.cancelTransactionById(txId);
  console.log(`Cancelled ID ${txId}`);
}
```

#### 3. **Error Handling**
Always wrap Fireblocks API calls in try-catch:
```typescript
try {
  const result = await fireblocksApiClient.createTransaction(payload);
  console.log("Transaction created:", JSON.stringify(result, null, 2));
  return result;
} catch (error) {
  console.error("Failed to perform operation:", error);
  throw error;
}
```

#### 4. **Balance Checking**
Validate sufficient balance before transfers:
```typescript
const accountBalance = await web3.eth.getBalance(web3.eth.defaultAccount);
if (web3.utils.toBN(transferAmount).gt(accountBalance)) {
  console.error("\x1b[31mERROR: Insufficient balance\x1b[0m");
  return;
}
```

#### 5. **Gas Calculation**
Use dynamic gas estimation with buffer:
```typescript
const estimatedGas = await contract.methods
  .transfer(recipient, amount)
  .estimateGas({ from: web3.eth.defaultAccount });

const gasLimit = Math.floor(estimatedGas * 1.2); // 20% buffer
```

#### 6. **Full Balance Transfers**
Support `amount = 0` to send entire balance:
```typescript
if (amount === 0) {
  const maxSpendableInWei = await web3.eth.getBalance(web3.eth.defaultAccount);
  const gasPrice = await web3.eth.getGasPrice();
  const gasLimit = 21000;
  const gasFee = gasPrice * gasLimit;
  amount = maxSpendableInWei - gasFee;

  if (amount < 0) {
    throw new Error("Insufficient balance for gas");
  }
}
```

---

## Configuration and Secrets

### Fireblocks API Credentials

**Location:** `../FB_KEY/fireblocks_secret.key` (relative to project root)

**Setup:**
```bash
# Create FB_KEY directory at same level as project
mkdir ../FB_KEY

# Copy your Fireblocks secret key
cp /path/to/fireblocks_secret.key ../FB_KEY/

# Update API key in EVM/config.ts
# Replace empty string with your actual API key
```

**config.ts Pattern:**
```typescript
const fs = require('fs');
const path = require('path');

const apiSecretPath = path.resolve("../FB_KEY/fireblocks_secret.key");
const apiSecret = fs.readFileSync(apiSecretPath, "utf8");
const apiKey = "YOUR_API_KEY_HERE"; // Update this!

module.exports = { apiSecret, apiKey };
```

**Note:** Never commit API keys or secrets to version control. The `.gitignore` already excludes `.env` files, but be careful with hardcoded values.

---

## Common Operations

### Running Scripts

All scripts are executed with `ts-node`:

```bash
# Transaction management
ts-node EVM/transaction_details.ts <txId>
ts-node EVM/cancel_fireblocks_transaction.ts <txId>

# Vault operations
ts-node EVM/hide_vault.ts hide <vaultAccountId>
ts-node EVM/hide_vault.ts unhide <vaultAccountId>
ts-node EVM/unhide_token.ts <vaultAccountId> <assetId>
ts-node EVM/get_vault_balance_all_assets.ts <vaultId>

# Transfers
ts-node EVM/transfer_for_gas.ts
ts-node EVM/deposit_eth_gas_to_vault.ts <destinationVault> [revert]
ts-node EVM/deposit_gas_to_many_specified_tokens_and_chains.ts

# Balance checking (requires CSV files)
ts-node EVM/search_addresses_with_min_balances_from_csv.ts
ts-node EVM/gas_addresses_with_min_balances_from_csv.ts

# Asset consolidation
ts-node EVM/consolidate_unsupported_assets_with_raw_transactions.ts

# Fee estimation
ts-node EVM/estimate_tx_fees_for_all_chains.ts

# Code generation
ts-node code-generation/generate.ts [lineNumber]
ts-node code-generation/executeTsScripts.ts

# Bitcoin
ts-node Bitcoin/utxo_test.ts
```

### Creating New Transfer Scripts

**Template Pattern:**
```typescript
import { FireblocksSDK } from "fireblocks-sdk";
import { transfer } from "./transfer";

const { apiSecret, apiKey } = require("./config");

async function main() {
  const fireblocksApiClient = new FireblocksSDK(apiSecret, apiKey);

  await transfer(
    fireblocksApiClient,
    "https://ethereum-rpc-url.com",  // RPC URL
    "0",                              // Source vault ID
    "0xRecipientAddress",             // Destination address
    "ETH_TEST3",                      // Asset identifier
    "ETH",                            // Asset symbol
    0.01,                             // Amount (0 = full balance)
    undefined,                        // ERC20 contract (undefined for native)
    "my-transfer",                    // Transaction filename/reference
    undefined,                        // Existing tx ID (to resume)
    0                                 // Destination vault (0 = external)
  );
}

main()
  .then(() => console.log("Transfer completed"))
  .catch((error) => console.error("Transfer failed:", error));
```

**For ERC20 Transfers:**
```typescript
await transfer(
  fireblocksApiClient,
  "https://polygon-rpc-url.com",
  "5",                                // Source vault
  "0xRecipientAddress",
  "MATIC_POLYGON",
  "USDC",
  100,                                // 100 USDC
  "0xUSDCContractAddress",            // REQUIRED for ERC20
  "usdc-transfer"
);
```

**For Internal Transfers:**
```typescript
await transfer(
  fireblocksApiClient,
  "https://ethereum-rpc-url.com",
  "5",                                // Source vault
  "",                                 // Not used for internal
  "ETH",
  "ETH",
  0.5,
  undefined,
  "internal-transfer",
  undefined,
  10                                  // Destination vault ID
);
```

---

## CSV-Driven Batch Processing

### Code Generation Workflow

The `code-generation/` directory enables creating hundreds of transfer scripts from CSV templates.

**CSV Format:**
```csv
coin,vault,amount,address,rownum,chain
USDC,12,100,0xRecipient1,1,ETH
ETH,15,0.5,0xRecipient2,2,ETH_TEST3
MATIC,20,1000,0xRecipient3,3,POLYGON
```

**Generate Scripts:**
```bash
# Generate all scripts from CSV
ts-node code-generation/generate.ts

# Generate specific line
ts-node code-generation/generate.ts 5

# Execute all generated scripts
ts-node code-generation/executeTsScripts.ts
```

**Template Placeholders:**
- `{coin}` - Cryptocurrency symbol
- `{vault}` - Source vault ID
- `{amount}` - Transfer amount
- `{address}` - Recipient address
- `{contract}` - ERC20 contract address (from mapping CSV)
- `{token}` - Asset symbol (from mapping CSV)
- `{rpcurl}` - RPC endpoint URL (from chain mapping CSV)
- `{chain}` - Asset identifier (e.g., ETH_TEST3)
- `{rownum}` - Row number for filename generation

---

## Supported Blockchains

### EVM-Compatible Chains
The codebase supports 40+ EVM chains including:
- Ethereum (Mainnet, Sepolia, Goerli)
- Polygon
- Binance Smart Chain (BSC)
- Avalanche C-Chain
- Cronos
- Fantom
- Arbitrum
- Optimism
- And others supported by Fireblocks

### UTXO Chains
- Bitcoin (BTC)
- Bitcoin-like chains through Fireblocks

### Asset Support
Common assets referenced in the code:
- Native: ETH, MATIC, BNB, AVAX, CRO, FTM
- Stablecoins: USDC, USDT, DAI, BUSD
- DeFi: LINK, AAVE, UNI, COMP
- Staking: stETH, rETH, cbETH

---

## Key Utilities Reference

### Core Functions

#### `initWeb3Instance()`
**Location:** `EVM/web3_instance.ts`

Creates a Web3 instance with Fireblocks integration.

**Parameters:**
- `fireblocksApiClient` - Initialized FireblocksSDK instance
- `httpProviderUrl` - RPC endpoint URL
- `vaultAccountId` - Source vault ID (string or number)
- `assetId` - Fireblocks asset identifier (e.g., "ETH_TEST3")
- `tokenName` - Display name for logging (e.g., "ETH")
- `amount` - Transfer amount (0 for full balance)
- `destAddress` - Recipient address
- `filename` - Reference/tracking string
- `existingTransactionId` - Optional: resume failed transaction

**Returns:** Configured Web3 instance

**Side Effects:**
- Sets `web3.eth.defaultAccount` to vault's first address
- Logs source address and balance
- Validates vault has addresses for the asset

---

#### `transfer()`
**Location:** `EVM/transfer.ts`

Unified transfer function supporting three modes.

**Parameters:**
- `fireblocksApiClient` - FireblocksSDK instance
- `ethereumProviderUrl` - RPC endpoint
- `sourceVaultAccountId` - Source vault ID
- `recipientAddress` - Destination address (external transfers)
- `assetIdentifier` - Fireblocks asset ID
- `assetSymbol` - Asset symbol for logging
- `transferAmount` - Amount (0 = full balance)
- `erc20ContractAddress` - ERC20 contract (undefined for native)
- `transactionFilename` - Tracking reference
- `existingTransactionId` - Resume transaction
- `destinationVault` - Destination vault ID (0 for external)

**Transfer Modes:**
1. **destinationVault > 0**: Internal vault-to-vault transfer
2. **erc20ContractAddress provided**: ERC20 token transfer
3. **Otherwise**: Native token transfer

---

#### `getAvailableUTXOs()`
**Location:** `Bitcoin/bitcoin_raw_signer.ts`

Retrieves unspent transaction outputs for Bitcoin vaults.

**Parameters:**
- `fireblocksApi` - FireblocksSDK instance
- `vaultAccountId` - Vault ID (string)
- `assetId` - Asset identifier (e.g., "BTC")

**Returns:** Array of UTXO objects

---

#### `signBtcTransaction()`
**Location:** `Bitcoin/bitcoin_raw_signer.ts`

Signs Bitcoin transactions with optional UTXO selection.

**Parameters:**
- `fireblocksApi` - FireblocksSDK instance
- `vaultAccountId` - Source vault ID
- `assetId` - Asset identifier
- `destinations` - Array of `{vaultid: string, amount: string}`
- `referenceFilename` - Tracking reference
- `selectedUTXOs` - Optional: `{txHash: string, index: number}[]`

**Features:**
- Multi-destination support
- Selective UTXO spending
- Automatic transaction polling
- Failed transaction cancellation

---

### Vault Management Functions

#### `hideVaultAccount()` / `unhideVaultAccount()`
**Location:** `EVM/hide_vault.ts`

**Usage:**
```bash
ts-node EVM/hide_vault.ts hide 12
ts-node EVM/hide_vault.ts unhide 12
```

#### `addContractToVault()`
**Location:** `EVM/unhide_token.ts`

Activates ERC20 token contracts in vaults.

**Usage:**
```bash
ts-node EVM/unhide_token.ts 12 MATIC_POLYGON
```

#### `getVaultBalances()`
**Location:** `EVM/get_vault_balance_all_assets.ts`

Lists all assets and addresses in a vault.

**Usage:**
```bash
ts-node EVM/get_vault_balance_all_assets.ts 12
```

---

### Utility Functions

#### `colorLog()`
**Location:** `EVM/web3_instance.ts`

Helper for colored console output.

**Usage:**
```typescript
import { colorLog } from "./web3_instance";

console.log(colorLog("Success!", "32")); // Green
```

**Color Codes:**
- `31` - Red (errors)
- `32` - Green (success)
- `33` - Yellow (warnings)
- `35` - Magenta (status)
- `36` - Cyan (info)

---

## Testing and Debugging

### Testing Transfers

**Recommended workflow:**
1. Start with small amounts on test networks
2. Use `transaction_details.ts` to inspect transaction status
3. Check Fireblocks console for transaction approval
4. Monitor console output for colored status messages

**Resume Failed Transactions:**
```typescript
// If a transaction fails mid-process, get its ID from console output
const existingTxId = "abcd-1234-5678-efgh";

await transfer(
  fireblocksApiClient,
  rpcUrl,
  vaultId,
  recipient,
  assetId,
  symbol,
  amount,
  contractAddress,
  filename,
  existingTxId  // Resume from this transaction
);
```

### Common Issues

**1. "No account addresses found in vault"**
- Vault doesn't have an address for the specified asset
- Solution: Use `unhide_token.ts` to activate the asset

**2. Transaction stuck in polling**
- May require manual approval in Fireblocks console
- Check transaction status with `transaction_details.ts`

**3. Insufficient balance errors**
- For native tokens: Account for gas fees
- For full balance transfers: Use `amount = 0`

**4. API credential errors**
- Verify `../FB_KEY/fireblocks_secret.key` exists
- Update `apiKey` in `EVM/config.ts`

---

## AI Assistant Guidelines

### When Working on This Project

**DO:**
- ✅ Use colored console logging for visibility
- ✅ Implement transaction polling until terminal status
- ✅ Validate balances before transfers
- ✅ Cancel failed/blocked transactions automatically
- ✅ Use dynamic gas estimation with 1.2x buffer
- ✅ Support `amount = 0` for full balance transfers
- ✅ Wrap all Fireblocks API calls in try-catch
- ✅ Add descriptive transaction notes
- ✅ Use `ts-node` for execution
- ✅ Follow existing code patterns and conventions
- ✅ Test on testnets first

**DON'T:**
- ❌ Commit API keys or secrets
- ❌ Skip balance validation
- ❌ Ignore transaction polling
- ❌ Use hardcoded gas limits without estimation
- ❌ Forget error handling
- ❌ Skip transaction status checks
- ❌ Use fixed delays without status polling
- ❌ Modify TypeScript strict settings without discussion

### Code Review Checklist

When reviewing or writing code for this project, verify:

- [ ] API credentials loaded from config, not hardcoded
- [ ] Transaction polling implemented correctly
- [ ] Failed transactions are cancelled
- [ ] Balance validation before transfers
- [ ] Dynamic gas estimation with buffer
- [ ] Colored console output for visibility
- [ ] Error handling with try-catch
- [ ] Transaction notes include relevant details
- [ ] Support for full balance transfers (amount = 0)
- [ ] No secrets committed to git
- [ ] Follows TypeScript conventions (async/await, etc.)
- [ ] Proper type usage where applicable

### Extending the Project

**Adding a new blockchain:**
1. Add RPC endpoint to chain mapping CSV (for code generation)
2. Test with small transfer first
3. Update `estimate_tx_fees_for_all_chains.ts` if needed

**Adding a new utility script:**
1. Follow naming convention: descriptive_snake_case.ts
2. Place in appropriate directory (EVM/ or Bitcoin/)
3. Import shared functions from existing utilities
4. Use colored logging and error handling patterns
5. Add CLI argument parsing if needed
6. Update this CLAUDE.md with usage instructions

**Adding CSV batch operations:**
1. Define CSV format with headers
2. Use `csv-parser` for reading
3. Validate required fields
4. Implement row-by-row processing
5. Add progress logging
6. Handle errors gracefully (continue on row failure)

---

## Dependencies

### Core Dependencies
```json
{
  "fireblocks-sdk": "^5.27.0",      // Fireblocks API client
  "web3": "^4.10.0",                // Ethereum interactions
  "@ethereumjs/tx": "^3.2.1",       // Transaction serialization
  "@ethereumjs/common": "^2.3.1",   // Chain parameters
  "ts-node": "^10.0.0",             // TypeScript execution
  "typescript": "^4.3.4"            // TypeScript compiler
}
```

### Installation
```bash
npm install
```

**Note:** No test suite currently exists. Manual testing on testnets is recommended.

---

## Git Workflow

### Current Branch
```bash
# Working on feature branch
claude/claude-md-mi5ksimdg08ss0k6-01LZfKxeTy5Bnc8cX5pZqHjB
```

### Committing Changes
```bash
# Standard workflow
git add .
git commit -m "feat: add comprehensive CLAUDE.md documentation"
git push -u origin claude/claude-md-mi5ksimdg08ss0k6-01LZfKxeTy5Bnc8cX5pZqHjB
```

### Ignored Files (.gitignore)
- `node_modules/`
- `*.log`
- `.env*` (environment variables)
- `dist/` (build output)
- `*.tsbuildinfo` (TypeScript cache)

**Note:** The `.gitignore` is comprehensive. Always verify sensitive data isn't committed.

---

## Project Metadata

**Author:** David Veksler
**License:** MIT (see LICENSE file)
**Version:** 1.0.0
**Repository:** https://github.com/DavidVeksler/Fireblocks-Raw-Client

---

## Additional Resources

### Fireblocks API Documentation
- [Fireblocks Developer Portal](https://developers.fireblocks.com/)
- [SDK Documentation](https://github.com/fireblocks/fireblocks-sdk-js)
- [API Reference](https://docs.fireblocks.com/api/)

### Web3.js Documentation
- [Web3.js Official Docs](https://web3js.readthedocs.io/)
- [Ethereum JSON-RPC API](https://ethereum.org/en/developers/docs/apis/json-rpc/)

### TypeScript Resources
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [Node.js + TypeScript Best Practices](https://github.com/goldbergyoni/nodebestpractices)

---

## Changelog

### 2025-11-19
- Created comprehensive CLAUDE.md documentation
- Documented all core utilities and patterns
- Added AI assistant guidelines
- Included code examples and workflows

---

## Quick Reference Card

**Most Common Commands:**
```bash
# Create transfer script
ts-node EVM/transfer_for_gas.ts

# Check transaction status
ts-node EVM/transaction_details.ts <txId>

# List vault assets
ts-node EVM/get_vault_balance_all_assets.ts <vaultId>

# Estimate fees
ts-node EVM/estimate_tx_fees_for_all_chains.ts

# Generate batch scripts
ts-node code-generation/generate.ts
```

**Import Patterns:**
```typescript
import { FireblocksSDK } from "fireblocks-sdk";
import { transfer } from "./EVM/transfer";
import { initWeb3Instance } from "./EVM/web3_instance";
const { apiSecret, apiKey } = require("./EVM/config");
```

**Transaction Status Values:**
```typescript
TransactionStatus.COMPLETED   // Success
TransactionStatus.FAILED      // Failed
TransactionStatus.BLOCKED     // Blocked by policy
TransactionStatus.CANCELLED   // Cancelled
TransactionStatus.PENDING_SIGNATURE
TransactionStatus.BROADCASTING
```

---

*This document is maintained for AI assistants working on the Fireblocks Raw Client project. Keep it updated as the codebase evolves.*

# Fireblocks Raw Client

A collection of TypeScript scripts for sending **raw transactions** through the [Fireblocks](https://www.fireblocks.com/) API — for **crypto custody** operations that Fireblocks' UI and standard SDK flows don't natively support. Use it to transact with **unsupported tokens**, manage **hidden vault accounts**, and perform other low-level vault operations on Ethereum/EVM-compatible chains and Bitcoin-like UTXO chains.

## Why this exists

Fireblocks' web console and standard SDK cover most day-to-day custody needs, but there are gaps: a token isn't on Fireblocks' supported-assets list, a vault is hidden and needs to be surfaced, or you need to construct and broadcast a transaction by hand. This repo is a working set of scripts that fill those gaps by talking to the Fireblocks API directly (via [`fireblocks-sdk`](https://www.npmjs.com/package/fireblocks-sdk)) and building raw transactions with [`web3.js`](https://www.npmjs.com/package/web3) (EVM chains) and Fireblocks' UTXO transaction primitives (Bitcoin-like chains).

## What's included

**EVM / Ethereum-compatible chains** (`EVM/`)
- Transfer native assets, ERC-20 tokens, or unsupported tokens via raw transactions (`transfer.ts`)
- Consolidate unsupported assets across vaults using raw transactions (`consolidate_unsupported_assets_with_raw_transactions.ts`)
- Deposit gas (ETH or other native assets) to a vault, or to many vaults/tokens/chains from a CSV (`deposit_eth_gas_to_vault.ts`, `deposit_gas_to_many_specified_tokens_and_chains.ts`)
- Estimate transaction fees across chains (`estimate_tx_fees_for_all_chains.ts`)
- Query all asset balances for a vault (`get_vault_balance_all_assets.ts`)
- Hide/unhide vault accounts and activate (unhide) vault assets/tokens (`hide_vault.ts`, `unhide_token.ts`)
- Cancel a pending Fireblocks transaction (`cancel_fireblocks_transaction.ts`)
- Look up transaction details, search/filter addresses by minimum balance from a CSV (`transaction_details.ts`, `search_addresses_with_min_balances_from_csv.ts`, `gas_addresses_with_min_balances_from_csv.ts`)

**Bitcoin / UTXO chains** (`Bitcoin/`)
- Sign a raw Bitcoin (or Bitcoin-like) transaction for broadcast, including manual UTXO retrieval and selection (`bitcoin_raw_signer.ts`)

**Shared utilities** (`shared/`)
- Centralized config loading, a colored `Logger`, custom error classes, a reusable transaction poller, and input validators — see [`shared/README.md`](shared/README.md) for the full API.

**Code generation** (`code-generation/`)
- Generate one script per row from a CSV of transfers (coin, vault, amount, address, chain) using a template — useful for batch/bulk transfer operations (`generate.ts`).

## Tech stack

- **TypeScript** (via `ts-node`, no build step required)
- [`fireblocks-sdk`](https://www.npmjs.com/package/fireblocks-sdk) — official Fireblocks API client
- [`web3.js`](https://www.npmjs.com/package/web3) and `@ethereumjs/tx` / `@ethereumjs/common` — raw EVM transaction construction and signing support
- Node.js

## Installation

```bash
git clone https://github.com/DavidVeksler/Fireblocks-Raw-Client.git
cd Fireblocks-Raw-Client
npm install
```

## Configuration

These scripts authenticate to Fireblocks using an **API key** and an **API user's private key (secret)**, the same credentials you'd use with any Fireblocks API integration:

1. Place your Fireblocks API secret key file at `../FB_KEY/fireblocks_secret.key` relative to the repo (i.e. a sibling `FB_KEY` directory), or override the path when using `shared/config.ts`.
2. Provide your Fireblocks API key either via the `FIREBLOCKS_API_KEY` environment variable (recommended) or by setting it directly in `EVM/config.ts`.

```bash
export FIREBLOCKS_API_KEY="your-fireblocks-api-key"
```

**Never commit your API secret or key to version control.**

## Usage

Scripts are run directly with `ts-node`, for example:

```bash
# Get all asset balances for a vault
npx ts-node EVM/get_vault_balance_all_assets.ts <vaultId>

# Cancel a pending transaction
npx ts-node EVM/cancel_fireblocks_transaction.ts <txId>

# Unhide/activate a token on a vault
npx ts-node EVM/unhide_token.ts <vaultAccountId> <assetId>

# Sign a raw Bitcoin transaction
npx ts-node Bitcoin/bitcoin_raw_signer.ts
```

Review each script's source before running — most expect vault IDs, asset identifiers, contract addresses, and RPC provider URLs to be set as arguments or edited inline, and several move real funds.

## Documentation

- [`shared/README.md`](shared/README.md) — shared utilities module reference (config, logging, errors, transaction polling, validation)
- [`MIGRATION_GUIDE.md`](MIGRATION_GUIDE.md) — migrating scripts to use the shared utilities module
- [`REFACTORING_README.md`](REFACTORING_README.md) / `REFACTORING_ANALYSIS.md` / `REFACTORING_SUMMARY.md` / `REFACTORING_QUICK_START.md` — in-depth codebase analysis and refactoring roadmap

## Disclaimer

These scripts move real digital assets through a production custody API. They are provided as-is (see [LICENSE](LICENSE)) with no warranty — test against a Fireblocks sandbox/testnet workspace first, and review each script before running it against production vaults.

## License

[MIT](LICENSE) © David Veksler

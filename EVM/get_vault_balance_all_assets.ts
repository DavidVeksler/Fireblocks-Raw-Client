import { FireblocksSDK, VaultAccountResponse } from "fireblocks-sdk";
import Web3 from "web3";

const { apiSecret, apiKey } = require("./config");
const fireblocks = new FireblocksSDK(apiSecret, apiKey);
const web3 = new Web3();

async function getVaultBalances(vaultId: string): Promise<void> {
  try {
    const { id, name, assets } = await fireblocks.getVaultAccountById(vaultId);
    console.log(`Vault ${id} : ${name}`);

    const uniqueAddresses = new Set<string>();

    for (const asset of assets) {
      const { id: assetId, available } = asset;
      console.log(`Asset: ${assetId}, Balance: ${available}`);

      const accountAddresses = await fireblocks.getDepositAddresses(vaultId, assetId);
      if (accountAddresses.length === 0) {
        console.log(`No deposit addresses found for asset ${assetId} in vault ${vaultId}`);
      } else {
        for (const address of accountAddresses) {
          uniqueAddresses.add(address.address);
        }
      }

      if (assetId === "ETH") {
        web3.eth.defaultAccount = accountAddresses[0]?.address;
        console.log(`Source address for ETH: ${web3.eth.defaultAccount}`);
      }
    }

    console.log("Unique deposit addresses:");
    for (const address of uniqueAddresses) {
      console.log(`- ${address}`);
    }
  } catch (error) {
    if (error.response) {
      if (error.response.status === 404) {
        throw new Error(`Vault account ${vaultId} does not exist.`);
      } else {
        throw new Error(`Error retrieving balances for vault ${vaultId}: ${error.response.data?.message || error.message}`);
      }
    } else {
      throw new Error(`Error retrieving balances for vault ${vaultId}: ${error.message}`);
    }
  }
}

async function main() {
  const vaultId = process.argv[2];
  if (!vaultId) {
    console.error("Usage: ts-node vault_balance.ts [vault_id]");
    process.exit(1);
  }

  try {
    await getVaultBalances(vaultId);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

main();
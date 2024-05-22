import { FireblocksSDK, VaultAccountResponse, PeerType } from "fireblocks-sdk";
import Web3 from "web3";
const { apiSecret, apiKey } = require("./config");

const fireblocks = new FireblocksSDK(apiSecret, apiKey);
const web3 = new Web3();

async function estimateERC20TransferFee(assetId, sourceId, destinationId, amount) {
  const payload = {
    assetId: assetId,
    source: {
      type: PeerType.VAULT_ACCOUNT,
      id: sourceId
    },
    destination: {
      type: PeerType.VAULT_ACCOUNT,
      id: destinationId
    },
    amount: amount
  };

  try {
    const estimatedFee = await fireblocks.estimateFeeForTransaction(payload);
    return {
      networkFee: estimatedFee.low.networkFee,
      gasPrice: estimatedFee.low.gasPrice
    };
  } catch (error) {
    // console.error(`Error estimating fee for ${assetId}:`, error);
    return null;
  }
}

async function getTransactionCostsPerChain(assetList: { nativeasset: string; fbid: string; sample_vault_id: string }[]) {
    const uniqueAssets = [...new Set(assetList.map(item => item.fbid))] as string[];
    const transactionCosts: { [key: string]: { networkFee: string; gasPrice: string } } = {};
  
    for (const assetId of uniqueAssets) {
      const assetData = assetList.find(item => item.fbid === assetId);
      const sourceAccountId = assetData.sample_vault_id;
      const destinationAccountId = assetData.sample_vault_id;
      const transferAmount = "1";
  
      try {
        const estimatedFee = await estimateERC20TransferFee(assetId, sourceAccountId, destinationAccountId, transferAmount);
        if (estimatedFee) {
          transactionCosts[assetData.nativeasset] = {
            networkFee: estimatedFee.networkFee,
            gasPrice: estimatedFee.gasPrice
          };
        }
      } catch (error) {
        console.error(`Error estimating fee for ${assetId}:`, error.message);
        // Skip the problematic asset and continue with the next one
      }
    }
  
    return transactionCosts;
  }

// Example usage
const assetList = [
    { nativeasset: "ETH", fbid: "XAUT", sample_vault_id: "2" },
    { nativeasset: "ETH", fbid: "ETH", sample_vault_id: "0" },
    { nativeasset: "ETH", fbid: "BNB_ERC20", sample_vault_id: "25343" },
    { nativeasset: "BNB_BSC", fbid: "MATIC_BSC", sample_vault_id: "1076138" },
    { nativeasset: "AVAX", fbid: "USDC_AVAX", sample_vault_id: "1" },
    { nativeasset: "ETH", fbid: "QNT", sample_vault_id: "5907" },
    { nativeasset: "MATIC_POLYGON", fbid: "LINK_POLYGON", sample_vault_id: "82" },
    { nativeasset: "ETH", fbid: "AGI", sample_vault_id: "20" },
    { nativeasset: "ETH", fbid: "ENJ", sample_vault_id: "20" },
    { nativeasset: "ETH", fbid: "SHIB", sample_vault_id: "20" },
    { nativeasset: "ETH", fbid: "FET", sample_vault_id: "938347" },
    { nativeasset: "ETH", fbid: "HBTC", sample_vault_id: "1" },
    { nativeasset: "BTC", fbid: "BTC", sample_vault_id: "0" },
    { nativeasset: "ETH", fbid: "STETH_ETH", sample_vault_id: "1" },
    { nativeasset: "ETH", fbid: "CBAT", sample_vault_id: "1" },
    { nativeasset: "ETH", fbid: "CETH", sample_vault_id: "1" },
    { nativeasset: "ETH", fbid: "INJ", sample_vault_id: "20" },
    { nativeasset: "ETH", fbid: "NEXO", sample_vault_id: "20" },
    { nativeasset: "ETH", fbid: "AGIX", sample_vault_id: "90095" },
    { nativeasset: "ETH", fbid: "GRT", sample_vault_id: "20" },
    { nativeasset: "ETH", fbid: "CRO", sample_vault_id: "887462" },
    { nativeasset: "ETH", fbid: "LINK", sample_vault_id: "0" },
    { nativeasset: "BNB_BSC", fbid: "FLOKI_BSC", sample_vault_id: "20" },
    { nativeasset: "AVAX", fbid: "AAVE_E_AVAX", sample_vault_id: "1082578" },
    { nativeasset: "ETH", fbid: "ANKR", sample_vault_id: "1" },
    { nativeasset: "ETH", fbid: "COMP", sample_vault_id: "1" },
    { nativeasset: "ETH", fbid: "USDC", sample_vault_id: "1" },
    { nativeasset: "ETH", fbid: "TGBP", sample_vault_id: "1" },
    { nativeasset: "ETH", fbid: "USDT_ERC20", sample_vault_id: "1" },
    { nativeasset: "BNB_BSC", fbid: "DAI_BSC", sample_vault_id: "99594" },
    { nativeasset: "ETH", fbid: "BAT", sample_vault_id: "1" },
    { nativeasset: "ETH", fbid: "SNX", sample_vault_id: "1" },
    { nativeasset: "ETH", fbid: "ZRX", sample_vault_id: "1" },
    { nativeasset: "ETH", fbid: "CHZ", sample_vault_id: "80936" },
    { nativeasset: "ETH", fbid: "UNI", sample_vault_id: "1" },
    { nativeasset: "ETH", fbid: "AAVE", sample_vault_id: "1" },
    { nativeasset: "ETH", fbid: "SAND", sample_vault_id: "882942" },
    { nativeasset: "ETH", fbid: "LRC", sample_vault_id: "20" },
    { nativeasset: "ETH", fbid: "ILV", sample_vault_id: "224154" },
    { nativeasset: "MATIC_POLYGON", fbid: "MATIC", sample_vault_id: "82" }
  ];

getTransactionCostsPerChain(assetList)
  .then(transactionCosts => {
    console.log("Transaction costs per chain:");
    console.log(transactionCosts);
  })
  .catch(error => {
    console.error("Error:", error);
  });
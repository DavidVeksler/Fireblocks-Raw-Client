import { FireblocksSDK } from "fireblocks-sdk";

const { apiSecret, apiKey } = require('../config'); 
const fireblocksApi = new FireblocksSDK(apiSecret, apiKey);
const fireblocks = new FireblocksSDK(apiSecret, apiKey)

// chain: {chain}
const httpProviderURL = '{rpcurl}';
const destinationAddress = '{address}';
const vaultAccountID = '{vault}';
const contractAddress = '{contract}';
const amount = {amount}; //Decimal Number
const tokenName = '{token}';

const assetType = 'ETH'; //Do Not Touch!

transfer(fireblocks, httpProviderURL, vaultAccountID, destinationAddress, assetType, tokenName, amount, contractAddress, {rownum});
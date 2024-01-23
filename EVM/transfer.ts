// Script to make raw transactions for Fireblocks for either ERC20 or platform tokens

import { initWeb3Provider } from "./web3_provider";
import { FireblocksSDK } from "fireblocks-sdk";

const abi = JSON.parse(
  '[{"inputs":[],"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"owner","type":"address"},{"indexed":true,"internalType":"address","name":"spender","type":"address"},{"indexed":false,"internalType":"uint256","name":"value","type":"uint256"}],"name":"Approval","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"previousOwner","type":"address"},{"indexed":true,"internalType":"address","name":"newOwner","type":"address"}],"name":"OwnershipTransferred","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"from","type":"address"},{"indexed":true,"internalType":"address","name":"to","type":"address"},{"indexed":false,"internalType":"uint256","name":"value","type":"uint256"}],"name":"Transfer","type":"event"},{"inputs":[{"internalType":"address","name":"owner","type":"address"},{"internalType":"address","name":"spender","type":"address"}],"name":"allowance","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"approve","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"account","type":"address"}],"name":"balanceOf","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"burn","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"decimals","outputs":[{"internalType":"uint8","name":"","type":"uint8"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"subtractedValue","type":"uint256"}],"name":"decreaseAllowance","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"getOwner","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"addedValue","type":"uint256"}],"name":"increaseAllowance","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"string","name":"name","type":"string"},{"internalType":"string","name":"symbol","type":"string"},{"internalType":"uint8","name":"decimals","type":"uint8"},{"internalType":"uint256","name":"amount","type":"uint256"},{"internalType":"bool","name":"mintable","type":"bool"},{"internalType":"address","name":"owner","type":"address"}],"name":"initialize","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"mint","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"mintable","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"name","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"renounceOwnership","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"symbol","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"totalSupply","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"recipient","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"transfer","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"sender","type":"address"},{"internalType":"address","name":"recipient","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"transferFrom","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"newOwner","type":"address"}],"name":"transferOwnership","outputs":[],"stateMutability":"nonpayable","type":"function"}]'
);

export async function transfer(
  fireblocksApiClient: FireblocksSDK,
  ethereumProviderUrl,
  vaultId,
  recipientAddress,
  assetIdentifier,
  assetSymbol,
  transferAmount = 0, // In token units
  erc20ContractAddress?,
  transactionFilename?
) {
  const web3 = await initWeb3Provider(
    fireblocksApiClient,
    ethereumProviderUrl,
    vaultId,
    assetIdentifier,
    assetSymbol,
    transferAmount,
    recipientAddress,
    transactionFilename
  );

  if (erc20ContractAddress) {
    await handleErc20Transfer(
      web3,
      erc20ContractAddress,
      recipientAddress,
      transferAmount
    );
  } else {
    await handleNativeTokenTransfer(web3, recipientAddress, transferAmount);
  }

  console.log(`Transfer process completed.`);
}

async function handleErc20Transfer(
  web3,
  erc20ContractAddress,
  recipientAddress,
  transferAmount
) {
  const erc20Contract = new web3.eth.Contract(abi, erc20ContractAddress);
  const tokenDecimals = await erc20Contract.methods.decimals().call();
  const accountBalanceInSmallestUnit = await erc20Contract.methods
    .balanceOf(web3.eth.defaultAccount)
    .call();

  console.log(
    `ERC20 contract balance: ${accountBalanceInSmallestUnit} (smallest unit, ${tokenDecimals} decimals)`
  );

  let transferAmountInSmallestUnit = convertToSmallestTokenUnit(
    transferAmount,
    tokenDecimals,
    web3
  );

  if (transferAmountInSmallestUnit > accountBalanceInSmallestUnit) {
    console.error(`\x1b[31mInsufficient balance for the transfer.\x1b[0m`);
    return;
  }

  console.log(
    `Initiating transfer of ${transferAmount} tokens (${transferAmountInSmallestUnit} in smallest unit)`
  );

  const transactionData = erc20Contract.methods
    .transfer(recipientAddress, transferAmountInSmallestUnit)
    .encodeABI();

  const currentGasPrice = web3.utils.toBN(await web3.eth.getGasPrice());
  console.log(`Current gas price: ${currentGasPrice.toString()} wei`);

  const signedTransaction = await web3.eth.signTransaction({
    to: erc20ContractAddress,
    data: transactionData,
    value: web3.utils.toBN("0x00"),
    gasPrice: currentGasPrice,
    gasLimit: 210000, // Adjust as needed
  });

  const transactionReceipt = await web3.eth.sendSignedTransaction(
    signedTransaction.raw || signedTransaction
  );

  console.log(
    `ERC20 transfer completed. Transaction receipt: ${JSON.stringify(
      transactionReceipt
    )}`
  );
  console.log(
    `Transaction Hash: \x1b[32m${transactionReceipt.transactionHashx}\x1b[0m`
  );
}

async function handleNativeTokenTransfer(
  web3,
  recipientAddress,
  transferAmount
) {
  const accountBalanceInWei = web3.utils.toBN(
    await web3.eth.getBalance(web3.eth.defaultAccount)
  );

  const currentGasPrice = web3.utils.toBN(await web3.eth.getGasPrice());
  console.log(`Current gas price: ${currentGasPrice.toString()} wei`);

  if (accountBalanceInWei.isZero()) {
    console.error("\x1b[31mERROR: Account balance is ZERO\x1b[0m");
    return;
  }

  const transferAmountInWei = web3.utils.toWei(
    transferAmount.toString(),
    "ether"
  );
  if (transferAmountInWei.gt(accountBalanceInWei)) {
    console.error(
      "\x1b[31mERROR: Insufficient balance for the transfer\x1b[0m"
    );
    return;
  }

  console.log(`Initiating native token transfer of ${transferAmount} Ether`);

  const signedTransaction = await web3.eth.signTransaction({
    to: recipientAddress,
    value: transferAmountInWei,
    gasPrice: currentGasPrice,
    gasLimit: 21000, // Adjust as needed
  });

  const transactionReceipt = await web3.eth.sendSignedTransaction(
    signedTransaction.raw || signedTransaction
  );

  console.log(
    `Native token transfer completed. Transaction receipt: ${JSON.stringify(
      transactionReceipt
    )}`
  );
  console.log(
    `Transaction Hash: \x1b[32m${transactionReceipt.transactionHashx}\x1b[0m`
  );
}

function convertToSmallestTokenUnit(amount, decimals, web3) {
  // Use web3's toWei function for conversion, which handles decimals properly.
  // Since toWei expects Ether as input and converts it to Wei,
  // we use it here by treating the 'amount' as Ether and 'decimals' as the equivalent of Ether's 18 decimals.
  const amountInWeiEquivalent = web3.utils.toWei(amount.toString(), "ether");
  // Adjust the conversion by the difference in decimals (18 - token's decimals)
  const decimalsDifference = 18 - decimals;
  const amountInSmallestUnit =
    BigInt(amountInWeiEquivalent) / 10n ** BigInt(decimalsDifference);

  return amountInSmallestUnit;
}


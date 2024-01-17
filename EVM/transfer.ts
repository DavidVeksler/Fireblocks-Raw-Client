// Script to make raw transactions for Fireblocks for either ERC20 or platform tokens

import { initWeb3Provider } from "./web3_provider";
import { FireblocksSDK } from "fireblocks-sdk";
// import { abi } from "./abi";

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
  transferAmount = 0,
  erc20ContractAddress?,
  transactionFilename?
) {
  const web3Instance = await initWeb3Provider(
    fireblocksApiClient,
    ethereumProviderUrl,
    vaultId,
    assetIdentifier,
    assetSymbol,
    transferAmount,
    recipientAddress,
    transactionFilename
  );

  let signedTransaction;
  const currentGasPrice = web3Instance.utils.toBN(
    await web3Instance.eth.getGasPrice()
  );
  console.log(`Current gas price (in wei): ${currentGasPrice.toString()}`);

  if (erc20ContractAddress) {
    const erc20Contract = new web3Instance.eth.Contract(
      abi,
      erc20ContractAddress
    );
    const accountBalance = await erc20Contract.methods
      .balanceOf(web3Instance.eth.defaultAccount)
      .call();
    console.log(`ERC20 Contract Balance: ${accountBalance}`);

    let finalTransferAmount = accountBalance; // Default to full balance

    if (transferAmount > 0) {
      const tokenDecimals = await erc20Contract.methods.decimals().call();
      console.log(`Token Decimals: ${tokenDecimals}`);

      const amountInTokenUnits =
        BigInt(Math.floor(transferAmount)) * 10n ** BigInt(tokenDecimals);

      finalTransferAmount =
        accountBalance < amountInTokenUnits
          ? accountBalance
          : web3Instance.utils.toBN(amountInTokenUnits.toString());
      console.log(
        `Calculated transfer amount in token units: ${finalTransferAmount}`
      );
    }

    if (finalTransferAmount == 0) {
      console.log(`Error: The calculated transfer amount is zero.`);
      return;
    }

    const transactionData = erc20Contract.methods
      .transfer(recipientAddress, finalTransferAmount)
      .encodeABI();
    signedTransaction = await web3Instance.eth.signTransaction({
      to: erc20ContractAddress,
      data: transactionData,
      value: web3Instance.utils.toBN("0x00"),
      gasPrice: currentGasPrice,
      gasLimit: 210000,
    });
  } else {
    // Sending native token
    const nativeTransferGasLimit = 21000;
    const accountBalance = web3Instance.utils.toBN(
      await web3Instance.eth.getBalance(web3Instance.eth.defaultAccount)
    );

    if (accountBalance == 0) {
      console.log("ERROR: Account balance is ZERO");
      return;
    }

    const requiredGas = currentGasPrice.mul(
      web3Instance.utils.toBN(nativeTransferGasLimit)
    );
    console.log("requiredGas:" + requiredGas);

    let transactionValue;
    if (transferAmount > 0) {
      const transferAmountInWei = web3Instance.utils.toBN(
        web3Instance.utils.toWei(transferAmount.toString())
      );
      transactionValue = transferAmountInWei.lt(accountBalance)
        ? transferAmountInWei
        : accountBalance;
    } else {
      transactionValue = accountBalance.sub(requiredGas);
    }

    console.log(
      `Native token transfer amount (in wei): \x1b[32m${transactionValue}\x1b[0m`
    );
    if (transactionValue == 0) {
      console.log(`Error: The native token transfer amount is zero.`);
      return;
    }

    signedTransaction = await web3Instance.eth.signTransaction({
      to: recipientAddress,
      value: transactionValue,
      gasPrice: currentGasPrice,
      gasLimit: nativeTransferGasLimit,
    });
  }

  console.log(
    `Signed transaction details: ${JSON.stringify(signedTransaction)}`
  );
  const transactionHash = await web3Instance.eth.sendSignedTransaction(
    signedTransaction.raw || signedTransaction
  );
  console.log(
    `Transaction Hash: \x1b[32m${transactionHash.transactionHash}\x1b[0m`
  );
  console.log(
    `Vault Account ID: ${vaultId}, ERC20 Contract Address: \x1b[32m${erc20ContractAddress}\x1b[0m`
  );
}

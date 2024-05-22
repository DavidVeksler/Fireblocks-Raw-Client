import * as fs from "fs";
import csv from "csv-parser";
import { createObjectCsvWriter } from "csv-writer";
import { initWeb3Instance } from "../src/web3_instance";
import { FireblocksSDK } from "fireblocks-sdk";
import Web3 from "web3";
const { apiSecret, apiKey } = require("./config");
const abiFilePath = "./abi.json";
const abiJson = fs.readFileSync(abiFilePath, "utf-8");
const abi = JSON.parse(abiJson);

interface CryptoData {
  Coin: string;
  Network: string;
  Vaults: string;
  RowNumber: number;
  Balance: string;
}

interface ContractData {
  Coin: string;
  "Token Name": string;
  Contract: string;
}

interface ChainData {
  Network: string;
  RPC: string;
}

interface VaultData {
  Vault: string;
  NativeToken: string;
  Address: string;
  Coin: string;
}

const vaultsNeedingGas: VaultData[] = [];

const unsupportedCsvFilePath = "unsupported.csv";
const contractsCsvFilePath = "../contracts.csv";
const chainsCsvFilePath = "../chains.csv";
const unmatchedCsvFilePath = "unmatched.csv";

let totalRowsProcessed = 0;
let totalRowsMatched = 0;

// Read contracts.csv and store the data in a Map
const contractsMap = new Map<string, ContractData>();
const chainsMap = new Map<string, ChainData>();

const generateLogFilename = () => {
  const timestamp = new Date().toISOString().replace(/[:T]/g, "-").slice(0, -5);
  return `log_${timestamp}.txt`;
};

const logFilename = generateLogFilename();

// Create a CSV writer for unmatched rows
const unmatchedCsvWriter = createObjectCsvWriter({
  path: unmatchedCsvFilePath,
  header: [
    { id: "Coin", title: "Coin" },
    { id: "Network", title: "Network" },
    { id: "Vaults", title: "Vaults" },
    { id: "RowNumber", title: "RowNumber" },
    { id: "Balance", title: "Balance" },
  ],
});

// ------

const processUnsupportedCsv = async () => {
  const unmatchedRows: CryptoData[] = [];
  const matchedRows: Promise<void>[] = [];

  return new Promise<void>((resolve) => {
    fs.createReadStream(unsupportedCsvFilePath)
      .pipe(csv())
      .on("data", async (row: CryptoData) => {
        const contractData = contractsMap.get(row.Coin);
        const chainData = chainsMap.get(row.Network);
        totalRowsProcessed++;

        if (contractData && chainData) {
          matchedRows.push(processMatchedRow(row, contractData, chainData));
          totalRowsMatched++;
        } else {
          unmatchedRows.push({ ...row, Balance: "" });
        }
      })
      .on("end", async () => {
        await Promise.all(matchedRows);

        console.log(
          `Unsupported CSV file processed. Total rows processed: ${totalRowsProcessed}`
        );
        console.log(
          `Total rows matched to both contracts and chains: ${totalRowsMatched}`
        );

        writeUnmatchedRows(unmatchedRows);
        writeVaultsNeedingGas();

        resolve();
      });
  });
};

const processMatchedRow = async (
  row: CryptoData,
  contractData: ContractData,
  chainData: ChainData
) => {
  try {
    const vaultList = row.Vaults.split(",")
      .map((vault) => vault.trim())
      .filter((vault) => /^\d+$/.test(vault));

    let balance = "";

    for (const vault of vaultList) {
      try {
        const { tokenBalance } = await getTokenAndNativeBalance(
            row.Network,
            vault,
            contractData["Token Name"],
            contractData.Contract,
            row.RowNumber,
            row.Coin,
            row.Vaults,
            chainData.RPC
          );

        if (Number(tokenBalance) > 0) {
          balance = tokenBalance;
          break;
        }
      } catch (error) {
        console.error(`Error for Vault ID ${vault}:`, error.message);
      }
    }

    console.log(`Row#: ${row.RowNumber}`);
    console.log(`Coin: ${row.Coin}`);
    console.log(`Network: ${row.Network}`);
    console.log(`Vaults: ${row.Vaults}`);
    console.log(`Token Name: ${contractData["Token Name"]}`);
    console.log(`Contract: ${contractData.Contract}`);
    console.log(`RPC: ${chainData.RPC}`);
    console.log(`Balance: ${balance}`);
    console.log("---");

    const logOutput = `Row#: ${row.RowNumber}\nCoin: ${row.Coin}\nNetwork: ${row.Network}\nVaults: ${row.Vaults}\nToken Name: ${contractData["Token Name"]}\nContract: ${contractData.Contract}\nRPC: ${chainData.RPC}\nBalance: ${balance}\n---\n`;

    fs.appendFileSync(logFilename, logOutput);
  } catch (error) {
    console.log("Error in processMatchedRow: " + error);
  }
};



const writeUnmatchedRows = (unmatchedRows: CryptoData[]) => {
  unmatchedCsvWriter
    .writeRecords(unmatchedRows)
    .then(() =>
      console.log(`Unmatched rows written to ${unmatchedCsvFilePath}`)
    )
    .catch((error) => console.error("Error writing unmatched rows:", error));
};

const writeVaultsNeedingGas = () => {
  console.log("Writing vaults needing gas to vaults_needing_gas.csv");
  const vaultsNeedingGasCsvWriter = createObjectCsvWriter({
    path: "vaults_needing_gas.csv",
    header: [
      { id: "Vault", title: "Vault" },
      { id: "NativeToken", title: "NativeToken" },
      { id: "Address", title: "Address" },
      { id: "Coin", title: "Coin" },
    ],
  });
  vaultsNeedingGasCsvWriter
    .writeRecords(vaultsNeedingGas)
    .then(() => console.log("Vaults needing gas written to CSV"))
    .catch((error) =>
      console.error("Error writing vaults needing gas:", error)
    );
};

const getTokenAndNativeBalance = async (
    network: string,
    vault: string,
    tokenName: string,
    contract: string,
    rowNumber: number,
    coin: string,
    vaults: string,
    rpc: string
): Promise<{ tokenBalance: string; nativeBalance: string }> => {
  const fireblocksApiClient = new FireblocksSDK(apiSecret, apiKey);

  const chainData = chainsMap.get(network);
 

  const web3 =await initWeb3Instance(
      fireblocksApiClient,
      chainData.RPC,
      vault,
      "ETH",
      tokenName,
      0,
      "0xDb31651967684A40A05c4aB8Ec56FC32f060998d",
      rowNumber
    );
     
  const erc20Contract = new web3.eth.Contract(abi, contract);
  const tokenDecimals = await erc20Contract.methods.decimals().call();
  const accountBalanceInSmallestUnit = await erc20Contract.methods
    .balanceOf(web3.eth.defaultAccount)
    .call();
  const tokenBalance =
    Number(accountBalanceInSmallestUnit) / 10 ** tokenDecimals;

  const nativeBalance = await web3.eth.getBalance(web3.eth.defaultAccount);
  const nativeBalanceInEther = parseFloat(
    web3.utils.fromWei(nativeBalance, "ether")
  );

  const minimumGasBalance = 0.0005;

  if (tokenBalance > 0.01 && nativeBalanceInEther > minimumGasBalance) {
    // Add a 1-second pause before sending the transaction
    await new Promise((resolve) => setTimeout(resolve, 1000));

    await handleErc20Transfer(
        web3,
        contract,
        "0xDb31651967684A40A05c4aB8Ec56FC32f060998d",
        tokenBalance,
        rowNumber,
        coin,
        network,
        vaults,
        tokenName,
        rpc
      );
  } else if (nativeBalanceInEther <= minimumGasBalance) {
    console.error(
      `\\x1b[31mERROR: Insufficient native balance for the transfer. Native balance: ${nativeBalanceInEther} ETH\\x1b[0m`
    );
    if (tokenBalance > 0.09) {
      vaultsNeedingGas.push({
        Vault: vault,
        NativeToken: network,
        Address: web3.eth.defaultAccount,
        Coin: tokenName,
      });
    }
  }

  return {
    tokenBalance: tokenBalance.toString(),
    nativeBalance: nativeBalanceInEther.toString(),
  };
};

const handleErc20Transfer = async (
    web3,
    erc20ContractAddress: string,
    recipientAddress: string,
    transferAmount: number,
    rowNumber: number,
    coin: string,
    network: string,
    vaults: string,
    tokenName: string,
    rpc: string
  ) => {
  try {
    const erc20Contract = new web3.eth.Contract(abi, erc20ContractAddress);    
    const transferAmountInSmallestUnit = await erc20Contract.methods
      .balanceOf(web3.eth.defaultAccount)
      .call();
    console.log(
      `ERC20 contract balance: ${web3.utils.fromWei(
        transferAmountInSmallestUnit.toString(),
        "ether"
      )}`
    );

    console.log(
      `Initiating transfer of the full balance (${transferAmountInSmallestUnit} in smallest unit)`
    );

    const transactionData = erc20Contract.methods
      .transfer(recipientAddress, transferAmountInSmallestUnit)
      .encodeABI();
    const currentGasPrice = web3.utils.toBN(await web3.eth.getGasPrice());
    console.log(`Current gas price: ${currentGasPrice.toString()} wei`);

    const estimatedGas = await erc20Contract.methods
      .transfer(recipientAddress, transferAmountInSmallestUnit)
      .estimateGas({ from: web3.eth.defaultAccount });
    console.log(`Estimated Gas: ${estimatedGas}`);

    const signedTransactionData = {
      to: erc20ContractAddress,
      data: transactionData,
      value: web3.utils.toBN("0x00"),
      gasPrice: currentGasPrice,
      gasLimit: Math.floor(estimatedGas * 1.2),
    };

    

    const signedTransaction = await web3.eth.signTransaction(
      signedTransactionData
    );   

    var tx_values = {       
        rowNumber,
        coin,
        network,
        vaults,
        tokenName,
        rpc,
        signedTransactionData,
        signedTransaction
      }

    fs.appendFileSync(
      "signed_transaction_data.log",
      `${JSON.stringify(tx_values, null, 2)}\n`
    );

    const transactionReceipt = await web3.eth.sendSignedTransaction(
        signedTransaction.raw || signedTransaction
    );

    console.log(
      `ERC20 transfer completed. Transaction receipt: ${JSON.stringify(
        tx_values
      )}`
    );
    console.log(
      `Transaction Hash: \\x1b[32m${transactionReceipt.transactionHash}\\x1b[0m`
    );

    // Log the transaction details to transactions.log
    const transactionDetails = {
      rowNumber: rowNumber,
      rpc: rpc,
      transactionHash: transactionReceipt.transactionHash,
      from: transactionReceipt.from,
      to: transactionReceipt.to,
      value: transferAmount,
      gasUsed: transactionReceipt.gasUsed,
      blockNumber: transactionReceipt.blockNumber,
    };
    const transactionLog = `Transaction Details:\n${JSON.stringify(
      transactionDetails,
      null,
      2
    )}\n`;
    fs.appendFileSync("transactions.log", transactionLog);
  } catch (error) {
    console.error("Error in handleErc20Transfer:", error);
    fs.appendFileSync(
      "transfer_exceptions.log",
      `${rowNumber}\n${tokenName}\n${error.message}\n${error.stack}\n`
    );
  }
};

const initializeData = () => {
  fs.createReadStream(contractsCsvFilePath)
    .pipe(csv())
    .on("data", (row: ContractData) => {
      contractsMap.set(row.Coin, row);
    })
    .on("end", () => {
      console.log("Contracts CSV file processed.");

      fs.createReadStream(chainsCsvFilePath)
        .pipe(csv())
        .on("data", (row: ChainData) => {
          chainsMap.set(row.Network, row);
        })
        .on("end", async () => {
          console.log("Chains CSV file processed.");

          if (fs.existsSync(unmatchedCsvFilePath)) {
            fs.unlinkSync(unmatchedCsvFilePath);
          }

          await processUnsupportedCsv();
        });
    });
};

initializeData();

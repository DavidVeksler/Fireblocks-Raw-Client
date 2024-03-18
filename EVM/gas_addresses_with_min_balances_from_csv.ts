import Web3 from 'web3';
import fs from 'fs';
import csv from 'csv-parser';

class EthereumAddressBalanceChecker {
  private web3: Web3;
  private csvFilePath: string;
  private minBalance: number;

  constructor(web3Provider: string, csvFilePath: string, minBalance = 0.0001) {
    this.web3 = new Web3(web3Provider);
    this.csvFilePath = csvFilePath;
    this.minBalance = minBalance;
  }

  async getAddressesWithBalance(): Promise<{ address: string, balance: string }[]> {
    const addressesWithBalance: { address: string, balance: string }[] = [];

    return new Promise((resolve, reject) => {
      fs.createReadStream(this.csvFilePath)
        .pipe(csv())
        .on('data', async (data: { address: string }) => {
          const address = data.address;
          try {
            // console.log(address);
            // throw 'todo';
            const balance = await this.web3.eth.getBalance(address);
            const balanceInEth = this.web3.utils.fromWei(balance, 'ether');            

            if (parseFloat(balanceInEth) > this.minBalance) {              
              addressesWithBalance.push({ address, balance: balanceInEth })
              console.log(address," - " + balanceInEth);
            }
          } catch (error) {
            console.error(`Failed to retrieve balance for address ${address}:`, error);
          }
        })
        .on('end', () => {
          resolve(addressesWithBalance);
        })
        .on('error', (error) => {
          reject(error);
        });
    });
  }
}

export default EthereumAddressBalanceChecker;

module.exports = EthereumAddressBalanceChecker;


const web3Provider = 'https://rpc.flashbots.net';
const csvFilePath = '/Users/davidveksler/Projects/coin-retrievals/ETH/eth_addresses.csv';
const minBalance = 0.0001; // Optional: set a different minimum balance threshold

const checker = new EthereumAddressBalanceChecker(web3Provider, csvFilePath, minBalance);

checker.getAddressesWithBalance()
  .then((addressesWithBalance) => {
    console.log('Addresses with balance over the threshold:', addressesWithBalance);
  })
  .catch((error) => {
    console.error('An error occurred:', error);
  });
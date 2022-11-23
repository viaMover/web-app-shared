import { convertToString } from 'web-app-shared/helpers/bigmath';
import { ERC20_ABI } from 'web-app-shared/references/abi';
import { TransactionsParams } from 'web-app-shared/services/onchain/types';
import Web3 from 'web3';
import { AbiItem } from 'web3-utils';

export const currentBalance = async (
  web3: Web3,
  accountAddress: string,
  assetAddress: string
): Promise<string> => {
  const transactionParams = {
    from: accountAddress
  } as TransactionsParams;

  const contract = new web3.eth.Contract(ERC20_ABI as AbiItem[], assetAddress);

  const balanceOf = await contract.methods.balanceOf(accountAddress).call(transactionParams);

  return convertToString(balanceOf);
};

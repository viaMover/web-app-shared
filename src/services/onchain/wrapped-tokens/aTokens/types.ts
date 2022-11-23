import { ContractMethod, CustomContractType } from 'web-app-shared/services/onchain/types';

export type AAVEPoolContract = CustomContractType<{
  withdraw(tokenAddress: string, amount: string, addressTo: string): ContractMethod;
}>;

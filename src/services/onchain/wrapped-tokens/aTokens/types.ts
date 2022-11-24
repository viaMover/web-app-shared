import { ContractMethod, CustomContractType } from '../../types';

export type AAVEPoolContract = CustomContractType<{
  withdraw(tokenAddress: string, amount: string, addressTo: string): ContractMethod;
}>;

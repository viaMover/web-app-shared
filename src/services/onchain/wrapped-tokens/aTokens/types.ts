import { ContractMethod, CustomContractType } from '@/services/onchain/types';

export type AAVEPoolContract = CustomContractType<{
  withdraw(tokenAddress: string, amount: string, addressTo: string): ContractMethod;
}>;

import { ContractMethod, CustomContractType } from '@/services/onchain/types';

export type gALCXContract = CustomContractType<{
  unstake(amount: string): ContractMethod;
  exchangeRate(): ContractMethod<string>;
}>;

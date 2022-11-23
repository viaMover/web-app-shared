import { ContractMethod, CustomContractType } from 'web-app-shared/services/onchain/types';

export type gALCXContract = CustomContractType<{
  unstake(amount: string): ContractMethod;
  exchangeRate(): ContractMethod<string>;
}>;

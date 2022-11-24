import { ContractMethod, CustomContractType } from '../../types';

export type gALCXContract = CustomContractType<{
  unstake(amount: string): ContractMethod;
  exchangeRate(): ContractMethod<string>;
}>;

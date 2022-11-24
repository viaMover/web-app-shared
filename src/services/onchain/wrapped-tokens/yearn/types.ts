import { ContractMethod, CustomContractType } from '../../types';

export type YearnVaultContract = CustomContractType<{
  withdraw(amount: string): ContractMethod;
  pricePerShare(): ContractMethod<string>;
}>;

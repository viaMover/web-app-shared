import { ContractMethod, CustomContractType } from 'web-app-shared/services/onchain/types';

export type YearnVaultContract = CustomContractType<{
  withdraw(amount: string): ContractMethod;
  pricePerShare(): ContractMethod<string>;
}>;

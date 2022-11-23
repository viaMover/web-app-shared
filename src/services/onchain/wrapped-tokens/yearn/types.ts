import { ContractMethod, CustomContractType } from '@/services/onchain/types';

export type YearnVaultContract = CustomContractType<{
  withdraw(amount: string): ContractMethod;
  pricePerShare(): ContractMethod<string>;
}>;

import { ContractMethod, CustomContractType } from 'web-app-shared/services/onchain/types';

export type SavingsPlusPoolContract = CustomContractType<{
  getDepositBalance(accountAddress: string): ContractMethod<string>;
}>;

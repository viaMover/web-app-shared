import { ContractMethod, CustomContractType } from '@/services/onchain/types';

export type SavingsPlusPoolContract = CustomContractType<{
  getDepositBalance(accountAddress: string): ContractMethod<string>;
}>;

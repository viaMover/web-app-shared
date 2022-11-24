import { ContractMethod, CustomContractType } from '../../types';

export type SavingsPlusPoolContract = CustomContractType<{
  getDepositBalance(accountAddress: string): ContractMethod<string>;
}>;

import { ContractMethod, CustomContractType } from 'web-app-shared/services/onchain/types';

export type dCULTContract = CustomContractType<{
  withdraw(pid: string, amount: string): ContractMethod;
}>;

import { ContractMethod, CustomContractType } from '@/services/onchain/types';

export type dCULTContract = CustomContractType<{
  withdraw(pid: string, amount: string): ContractMethod;
}>;

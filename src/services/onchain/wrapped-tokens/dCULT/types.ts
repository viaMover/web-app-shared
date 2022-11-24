import { ContractMethod, CustomContractType } from '../../types';

export type dCULTContract = CustomContractType<{
  withdraw(pid: string, amount: string): ContractMethod;
}>;

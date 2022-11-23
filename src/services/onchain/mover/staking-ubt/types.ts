import { ContractMethod, CustomContractType } from '@/services/onchain/types';

export type StakingContract = CustomContractType<{
  deposit(_amount: string): ContractMethod;
  withdraw(_amount: string): ContractMethod;
  getDepositBalance(_owner: string): ContractMethod<string>;
  getDailyAPY(): ContractMethod<string>;
}>;

import { ContractMethod, CustomContractType } from 'web-app-shared/services/onchain/types';

export type OlympusStakingContract = CustomContractType<{
  unstake(_to: string, _amount: string, _trigger: boolean, _rebasing: boolean): ContractMethod;
}>;

export type gOHMContract = CustomContractType<{
  balanceFrom(_amount: string): ContractMethod<string>;
  balanceTo(_amount: string): ContractMethod<string>;
}>;

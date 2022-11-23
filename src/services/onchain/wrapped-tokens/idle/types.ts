import { ContractMethod, CustomContractType } from '@/services/onchain/types';

export type IdleContract = CustomContractType<{
  redeemIdleToken(amount: string): ContractMethod;
  tokenPriceWithFee(accountAddress: string): ContractMethod<string>;
}>;

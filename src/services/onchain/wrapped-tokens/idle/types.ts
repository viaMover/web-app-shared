import { ContractMethod, CustomContractType } from 'web-app-shared/services/onchain/types';

export type IdleContract = CustomContractType<{
  redeemIdleToken(amount: string): ContractMethod;
  tokenPriceWithFee(accountAddress: string): ContractMethod<string>;
}>;

import { ContractMethod, CustomContractType } from '../../types';

export type IdleContract = CustomContractType<{
  redeemIdleToken(amount: string): ContractMethod;
  tokenPriceWithFee(accountAddress: string): ContractMethod<string>;
}>;

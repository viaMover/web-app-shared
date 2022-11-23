import { ContractMethod, CustomContractType } from 'web-app-shared/services/onchain/types';

export type WxBTRFLYContract = CustomContractType<{
  unwrapToBTRFLY(amount: string): ContractMethod;
  realIndex(): ContractMethod<string>;
}>;

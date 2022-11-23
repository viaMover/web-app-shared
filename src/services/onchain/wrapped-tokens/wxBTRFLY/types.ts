import { ContractMethod, CustomContractType } from '@/services/onchain/types';

export type WxBTRFLYContract = CustomContractType<{
  unwrapToBTRFLY(amount: string): ContractMethod;
  realIndex(): ContractMethod<string>;
}>;

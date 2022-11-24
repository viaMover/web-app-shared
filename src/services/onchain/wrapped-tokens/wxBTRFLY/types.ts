import { ContractMethod, CustomContractType } from '../../types';

export type WxBTRFLYContract = CustomContractType<{
  unwrapToBTRFLY(amount: string): ContractMethod;
  realIndex(): ContractMethod<string>;
}>;

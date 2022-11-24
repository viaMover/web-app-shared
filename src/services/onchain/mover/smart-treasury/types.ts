import { ContractMethod, CustomContractType } from '../../types';

export type SmartTreasuryContract = CustomContractType<{
  userInfoMove(address: string): ContractMethod<{
    0: string;
    1: string;
    amount: string;
    rewardTally: string;
  }>;
  userInfoMoveEthLP(address: string): ContractMethod<{
    0: string;
    1: string;
    amount: string;
    rewardTally: string;
  }>;
  totalBonus(_account: string): ContractMethod<string>;
  getDPYPerMoveToken(): ContractMethod<string>;
  maxBurnAmount(): ContractMethod<string>;
  getBurnValue(_account: string, _amount: string): ContractMethod<string>;
  totalStakedMove(): ContractMethod<string>;
  totalStakedMoveEthLP(): ContractMethod<string>;
  withdraw(_tokenMoveAmount: string, _tokenMoveEthAmount: string): ContractMethod;
  claimUSDCforBonus(): ContractMethod;
}>;

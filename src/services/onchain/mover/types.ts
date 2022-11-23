import { ContractMethod, CustomContractType } from '../types';

export type TransferProxyContract = CustomContractType<{
  depositToPool(
    _poolAddress: string,
    _tokenFrom: string,
    _amount: string,
    _expectedMinimumReceived: string,
    _bytes: Array<number>
  ): ContractMethod;
  withdrawFromPool(_poolAddress: string, _amount: string): ContractMethod;
  depositToTreasury(_tokenMoveAmount: string, _tokenMoveEthAmount: string): ContractMethod;
  claimAndBurn(_amount: string): ContractMethod;
  executeSwap(
    _tokenFrom: string,
    _tokenTo: string,
    _amountFrom: string,
    _expectedMinimumReceived: string,
    _convertData: number[]
  ): ContractMethod;
  bridgeAsset(
    _token: string,
    _amount: string,
    _bridgeTxData: number[],
    _relayTarget: string
  ): ContractMethod;
  // l2 variant
  swapBridgeAsset(
    _tokenFrom: string,
    _tokenTo: string,
    _amountFrom: string,
    _expectedMinimumReceived: string,
    _convertData: number[],
    _bridgeTxData: number[],
    _relayTarget: string
  ): ContractMethod;
  // mainnet variant
  swapBridgeAsset(
    _tokenFrom: string,
    _tokenTo: string,
    _amountFrom: string,
    _expectedMinimumReceived: string,
    _convertData: number[],
    _bridgeTxData: number[],
    _relayTarget: string,
    // difference between stable and bridged amounts as a lower bound
    _minToMint: string,
    // minimum amount after bridge
    _minDy: string
  ): ContractMethod;
  cardTopUp(
    _accountAddress: string,
    _inputCurrencyAddress: string,
    _inputAmountInWEI: string,
    _expectedMinimumReceived: string,
    _bytesData: number[]
  ): ContractMethod;
}>;

export type TopUpProxyContract = CustomContractType<{
  CardTopupPermit(
    _inputCurrencyAddress: string,
    _inputAmountInWEI: string,
    _permitCallData: Buffer,
    _expectedMinimumReceived: string,
    _convertData: number[],
    _bridgeType: number,
    _bridgeTxData: Buffer,
    _receiverHash: Buffer
  ): ContractMethod;
  CardTopupMPTProof(
    _inputCurrencyAddress: string,
    _inputAmountInWEI: string,
    _blockNumber: number,
    _proofBlob: Buffer,
    _expectedMinimumReceived: string,
    _convertData: number[],
    _bridgeType: number,
    _bridgeTxData: Buffer,
    _receiverHash: Buffer
  ): ContractMethod;
  CardTopupTrusted(
    _inputCurrencyAddress: string,
    _inputAmountInWEI: string,
    _timestamp: number,
    _signature: Buffer,
    _expectedMinimumReceived: string,
    _convertData: number[],
    _bridgeType: number,
    _bridgeTxData: Buffer,
    _receiverHash: Buffer
  ): ContractMethod;
}>;

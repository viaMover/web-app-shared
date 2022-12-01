import { ContractMethod, CustomContractType } from '../../types';

export type BridgeDataResponse = {
  BridgeData: Buffer;
  BridgeFeeInPercents: string;
};

export type UnwrapEstimationData = {
  UnwrappedTokenAddress: string;
  UnwrappedAmountInWei: string;
};

export type TopUpProxyContract = CustomContractType<{
  // l2 version
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
  // eth mainnet version
  CardTopupPermit(
    _inputCurrencyAddress: string,
    _inputAmountInWEI: string,
    _permitCallData: Buffer,
    _expectedMinimumReceived: string,
    _convertData: number[],
    _receiverHash: Buffer
  ): ContractMethod;
  // l2 version
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
  // eth mainnet version
  CardTopupMPTProof(
    _inputCurrencyAddress: string,
    _inputAmountInWEI: string,
    _blockNumber: number,
    _proofBlob: Buffer,
    _expectedMinimumReceived: string,
    _convertData: number[],
    _receiverHash: Buffer
  ): ContractMethod;
  // l2 version
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
  // eth mainnet version
  CardTopupTrusted(
    _inputCurrencyAddress: string,
    _inputAmountInWEI: string,
    _timestamp: number,
    _signature: Buffer,
    _expectedMinimumReceived: string,
    _convertData: number[],
    _receiverHash: Buffer
  ): ContractMethod;
  unwrapSupported(address: string): ContractMethod<boolean>;
  estimateUnwrap(address: string, _amount: string): ContractMethod<[string, string]>;
}>;

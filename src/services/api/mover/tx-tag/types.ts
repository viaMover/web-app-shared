import { Network } from '../../../../references/network';
import { Token } from '../../../../references/tokens';

export type GetTagTopUpCodeRequest = {
  tag: string;
};

export type GetTagTopUpCodeResponse = {
  topupHash: string;
};

export type GetIncomingTopUpEventAPIResponse = {
  addressFrom: string;
  chainID: number;
  amount: string;
  txHash: string;
  token: string;
};

export type MoverTopUpInputEventFromService = {
  from: string;
  network: Network;
  amountInWei: string;
  hash: string;
  originalAssetAddress: string;
};

export type MoverTopUpInputEvent = {
  from: string;
  network: Network;
  amountInWei: string;
  hash: string;
  originalAsset: Token;
};

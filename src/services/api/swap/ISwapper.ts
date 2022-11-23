import { Network } from 'web-app-shared/references/network';

import { TransferData } from './types';

export interface ISwapper {
  getName(): string;

  getTransferData(
    buyTokenAddress: string,
    sellTokenAddress: string,
    rawAmount: string,
    slippage: string,
    isInputAmount: boolean,
    fromAddress?: string
  ): Promise<TransferData>;

  isBuyAmountAvailable(): boolean;

  canHandle(network: Network): boolean;
}

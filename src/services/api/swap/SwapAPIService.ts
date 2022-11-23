import { addSentryBreadcrumb } from 'web-app-shared/logs/sentry';
import { Network } from 'web-app-shared/references/network';
import { ZeroXAPIService } from 'web-app-shared/services/api/swap/0x/ZeroXAPIService';
import { OneInchAPIService } from 'web-app-shared/services/api/swap/1inch/OneInchAPIService';
import { ISwapper } from 'web-app-shared/services/api/swap/ISwapper';
import { NetworkFeatureNotSupportedError } from 'web-app-shared/services/NetworkFeatureNotSupportedError';

import { TransferData } from './types';

export class SwapAPIService {
  private sentryCategoryPrefix = 'swap.api.service';

  private executors = new Array<ISwapper>();

  constructor(private readonly currentAddress: string, private readonly network: Network) {
    this.executors.push(new ZeroXAPIService(this.network));
    this.executors.push(new OneInchAPIService(this.network));
  }

  public getNetwork(): Network {
    return this.network;
  }

  public isBuyAmountAvailable(): boolean {
    const executor = this.executors.find((s) => s.canHandle(this.network));
    if (executor === undefined) {
      addSentryBreadcrumb({
        type: 'error',
        category: this.sentryCategoryPrefix,
        message: 'Failed to find suitable swap executor',
        data: { network: this.network }
      });
      throw new NetworkFeatureNotSupportedError('Swaps', this.network);
    }
    return executor.isBuyAmountAvailable();
  }

  public async getTransferData(
    buyTokenAddress: string,
    sellTokenAddress: string,
    rawAmount: string,
    isInputAmount: boolean,
    slippage: string,
    fromAddress: string
  ): Promise<TransferData> {
    const executor = this.executors.find((s) => s.canHandle(this.network));
    if (executor === undefined) {
      addSentryBreadcrumb({
        type: 'error',
        category: this.sentryCategoryPrefix,
        message: 'Failed to find suitable swap executor',
        data: { network: this.network }
      });
      throw new NetworkFeatureNotSupportedError('Swaps', this.network);
    }

    addSentryBreadcrumb({
      type: 'debug',
      category: this.sentryCategoryPrefix,
      message: 'Using concrete swap executor',
      data: { name: executor.getName() }
    });

    return executor.getTransferData(
      buyTokenAddress,
      sellTokenAddress,
      rawAmount,
      slippage,
      isInputAmount,
      fromAddress
    );
  }
}

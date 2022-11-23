import Web3 from 'web3';

import { Network } from '@/references/network';
import { PreparedAction } from '@/services/onchain/mover/subsidized/types';
import { OnChainService } from '@/services/onchain/OnChainService';

export class SubsidizedTransactionsOnChainService extends OnChainService {
  constructor(
    sentryCategoryPrefix: string,
    currentAddress: string,
    network: Network,
    web3Client: Web3
  ) {
    super(`${sentryCategoryPrefix}.subsidized`, currentAddress, network, web3Client);
  }

  public async prepareSubsidizedAction(actionString: string): Promise<PreparedAction> {
    return {
      actionString,
      signature: await this.signActionString(actionString)
    };
  }

  protected async signActionString(actionString: string): Promise<string> {
    return this.wrapWithSentryLogger(async () => {
      return this.web3Client.eth.personal.sign(actionString, this.currentAddress, '');
    });
  }
}

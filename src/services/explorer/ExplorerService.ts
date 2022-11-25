import { MoverAssetsService } from '../api/mover/assets/MoverAPIAssetsService';
import { Service } from '../Service';
import { WalletTokens } from './types';

export class ExplorerService extends Service {
  protected readonly currentAccount: string;
  protected readonly confirmSignature: string;
  protected readonly assetsService: MoverAssetsService;

  constructor(assetsService: MoverAssetsService, currentAccount: string, confirmSignature: string) {
    super('explorer');
    this.currentAccount = currentAccount;
    this.confirmSignature = confirmSignature;
    this.assetsService = assetsService;
  }

  public getTokens = async (): Promise<WalletTokens> => {
    return await this.assetsService.getMultiChainWalletTokens(
      this.currentAccount,
      this.confirmSignature
    );
  };
}

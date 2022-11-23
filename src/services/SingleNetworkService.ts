import { Network } from 'web-app-shared/references/network';
import { Service } from 'web-app-shared/services/Service';

export abstract class SingleNetworkService extends Service {
  public readonly network: Network;

  protected constructor(network: Network, sentryCategoryPrefix: string) {
    super(sentryCategoryPrefix);
    this.network = network;
  }
}

import { Network } from '../references/network';
import { Service } from './Service';

export abstract class SingleNetworkService extends Service {
  public readonly network: Network;

  protected constructor(network: Network, sentryCategoryPrefix: string) {
    super(sentryCategoryPrefix);
    this.network = network;
  }
}

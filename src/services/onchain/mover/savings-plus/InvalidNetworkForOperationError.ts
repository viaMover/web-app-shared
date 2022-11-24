import { Network } from '../../../../references/network';
import { OnChainServiceError } from '../../OnChainServiceError';

export class InvalidNetworkForOperationError extends OnChainServiceError {
  protected payload: { fromNetwork: Network; toNetwork: Network };

  constructor(currentNetwork: Network, targetNetwork: Network) {
    super(
      `Operation is planned on ${targetNetwork} but current network is ${currentNetwork}. Network change before action is required`
    );
    this.payload = {
      fromNetwork: currentNetwork,
      toNetwork: targetNetwork
    };
  }

  public getNetworkTo(): Network {
    return this.payload.toNetwork;
  }
}

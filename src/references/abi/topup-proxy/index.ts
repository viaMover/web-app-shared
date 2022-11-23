import { Network } from 'web-app-shared/references/network';
import { MoverError } from 'web-app-shared/services/MoverError';
import { AbiItem } from 'web3-utils';

import arbitrum from './arbitrum.json';
import ethereum from './ethereum.json';
import optimism from './optimism.json';
import polygon from './polygon.json';

const references = {
  [Network.ethereum]: ethereum,
  [Network.polygon]: polygon,
  [Network.arbitrum]: arbitrum,
  [Network.optimism]: optimism
} as Record<Network, Array<AbiItem>>;

export const getTopUpProxyAbi = (network: Network): AbiItem[] => {
  const abi = references[network];
  if (abi === undefined) {
    throw new MoverError('Unsupported network in `getHardenedTopUpProxyAbi`', {
      network
    });
  }
  return abi;
};

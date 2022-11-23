import { Network } from 'web-app-shared/references/network';
import { MoverError } from 'web-app-shared/services/MoverError';
import { AbiItem } from 'web3-utils';

import arbitrum from './arbitrum.json';
import avalanche from './avalanche.json';
import binance from './binance.json';
import fantom from './fantom.json';
import mainnet from './mainnet.json';
import optimism from './optimism.json';
import polygon from './polygon.json';

const references = {
  [Network.ethereum]: mainnet,
  [Network.fantom]: fantom,
  [Network.polygon]: polygon,
  [Network.avalanche]: avalanche,
  [Network.binance]: binance,
  [Network.arbitrum]: arbitrum,
  [Network.optimism]: optimism
} as Record<Network, Array<AbiItem>>;

export const getCentralTransferProxyAbi = (network: Network): AbiItem[] => {
  const abi = references[network];
  if (abi === undefined) {
    throw new MoverError(`Cant get Central Transfer Proxy ABI for ${network}`);
  }
  return references[network] ?? references[Network.ethereum];
};

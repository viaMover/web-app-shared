import { sameAddress } from '@/helpers/addresses';
import { DefaultAddress, NetworkAddresses } from '@/references/addresses';
import { getUBTAssetData, getUSDCAssetData } from '@/references/assets';
import { DefaultSlippage, networkConstants } from '@/references/constants';
import { Network } from '@/references/network';
import { AvailableNetworks, networks } from '@/references/networks';
import { Token } from '@/references/tokens';
import { AddressMapKey, ConstantsMap, NetworkInfo } from '@/references/types';

export const getNetworkByChainId = (chainId: number): NetworkInfo | undefined => {
  return (Object.values(networks) as Array<NetworkInfo>).find((n) => n.chainId === chainId);
};

export const getNetwork = (network: Network): NetworkInfo => {
  return networks[network];
};

export const getBaseAssetData = (network: Network): Token => {
  return getNetwork(network).baseAsset;
};

export const getNetworkConstant = <N extends Network, K extends keyof ConstantsMap[N]>(
  network: N,
  key: K
): ConstantsMap[N][K] | undefined => {
  return networkConstants[network]?.[key];
};

export const getNetworkAddress = <K extends AddressMapKey, N extends Network>(
  network: N,
  key: K
): string => {
  return NetworkAddresses[network]?.[key] ?? DefaultAddress;
};

export const isDefaultAddress = (address?: string | null): boolean => {
  return address === DefaultAddress;
};

export const isUSDCAsset = (address: string): boolean => {
  return (
    AvailableNetworks.find((net) => sameAddress(address, getUSDCAssetData(net).address)) !==
    undefined
  );
};

export const isUBTAsset = (address: string): boolean => {
  return (
    AvailableNetworks.find((net) => sameAddress(address, getUBTAssetData(net).address)) !==
    undefined
  );
};

export const isBaseAsset = (addr: string): boolean => {
  return (
    AvailableNetworks.find((n) => sameAddress(getBaseAssetData(n).address, addr)) !== undefined
  );
};

export const isBaseAssetByNetwork = (addr: string, network: Network): boolean => {
  return sameAddress(getBaseAssetData(network).address, addr);
};

export const getSavingsPlusDecimals = (): number => 6;

export const getSlippage = (
  tokenAddress: string,
  network: Network,
  defaultValue?: string
): string => {
  const customSlippages = getNetworkConstant(network, 'CUSTOM_TOKEN_SLIPPAGE');
  return customSlippages?.get(tokenAddress.toLowerCase()) ?? defaultValue ?? DefaultSlippage;
};

import { BridgeType } from 'web-app-shared/references/bridge';
import { Network } from 'web-app-shared/references/network';
import { Token } from 'web-app-shared/references/tokens';

export type AddressMapKey =
  | 'MOVE_ADDRESS'
  | 'MOBO_ADDRESS'
  | 'TRANSFER_PROXY_ADDRESS'
  | 'TOP_UP_PROXY_ADDRESS'
  | 'SMART_TREASURY_ADDRESS'
  | 'SUSHI_TOKEN_ADDRESS'
  | 'SUSHISWAP_MOVE_WETH_POOL_ADDRESS'
  | 'OHM_ADDRESS'
  | 'USDC_TOKEN_ADDRESS'
  | 'WETH_TOKEN_ADDRESS'
  | 'BTRFLY_TOKEN_ADDRESS'
  | 'WX_BTRFLY_TOKEN_ADDRESS'
  | 'UBT_TOKEN_ADDRESS'
  | 'STAKING_UBT_CONTRACT_ADDRESS'
  | 'ALCX_TOKEN_ADDRESS'
  | 'GALCX_TOKEN_ADDRESS'
  | 'CULT_TOKEN_ADDRESS'
  | 'DCULT_TOKEN_ADDRESS'
  | 'SAVINGS_PLUS_POOL_ADDRESS'
  | 'EXCHANGE_PROXY_ADDRESS'
  | 'TOP_UP_EXCHANGE_PROXY_ADDRESS'
  | 'AAVE_LANDING_POOL_V3_ADDRESS'
  | 'AAVE_LANDING_POOL_V2_ADDRESS'
  | 'ACROSS_ADDRESS'
  | 'GOHM_TOKEN_ADDRESS'
  | 'OLYMPUS_STAKING_ADDRESS'
  | 'OHM_V2_TOKEN_ADDRESS';

type AddressMapNetworkEntry = Readonly<Record<AddressMapKey, string>>;
export type AddressMap = Readonly<Record<Network, AddressMapNetworkEntry>>;

type ConstantsMapNetworkEntry = Readonly<{
  MASTER_CHEF_POOL_INDEX: number;
  POWERCARD_RARI_ID: number;
  ORDER_OF_LIBERTY_DEFAULT_PRICE: string;
  ORDER_OF_LIBERTY_AVAILABLE_PRICES: Array<string>;
  SUBSIDIZED_WALLET_ADDRESSES: Array<string>;
  CUSTOM_TOKEN_SLIPPAGE: Map<string, string>;
  USDC_SPECIFIC_DECIMALS: number;
  BRIDGE_TYPE: BridgeType;
}>;
export type ConstantsMap = Readonly<Record<Network, ConstantsMapNetworkEntry>>;

export type NetworkInfo = {
  network: Network;
  name: string;
  chainId: number;
  explorer: string;
  subsidizedUrl?: string;
  baseAsset: Token;
  rpcUrl: string[];
  iconURL: string;
  displayedName: string;
};

export type NetworkInfoMap = Record<Network, NetworkInfo>;

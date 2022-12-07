import { Network } from '../../../../references/network';
import { Token } from '../../../../references/tokens';

export type CheckUnwrapTokenResponse = {
  isUnwrapSupported: boolean;
  tokenAddressAfterUnwrap: string | undefined;
  tokenAmountAfterUnwrapInWei: string | undefined;
};

export type CheckUnwrapTokenResult = {
  isUnwrapSupported: boolean;
  tokenAddressAfterUnwrap: string | undefined;
  tokenAmountAfterUnwrapInWei: string | undefined;
};

export type CheckAndGetUnwrapTokenResponse = {
  isUnwrapSupported: boolean;
  token: AssetData;
};

export type CheckAndGetUnwrapTokenResult = {
  isUnwrapSupported: boolean;
  token: Token;
};

export type AssetData = {
  address: string;
  decimals: number;
  symbol: string;
  name: string;
  logoUrl: string;
  network: Network;
  hasPermit: boolean;
  permitType?: string;
  permitVersion?: string;
};

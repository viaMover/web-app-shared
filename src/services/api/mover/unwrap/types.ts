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
  token: Token;
};

export type CheckAndGetUnwrapTokenResult = {
  isUnwrapSupported: boolean;
  token: Token;
};

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

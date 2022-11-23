export type ReserveTagPayload = {
  data: {
    name: string;
    address: string;
    timestamp: number;
  };
  meta: {
    address: string;
    sig: string;
  };
};

export type ReserveTagResponse = {
  name: string;
  sig: string;
  position: number;
};

export type LookupTagResponse = {
  name: string;
  sig: string;
  avatarSrc: string;
  position: number;
};

export type SetAvatarResponse = {
  publicLink: string;
};

export type AvailableTagResponse = {
  ok: 'ok';
};

export enum ErrorCode {
  TagNotFound = 'NOT_FOUND',
  TagNotResolved = 'NOT FOUND',
  TagAlreadyInUse = 'CONFLICT',
  TagValidationLengthTooBig = 'LENGTH_TOO_BIG',
  TagValidationLengthTooSmall = 'LENGTH_TOO_SMALL',
  TagValidationContainsInvalidCharacters = 'CONTAINS_INVALID_CHARACTERS'
}

export type SaveEmailPayload = {
  email: string;
};

export type SaveEmailResponse = {
  email: string;
};

export type TagAvailability = 'AVAILABLE' | 'INVALID' | 'ALREADY_IN_USE';

export type ApprovedWalletsListItem = {
  address: string;
  addedAt: number;
};
export type ApprovedWalletsList = Array<ApprovedWalletsListItem>;

export type ApprovedWalletsListResponse = Array<{
  address: string;
  tsCreated: number;
}>;

export type AddApprovedWalletReturn = {
  timestamp: number;
};

export type ResolveTagAPIResponse = {
  avatarSrc?: string;
};

export type ResolveTagResponse = {
  found: boolean;
  avatarSrc?: string;
};

export type GetTagPublicDataForTopUpAPIResponse = {
  avatarSrc?: string;
  topUpSent: number;
};

export type GetTagPublicDataForTopUpResponse = {
  found: boolean;
  avatarSrc?: string;
  topUpSent: number;
};

export type TagsAmountResponse = {
  amount: number;
};

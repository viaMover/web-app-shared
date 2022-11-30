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

export type LookupAvatarResponse = {
  avatarSrc: string | undefined;
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
  TagValidationContainsInvalidCharacters = 'CONTAINS_INVALID_CHARACTERS',
  WrongCode = 'WRONG_CODE',
  AlreadyHasCard = 'ALREADY_HAS_A_CARD',
  NoCard = 'NO_CARD'
}

export type SaveEmailPayload = {
  email: string;
};

export type SaveEmailResponse = {
  email: string;
};

export type TagAvailability = 'AVAILABLE' | 'INVALID' | 'ALREADY_IN_USE';

export type ApprovedWalletsListItemType = 'approved_for_topup' | 'approved_for_control';
export type ApprovedWalletsListItemStatus = 'approved' | 'not_approved' | 'rejected';

export type ApprovedWalletsListItem = {
  address: string;
  addedAt: number;
  type: ApprovedWalletsListItemType;
  status: ApprovedWalletsListItemStatus;
};
export type ApprovedWalletsList = Array<ApprovedWalletsListItem>;

export type IncomingControlEvent = {
  cardUID: string;
  cardLastNumbers: string;
  address: string;
};

export type IncomingControlEventResponse = {
  oldestRequest: IncomingControlEvent | undefined;
};

export type ApproveIncomingControlEventPayload = {
  cardUID: string;
  code: string;
};

export type DeclineIncomingControlEventPayload = {
  cardUID: string;
};

export type ApprovedWalletsListResponse = Array<{
  address: string;
  tsCreated: number;
  type: ApprovedWalletsListItemType;
  status: ApprovedWalletsListItemStatus;
}>;

export type AddApprovedWalletReturn = {
  timestamp: number;
};

export type AddControlWalletReturn = {
  code: string;
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

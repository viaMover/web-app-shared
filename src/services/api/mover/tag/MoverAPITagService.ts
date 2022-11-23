import axios, { AxiosInstance } from 'axios';
import dayjs from 'dayjs';
import Web3 from 'web3';

import { addSentryBreadcrumb } from '@/logs/sentry';
import { getEndpoint } from '@/references/endpoints';
import { MoverAPIError } from '@/services/api/mover/MoverAPIError';
import { MoverAPIService } from '@/services/api/mover/MoverAPIService';
import {
  AddApprovedWalletReturn,
  ApprovedWalletsList,
  ApprovedWalletsListResponse,
  ErrorCode,
  GetTagPublicDataForTopUpAPIResponse,
  GetTagPublicDataForTopUpResponse,
  ResolveTagAPIResponse,
  ResolveTagResponse,
  SetAvatarResponse,
  TagsAmountResponse
} from '@/services/api/mover/tag/types';
import { MoverAPISuccessfulResponse } from '@/services/api/mover/types';
import { EECode, ExpectedError } from '@/services/ExpectedError';
import { MoverError } from '@/services/MoverError';
import { isRejectedRequestError } from '@/services/onchain/ProviderRPCError';

import {
  LookupTagResponse,
  ReserveTagPayload,
  ReserveTagResponse,
  SaveEmailPayload,
  SaveEmailResponse,
  TagAvailability
} from './types';

export class MoverAPITagService extends MoverAPIService {
  protected baseURL: string;

  protected readonly client: AxiosInstance;

  constructor() {
    super('tag.api.service');
    this.baseURL = this.lookupBaseURL();
    this.client = this.applyAxiosInterceptors(
      axios.create({
        baseURL: this.baseURL
      })
    );
  }

  public async saveEmail(email: string): Promise<void> {
    const payload: SaveEmailPayload = {
      email
    };

    await this.client.post<MoverAPISuccessfulResponse<SaveEmailResponse>>(
      '/tag/notify/email',
      payload
    );
  }

  public async setAvatar(
    tag: string,
    imageBlob: Blob,
    fileName: string | undefined,
    address: string,
    confirmationSignature: string
  ): Promise<string> {
    const form = new FormData();
    form.append('image', imageBlob, fileName);
    try {
      return (
        await this.client.post<MoverAPISuccessfulResponse<SetAvatarResponse>>(
          `/private/avatar`,
          form,
          {
            headers: this.getAuthHeaders(address, confirmationSignature)
          }
        )
      ).data.payload.publicLink;
    } catch (error) {
      addSentryBreadcrumb({
        type: 'error',
        message: 'Failed to upload avatar',
        data: {
          error,
          tag,
          address,
          confirmationSignature
        }
      });
      throw error;
    }
  }

  public async checkTagAvailability(tag: string): Promise<TagAvailability> {
    try {
      await this.client.get<MoverAPISuccessfulResponse<LookupTagResponse>>(`/tag/${tag}/available`);
      return 'AVAILABLE';
    } catch (error: any) {
      if (error instanceof MoverAPIError) {
        if (error.shortMessage === ErrorCode.TagAlreadyInUse) {
          return 'ALREADY_IN_USE';
        }

        if (
          [
            ErrorCode.TagValidationLengthTooBig,
            ErrorCode.TagValidationLengthTooSmall,
            ErrorCode.TagValidationContainsInvalidCharacters
          ].find((el) => el.length === error.shortMessage) !== undefined
        ) {
          return 'INVALID';
        }
        throw new MoverError('API Error handled during `checkTagAvailability`', error.payload);
      }

      addSentryBreadcrumb({
        type: 'error',
        category: this.sentryCategoryPrefix,
        message: 'Unexpected API Error handled during `checkTagAvailability`',
        data: {
          error: error
        }
      });

      throw new MoverError('Unexpected API Error handled during `checkTagAvailability`');
    }
  }

  public async reserveTag(
    currentAddress: string,
    tag: string,
    signFunction: (data: object) => Promise<string>
  ): Promise<ReserveTagResponse> {
    const dataToSign = {
      name: tag,
      address: currentAddress,
      timestamp: dayjs().unix()
    };

    let signature = '';
    try {
      signature = await signFunction(dataToSign);
    } catch (error) {
      if (isRejectedRequestError(error)) {
        throw new ExpectedError(EECode.userRejectSign);
      }
      addSentryBreadcrumb({
        type: 'error',
        message: 'error during signing tag',
        data: {
          currentAddress,
          error
        }
      });
      throw new MoverAPIError("Can't delete approve wallet due to sign error");
    }

    const payload: ReserveTagPayload = {
      data: dataToSign,
      meta: {
        address: currentAddress,
        sig: signature
      }
    };
    return (await this.client.post<MoverAPISuccessfulResponse<ReserveTagResponse>>('/tag', payload))
      .data.payload;
  }

  public async lookupTag(
    address: string,
    confirmationSignature: string
  ): Promise<LookupTagResponse | undefined> {
    try {
      return (
        await this.client.get<MoverAPISuccessfulResponse<LookupTagResponse>>(`/private/tag`, {
          headers: this.getAuthHeaders(address, confirmationSignature)
        })
      ).data.payload;
    } catch (error) {
      if (error instanceof MoverAPIError && error.shortMessage === ErrorCode.TagNotFound) {
        return undefined;
      }

      throw error;
    }
  }

  public async getApprovedWallets(
    tag: string,
    address: string,
    confirmationSignature: string
  ): Promise<ApprovedWalletsList> {
    return (
      await this.client.get<MoverAPISuccessfulResponse<ApprovedWalletsListResponse>>(
        `/private/approved-wallets`,
        {
          headers: this.getAuthHeaders(address, confirmationSignature)
        }
      )
    ).data.payload.map((w) => ({
      address: w.address,
      addedAt: w.tsCreated
    }));
  }

  public async addApprovedWallet(
    approvedWalletAddress: string,
    currentAddress: string,
    confirmationSignature: string,
    web3: Web3
  ): Promise<AddApprovedWalletReturn> {
    const timestamp = dayjs().unix();
    const msgToSign = `I confirm the affiliation and or ownership of the ${approvedWalletAddress} address. Top up requests from the above mentioned wallet can proceed automatically without additional authorization. ${timestamp}`;
    let signature = '';
    try {
      signature = await web3.eth.personal.sign(msgToSign, currentAddress, '');
    } catch (error) {
      if (isRejectedRequestError(error)) {
        throw new ExpectedError(EECode.userRejectSign);
      }
      addSentryBreadcrumb({
        type: 'error',
        message: 'error during signing approve wallet additional message',
        data: {
          approvedWalletAddress,
          timestamp,
          currentAddress,
          error
        }
      });
      throw new MoverAPIError("Can't add approve wallet due to sign error");
    }
    await this.client.put(
      `/private/approved-wallet`,
      {
        address: approvedWalletAddress,
        timestamp: timestamp,
        sig: signature
      },
      {
        headers: this.getAuthHeaders(currentAddress, confirmationSignature)
      }
    );

    return {
      timestamp: timestamp
    };
  }

  public async deleteApprovedWallet(
    approvedWalletAddress: string,
    currentAddress: string,
    confirmationSignature: string,
    web3: Web3
  ): Promise<void> {
    const timestamp = dayjs().unix();
    const dataToSign = {
      subject: 'remove_tag_sender',
      address: approvedWalletAddress,
      timestamp: timestamp
    };
    let signature = '';
    try {
      signature = await web3.eth.personal.sign(JSON.stringify(dataToSign), currentAddress, '');
    } catch (error) {
      if (isRejectedRequestError(error)) {
        throw new ExpectedError(EECode.userRejectSign);
      }
      addSentryBreadcrumb({
        type: 'error',
        message: 'error during signing approve wallet removal message',
        data: {
          approvedWalletAddress,
          timestamp,
          currentAddress,
          error
        }
      });
      throw new MoverAPIError("Can't delete approve wallet due to sign error");
    }

    await this.client.delete(`/private/approved-wallet`, {
      data: {
        data: dataToSign,
        meta: {
          sig: signature
        }
      },
      headers: this.getAuthHeaders(currentAddress, confirmationSignature)
    });
  }

  public async getTagPublicDataForTopUp(
    tag: string,
    currentAddress: string,
    confirmationSignature: string,
    abortSignal?: AbortSignal
  ): Promise<GetTagPublicDataForTopUpResponse> {
    try {
      const data = (
        await this.client.get<MoverAPISuccessfulResponse<GetTagPublicDataForTopUpAPIResponse>>(
          `/private/tag/${encodeURIComponent(tag)}/fortopup`,
          {
            signal: abortSignal,
            headers: this.getAuthHeaders(currentAddress, confirmationSignature)
          }
        )
      ).data.payload;

      return {
        found: true,
        avatarSrc: data.avatarSrc,
        topUpSent: data.topUpSent
      };
    } catch (error) {
      if (
        error instanceof MoverAPIError &&
        (ErrorCode.TagNotFound === error.shortMessage ||
          ErrorCode.TagNotResolved === error.shortMessage)
      ) {
        return {
          found: false,
          topUpSent: 0
        };
      }

      throw error;
    }
  }

  public async resolveTag(tag: string, abortSignal?: AbortSignal): Promise<ResolveTagResponse> {
    try {
      const data = (
        await this.client.get<MoverAPISuccessfulResponse<ResolveTagAPIResponse>>(
          `/tag/${encodeURIComponent(tag)}/public`,
          {
            signal: abortSignal
          }
        )
      ).data.payload;

      return {
        found: true,
        avatarSrc: data.avatarSrc
      };
    } catch (error) {
      if (
        error instanceof MoverAPIError &&
        (ErrorCode.TagNotFound === error.shortMessage ||
          ErrorCode.TagNotResolved === error.shortMessage)
      ) {
        return {
          found: false
        };
      }

      throw error;
    }
  }

  public async getTagsAmount(): Promise<TagsAmountResponse> {
    return (await this.client.get<MoverAPISuccessfulResponse<TagsAmountResponse>>(`/tags`)).data
      .payload;
  }

  protected lookupBaseURL(): string {
    return getEndpoint('API_TAG_SERVICE_URL');
  }
}

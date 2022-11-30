import dayjs from 'dayjs';
import Web3 from 'web3';

import { addSentryBreadcrumb } from '../../../../logs/sentry';
import { EECode, ExpectedError } from '../../../ExpectedError';
import { isRejectedRequestError } from '../../../onchain/ProviderRPCError';
import { MoverAPIError } from '../MoverAPIError';
import { MoverAPITagService } from './MoverAPITagService';
import {
  AddApprovedWalletReturn,
  ApprovedWalletsList,
  GetTagPublicDataForTopUpResponse,
  IncomingControlEvent,
  ResolveTagResponse,
  TagsAmountResponse
} from './types';
import { LookupTagResponse, ReserveTagResponse, TagAvailability } from './types';

export class MoverAPITagServiceMock extends MoverAPITagService {
  constructor(baseURL: string) {
    super(baseURL);
  }

  public async saveEmail(): Promise<void> {
    return;
  }

  public async setAvatar(): Promise<string> {
    return 'https://storage.googleapis.com/mover-user-data/production/avatars/238ce4fb-a0fa-4940-98ac-94545d696a2e.jpg';
  }

  public async checkTagAvailability(): Promise<TagAvailability> {
    return 'AVAILABLE';
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
      throw new MoverAPIError("Can't reserve tag due to sign error");
    }

    return { name: tag, sig: signature, position: 123 };
  }

  public async lookupTag(): Promise<LookupTagResponse | undefined> {
    return undefined;
  }

  public async lookupAvatarByAddress(): Promise<string | undefined> {
    return undefined;
  }

  public async getApprovedWallets(): Promise<ApprovedWalletsList> {
    return [
      {
        address: '0xtestMock',
        addedAt: dayjs().unix(),
        type: 'approved_for_control',
        status: 'approved'
      },
      {
        address: '0xtestMock2',
        addedAt: dayjs().unix(),
        type: 'approved_for_control',
        status: 'approved'
      }
    ];
  }

  public async getIncomingControlEvent(): Promise<IncomingControlEvent> {
    return {
      cardUID: '1111',
      cardLastNumbers: '1234',
      address: '0xF2f5C73fa04406b1995e397B55c24aB1f3eA726C'
    };
  }

  public async approveIncomingControlEvent(): Promise<void> {
    //nothing
  }

  public async declineIncomingControlEvent(): Promise<void> {
    // nothing
  }

  public async addTopupWallet(
    approvedWalletAddress: string,
    currentAddress: string,
    confirmationSignature: string,
    web3: Web3
  ): Promise<AddApprovedWalletReturn> {
    const timestamp = dayjs().unix();
    const msgToSign = `I confirm the affiliation and or ownership of the ${approvedWalletAddress} address. Top up requests from the above mentioned wallet can proceed automatically without additional authorization. ${timestamp}`;
    try {
      await web3.eth.personal.sign(msgToSign, currentAddress, '');
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

    return {
      timestamp: timestamp
    };
  }

  public async addControlWallet(
    controlWalletAddress: string,
    currentAddress: string,
    confirmationSignature: string,
    web3: Web3
  ): Promise<string> {
    const timestamp = dayjs().unix();
    const msgToSign = `I ${controlWalletAddress} address. ${timestamp} TODO-TODO-TODO-TODO-TODO-TODO-TODO-TODO-TODO-TODO-TODO-TODO-TODO`;
    try {
      await web3.eth.personal.sign(msgToSign, currentAddress, '');
    } catch (error) {
      if (isRejectedRequestError(error)) {
        throw new ExpectedError(EECode.userRejectSign);
      }
      addSentryBreadcrumb({
        type: 'error',
        message: 'error during signing control wallet additional message',
        data: {
          controlWalletAddress,
          timestamp,
          currentAddress,
          error
        }
      });
      throw new MoverAPIError("Can't add control wallet due to sign error");
    }

    return '123456';
  }

  public async deleteWallet(
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
    try {
      await web3.eth.personal.sign(JSON.stringify(dataToSign), currentAddress, '');
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
  }

  public async getTagPublicDataForTopUp(): Promise<GetTagPublicDataForTopUpResponse> {
    return {
      found: false,
      topUpSent: 0
    };
  }

  public async resolveTag(): Promise<ResolveTagResponse> {
    return {
      found: false
    };
  }

  public async getTagsAmount(): Promise<TagsAmountResponse> {
    return {
      amount: 1111
    };
  }

  protected lookupBaseURL(): string {
    return process.env.VUE_APP_API_TAG_SERVICE_URL || '';
  }
}

import dayjs from 'dayjs';
import { MoverAPICardService } from 'web-app-shared/services/api/mover/card/MoverAPICardService';
import {
  CardStatus,
  ContactDetails,
  GetInfoResponse,
  GetInfoResponseBase,
  GetInfoResponseWithHistory,
  PersonalInfo
} from 'web-app-shared/services/api/mover/card/types';

export class MoverAPICardServiceMock extends MoverAPICardService {
  constructor() {
    super();
  }

  public async getInfoLegacy(
    address: string,
    confirmationSignature: string
  ): Promise<GetInfoResponse> {
    console.debug('getInfoLegacy()', address, confirmationSignature);

    return {
      status: CardStatus.CardActive,
      cardInfo: {
        expYear: 2024,
        expMonth: 3,
        temporaryBlocked: false,
        displayName: 'Antoshi Nakamoto',
        iban: 'l12312312354215',
        status: CardStatus.Active,
        last4Digits: '8493'
      }
    };
  }

  public async getInfo(
    tag: string,
    address: string,
    confirmationSignature: string
  ): Promise<GetInfoResponse> {
    console.debug('getInfo()', tag, address, confirmationSignature);

    return {
      status: CardStatus.CardActive,
      cardInfo: {
        expYear: 2024,
        expMonth: 3,
        temporaryBlocked: false,
        displayName: 'Antoshi Nakamoto',
        iban: 'l12312312354215',
        status: CardStatus.Active,
        last4Digits: '8493'
      }
    };
  }

  public async setPersonalInfo(
    data: PersonalInfo,
    tag: string,
    address: string,
    confirmationSignature: string
  ): Promise<GetInfoResponseBase> {
    console.debug('setPersonalInfo()', data, tag, address, confirmationSignature);

    return {
      status: CardStatus.ContactDetails
    };
  }

  public async setContactDetails(
    data: ContactDetails,
    tag: string,
    address: string,
    confirmationSignature: string
  ): Promise<GetInfoResponseBase> {
    console.debug('setContactDetails()', data, tag, address, confirmationSignature);

    return {
      status: CardStatus.PhoneVerification
    };
  }

  public async setPhoneNumber(
    phone: string,
    tag: string,
    address: string,
    confirmationSignature: string
  ): Promise<void> {
    console.debug('setPhoneNumber()', phone, tag, address, confirmationSignature);
  }

  public async resendSecurityCode(
    tag: string,
    address: string,
    confirmationSignature: string
  ): Promise<void> {
    console.debug('resendSecurityCode()', tag, address, confirmationSignature);
  }

  public async validatePhone(
    code: string,
    tag: string,
    address: string,
    confirmationSignature: string
  ): Promise<GetInfoResponseWithHistory> {
    console.debug('validatePhone()', code, tag, address, confirmationSignature);

    return {
      status: CardStatus.CardOrder,
      statusHistory: [
        {
          status: CardStatus.CardOrder,
          timestamp: dayjs().subtract(2, 'minute').unix()
        }
      ]
    };
  }
}

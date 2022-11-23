import axios, { AxiosInstance } from 'axios';

import { getEndpoint } from '@/references/endpoints';
import { CountryNotSupportedError } from '@/services/api/mover/card/CountryNotSupportedError';
import {
  ContactDetails,
  GetInfoResponse,
  GetInfoResponseBase,
  GetInfoResponseWithHistory,
  PersonalInfo
} from '@/services/api/mover/card/types';
import { MoverAPIError } from '@/services/api/mover/MoverAPIError';
import { MoverAPIService } from '@/services/api/mover/MoverAPIService';
import { MoverAPISuccessfulResponse } from '@/services/api/mover/types';

export class MoverAPICardService extends MoverAPIService {
  protected readonly client: AxiosInstance;

  constructor() {
    super('card.api.service');
    this.client = this.applyAxiosInterceptors(
      axios.create({
        baseURL: `${getEndpoint('API_VIEW_SERVICE_URL')}/v2/cards`
      })
    );
  }

  public async getInfoLegacy(
    address: string,
    confirmationSignature: string
  ): Promise<GetInfoResponse> {
    return (
      await this.client.get<MoverAPISuccessfulResponse<GetInfoResponse>>(`/info`, {
        headers: this.getAuthHeaders(address, confirmationSignature)
      })
    ).data.payload;
  }

  public async getInfo(
    tag: string,
    address: string,
    confirmationSignature: string
  ): Promise<GetInfoResponse> {
    return (
      await this.client.get<GetInfoResponse>(`/${tag}/info`, {
        headers: this.getAuthHeaders(address, confirmationSignature)
      })
    ).data;
  }

  public async setPersonalInfo(
    data: PersonalInfo,
    tag: string,
    address: string,
    confirmationSignature: string
  ): Promise<GetInfoResponseBase> {
    return (
      await this.client.post<GetInfoResponseBase>(
        `/${tag}/sign/personal-info`,
        {
          data,
          meta: {
            tag
          }
        },
        {
          headers: this.getAuthHeaders(address, confirmationSignature)
        }
      )
    ).data;
  }

  public async setContactDetails(
    data: ContactDetails,
    tag: string,
    address: string,
    confirmationSignature: string
  ): Promise<GetInfoResponseBase> {
    try {
      return (
        await this.client.post<GetInfoResponseBase>(`/${tag}/sign/contact-details`, data, {
          headers: this.getAuthHeaders(address, confirmationSignature)
        })
      ).data;
    } catch (error) {
      if (error instanceof MoverAPIError && error.shortMessage === 'UNSUPPORTED_COUNTRY') {
        throw new CountryNotSupportedError(error);
      }

      throw error;
    }
  }

  public async setPhoneNumber(
    phone: string,
    tag: string,
    address: string,
    confirmationSignature: string
  ): Promise<void> {
    try {
      return (
        await this.client.post(
          `/${tag}/sign/phone-number`,
          {
            phone
          },
          {
            headers: this.getAuthHeaders(address, confirmationSignature)
          }
        )
      ).data;
    } catch (error) {
      if (error instanceof MoverAPIError && error.shortMessage === 'UNSUPPORTED_COUNTRY') {
        throw new CountryNotSupportedError(error);
      }

      throw error;
    }
  }

  public async resendSecurityCode(
    tag: string,
    address: string,
    confirmationSignature: string
  ): Promise<void> {
    await this.client.post(`/${tag}/sign/code/resend`, undefined, {
      headers: this.getAuthHeaders(address, confirmationSignature)
    });
  }

  public async validatePhone(
    code: string,
    tag: string,
    address: string,
    confirmationSignature: string
  ): Promise<GetInfoResponseWithHistory> {
    return (
      await this.client.post<GetInfoResponseWithHistory>(
        `/${tag}/sign/code`,
        { code },
        {
          headers: this.getAuthHeaders(address, confirmationSignature)
        }
      )
    ).data;
  }
}

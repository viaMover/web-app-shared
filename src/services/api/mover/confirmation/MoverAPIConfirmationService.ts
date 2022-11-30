import axios, { AxiosInstance } from 'axios';

import { addSentryBreadcrumb } from '../../../../logs/sentry';
import { MoverAPIService } from '../MoverAPIService';
import { MoverAPISuccessfulResponse } from '../types';

export class MoverAPIConfirmationService extends MoverAPIService {
  protected readonly baseURL: string;
  protected readonly client: AxiosInstance;
  protected readonly sentryCategoryPrefix: string = 'confirmation.api.service';

  constructor(baseURL: string) {
    super('confirmation.api.service');
    this.baseURL = baseURL;
    this.client = this.applyAxiosInterceptors(
      axios.create({
        baseURL: this.baseURL
      })
    );
  }

  public async getCountConfirmations(): Promise<number> {
    try {
      const resp = await this.client.get<MoverAPISuccessfulResponse<{ count: number }>>(
        `/confirmation/count`
      );
      return resp.data.payload.count;
    } catch (error) {
      addSentryBreadcrumb({
        level: 'error',
        message: 'Fetch count confirmation error',
        category: this.sentryCategoryPrefix,
        data: {
          error: error
        }
      });
      return 0;
    }
  }

  public async validConfirmation(address: string, signature: string): Promise<boolean> {
    try {
      await this.client.get<MoverAPISuccessfulResponse<void>>(`/confirmation/valid`, {
        headers: {
          'X-Api-Sign': signature,
          'X-Api-Addr': address
        }
      });
      return true;
    } catch (e) {
      return false;
    }
  }

  public async setConfirmation(address: string, signature: string): Promise<boolean> {
    try {
      await this.client.post<MoverAPISuccessfulResponse<void>>(`/confirmation`, {
        address: address,
        sig: signature
      });
      return true;
    } catch (e) {
      return false;
    }
  }
}

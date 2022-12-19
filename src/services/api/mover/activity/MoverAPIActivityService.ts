import axios, { AxiosInstance } from 'axios';

import { MoverAPIService } from "../MoverAPIService";
import { TxDataDto } from './types';

export class MoverAPIActivityService extends MoverAPIService {
  protected readonly baseURL: string;
  protected readonly client: AxiosInstance;

  constructor(baseURL: string) {
    super('assets.service');
    this.baseURL = baseURL;
    this.client = this.applyAxiosInterceptors(axios.create({ baseURL: this.baseURL }));
  }

  public async sendActivityEvent(data: TxDataDto, address: string, confirmationSignature: string): Promise<void> {
    return this.client.post('/activity', data, {
      headers: this.getAuthHeaders(address, confirmationSignature)
    });
  }
}

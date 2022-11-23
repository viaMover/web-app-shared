import axios, { AxiosInstance } from 'axios';
import dayjs from 'dayjs';
import { dateFromExplicitPair } from 'web-app-shared/helpers/time';
import { getEndpoint } from 'web-app-shared/references/endpoints';

import { MoverAPIService } from '../MoverAPIService';
import { MoverAPISuccessfulResponse } from '../types';
import { TreasuryInfo, TreasuryReceipt } from './types';

export class MoverAPISmartTreasuryService extends MoverAPIService {
  protected baseURL: string;

  protected readonly currentAddress: string;

  protected client: AxiosInstance;

  constructor(currentAddress: string) {
    super('smart-treasury.api.service');
    this.currentAddress = currentAddress;
    this.baseURL = `${getEndpoint('API_VIEW_SERVICE_URL')}/v1/treasury`;
    this.client = this.applyAxiosInterceptors(axios.create({ baseURL: this.baseURL }));
  }

  public async getInfo(): Promise<TreasuryInfo | never> {
    return (
      await this.client.get<MoverAPISuccessfulResponse<TreasuryInfo>>(
        `/info/${this.currentAddress}`
      )
    ).data.payload;
  }

  public async getReceipt(year: number, month: number): Promise<TreasuryReceipt | never> {
    const data = (
      await this.client.get<MoverAPISuccessfulResponse<TreasuryReceipt>>(
        `/receipt/${this.currentAddress}/${year}/${month}`
      )
    ).data.payload;

    data.monthActionHistory = data.monthActionHistory.filter(
      (item) =>
        dayjs.unix(item.timestamp).startOf('month').unix() ===
        dateFromExplicitPair(year, month).startOf('month').unix()
    );
    return data;
  }
}

import axios, { AxiosInstance } from 'axios';
import dayjs from 'dayjs';

import { dateFromExplicitPair } from '../../../../helpers/time';
import { getEndpoint } from '../../../../references/endpoints';
import { MoverAPIService } from '../MoverAPIService';
import { MoverAPISuccessfulResponse } from '../types';
import { StakingUbtInfo, StakingUbtReceipt } from './types';

export class MoverAPIStakingUbtService extends MoverAPIService {
  protected baseURL: string;

  protected readonly client: AxiosInstance;

  protected readonly currentAddress: string;

  constructor(currentAddress: string) {
    super('staking-ubt.api.service');
    this.baseURL = `${getEndpoint('API_VIEW_SERVICE_URL')}/v1/ubtstaking`;
    this.currentAddress = currentAddress;
    this.client = this.applyAxiosInterceptors(
      axios.create({
        baseURL: this.baseURL
      })
    );
  }

  public async getInfo(): Promise<StakingUbtInfo | never> {
    return (
      await this.client.get<MoverAPISuccessfulResponse<StakingUbtInfo>>(
        `/info/${this.currentAddress}`
      )
    ).data.payload;
  }

  public async getReceipt(year: number, month: number): Promise<StakingUbtReceipt> {
    const data = (
      await this.client.get<MoverAPISuccessfulResponse<StakingUbtReceipt>>(
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

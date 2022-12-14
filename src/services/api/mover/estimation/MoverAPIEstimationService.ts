import axios, { AxiosInstance } from 'axios';

import { Network } from '../../../../references/network';
import { MoverAPIService } from '../MoverAPIService';
import { MoverAPISuccessfulResponse } from '../types';
import { GetEstimationAPIResponse, GetEstimationReturn } from './types';

export class MoverAPIEstimationService extends MoverAPIService {
  protected readonly baseURL: string;

  protected readonly client: AxiosInstance;

  constructor(baseURL: string) {
    super('estimation.api.service');
    this.baseURL = baseURL;
    this.client = this.applyAxiosInterceptors(axios.create({ baseURL: this.baseURL }));
  }

  public async getTopUpEstimation(network: Network): Promise<GetEstimationReturn> {
    const data = (
      await this.client.get<MoverAPISuccessfulResponse<GetEstimationAPIResponse>>(
        `/estimation/${network}/topup`
      )
    ).data.payload;

    return { priceInWei: data.priceEstimation };
  }
}

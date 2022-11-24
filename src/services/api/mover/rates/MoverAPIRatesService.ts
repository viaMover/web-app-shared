import axios, { AxiosInstance } from 'axios';
import qs from 'qs';

import { getEndpoint } from '../../../../references/endpoints';
import { MoverAPIService } from '../MoverAPIService';
import { MoverAPISuccessfulResponse } from '../types';
import { CurrencyCode, MultiRates, Rates } from './types';

export class MoverAPIRatesService extends MoverAPIService {
  private readonly baseURL: string;
  private client: AxiosInstance;
  private readonly selectedCurrencies: Array<CurrencyCode>;
  constructor(currencies: Array<CurrencyCode>) {
    super('rates.api.service');
    this.baseURL = getEndpoint('API_ASSETS_SERVICE_URL');
    this.client = this.applyAxiosInterceptors(axios.create({ baseURL: this.baseURL }));
    this.selectedCurrencies = currencies;
  }

  public async getRates(timestamp: number): Promise<Rates> {
    return (
      await this.client.post<MoverAPISuccessfulResponse<Rates>>(
        `/rates`,
        { timestamp: timestamp },
        {
          params: {
            code: this.selectedCurrencies
          },
          paramsSerializer: (params) => {
            return qs.stringify(params, { arrayFormat: 'repeat' });
          }
        }
      )
    ).data.payload;
  }

  public async getMultiRates(timestamps: Array<number>): Promise<MultiRates> {
    return (
      await this.client.post<MoverAPISuccessfulResponse<MultiRates>>(
        `/rates/multi`,
        {
          timestamps: timestamps
        },
        {
          params: {
            code: this.selectedCurrencies
          },
          paramsSerializer: (params) => {
            return qs.stringify(params, { arrayFormat: 'repeat' });
          }
        }
      )
    ).data.payload;
  }

  public async getLastRates(): Promise<Rates> {
    return (
      await this.client.get<MoverAPISuccessfulResponse<Rates>>(`/rates/last`, {
        params: {
          code: this.selectedCurrencies
        },
        paramsSerializer: (params) => {
          return qs.stringify(params, { arrayFormat: 'repeat' });
        }
      })
    ).data.payload;
  }
}

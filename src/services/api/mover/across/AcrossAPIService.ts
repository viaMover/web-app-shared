import axios, { AxiosInstance } from 'axios';

import { getEndpoint } from '@/references/endpoints';
import { Network } from '@/references/network';
import { MoverError } from '@/services/MoverError';
import { Service } from '@/services/Service';
import { getParamsSerializer } from '@/services/utils/params';

import { AcrossFeeResponse } from './types';

/**
 * A wrapper class for interacting with across API (across.to)
 */
export class AcrossAPIService extends Service {
  // we have proxy route for Across on our assets service
  protected baseURL = getEndpoint('API_ASSETS_SERVICE_URL');
  protected readonly client: AxiosInstance;
  protected readonly feeForSmallAmount = '495000000000000000';

  constructor() {
    super('across.api.service');
    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        Accept: 'application/json'
      },
      paramsSerializer: getParamsSerializer
    });
  }

  public getRelayFee = async (
    network: Network,
    tokenAddress: string,
    amount: string
  ): Promise<string> => {
    try {
      const response = await this.client.get<AcrossFeeResponse>('/across/suggested-fees', {
        params: {
          token: tokenAddress,
          destinationChainId: 1, // ethereum main net
          amount: amount
        }
      });

      return response.data.relayFeePct;
    } catch (e) {
      if (axios.isAxiosError(e) && e.response !== undefined) {
        if (e.response.status === 400) {
          return this.feeForSmallAmount;
        }
      }
      throw new MoverError(`Can't get fee from Across`, { error: e });
    }
  };

  protected formatError(error: unknown): never {
    throw error;
  }
}

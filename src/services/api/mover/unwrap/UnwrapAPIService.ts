import axios, { AxiosInstance } from 'axios';

import { Network } from '../../../../references/network';
import { MoverError } from '../../../MoverError';
import { getParamsSerializer } from '../../../utils/params';
import { MoverAPIService } from '../MoverAPIService';
import { MoverAPISuccessfulResponse } from '../types';
import {
  CheckAndGetUnwrapTokenResponse,
  CheckAndGetUnwrapTokenResult,
  CheckUnwrapTokenResponse,
  CheckUnwrapTokenResult
} from './types';

/**
 * A wrapper class for interacting with API related to unwrap functionality
 */
export class UnwrapAPIService extends MoverAPIService {
  protected readonly client: AxiosInstance;

  constructor(baseURL: string) {
    super('unwrap.api.service');
    this.client = axios.create({
      baseURL: baseURL,
      headers: {
        Accept: 'application/json'
      },
      paramsSerializer: getParamsSerializer
    });
  }

  public CheckUnwrap = async (
    network: Network,
    tokenAddress: string,
    amountInWei: string
  ): Promise<CheckUnwrapTokenResult> => {
    try {
      const response = await this.client.post<MoverAPISuccessfulResponse<CheckUnwrapTokenResponse>>(
        '/unwrap/token',
        {
          token: tokenAddress,
          network: network,
          amountInWei: amountInWei
        }
      );

      return response.data.payload;
    } catch (e) {
      throw new MoverError(`Can't check unwrap ability of token`, { error: e });
    }
  };

  public CheckAndGetUnwrapToken = async (
    network: Network,
    tokenAddress: string
  ): Promise<CheckAndGetUnwrapTokenResult> => {
    try {
      const response = await this.client.post<
        MoverAPISuccessfulResponse<CheckAndGetUnwrapTokenResponse>
      >('/unwrap/token/data', {
        token: tokenAddress,
        network: network
      });

      return {
        isUnwrapSupported: response.data.payload.isUnwrapSupported,
        token: {
          address: response.data.payload.token.address,
          decimals: response.data.payload.token.decimals,
          symbol: response.data.payload.token.symbol,
          network: response.data.payload.token.network,
          name: response.data.payload.token.name,
          iconURL: response.data.payload.token.logoUrl
        }
      };
    } catch (e) {
      throw new MoverError(`Can't check unwrap ability of token`, { error: e });
    }
  };

  protected formatError(error: unknown): never {
    throw error;
  }
}

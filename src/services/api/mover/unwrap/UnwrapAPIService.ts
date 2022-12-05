import axios, { AxiosInstance } from 'axios';

import { Network } from '../../../../references/network';
import { MoverError } from '../../../MoverError';
import { getParamsSerializer } from '../../../utils/params';
import { MoverAPIService } from '../MoverAPIService';
import { MoverAPISuccessfulResponse } from '../types';
import { CheckUnwrapTokenResponse, CheckUnwrapTokenResult } from './types';

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
    amountInWei: string,
    currentAddress: string,
    confirmationSignature: string
  ): Promise<CheckUnwrapTokenResult> => {
    try {
      const response = await this.client.post<MoverAPISuccessfulResponse<CheckUnwrapTokenResponse>>(
        '/private/unwrap/token',
        {
          token: tokenAddress,
          network: network,
          amountInWei: amountInWei
        },
        {
          headers: this.getAuthHeaders(currentAddress, confirmationSignature)
        }
      );

      return response.data.payload;
    } catch (e) {
      throw new MoverError(`Can't check unwrap ability of token`, { error: e });
    }
  };

  protected formatError(error: unknown): never {
    throw error;
  }
}

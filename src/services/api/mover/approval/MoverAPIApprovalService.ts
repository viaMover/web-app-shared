import axios, { AxiosInstance } from 'axios';

import { addSentryBreadcrumb } from '../../../../logs/sentry';
import { Network } from '../../../../references/network';
import { getNetwork } from '../../../../references/references';
import { MoverAPIService } from '../MoverAPIService';
import { MoverAPISuccessfulResponse } from '../types';
import { GetApprovalAPIResponse, GetApprovalReturn } from './types';

export class MoverAPIApprovalService extends MoverAPIService {
  protected readonly baseURL: string;
  protected readonly sentryCategoryPrefix = 'permit.api.service';

  protected readonly client: AxiosInstance;

  constructor(baseURL: string) {
    super('permit.api.service');
    this.baseURL = baseURL;
    this.client = this.applyAxiosInterceptors(axios.create({ baseURL: this.baseURL }));
  }

  public async checkApproval(
    currentAddress: string,
    tokenAddress: string,
    amountInWei: string,
    network: Network
  ): Promise<GetApprovalReturn> {
    const chainId = getNetwork(network).chainId;

    addSentryBreadcrumb({
      level: 'info',
      category: `${this.sentryCategoryPrefix}.checkApproval`,
      message: 'do approvecheck call',
      data: {
        currentAddress,
        tokenAddress,
        chainId,
        amountInWei
      }
    });

    const data = (
      await this.client.post<MoverAPISuccessfulResponse<GetApprovalAPIResponse>>(
        `/v2/topup/approvecheck`,
        {
          address: currentAddress,
          token: tokenAddress,
          chainId: chainId,
          amount: amountInWei
        }
      )
    ).data.payload;

    return {
      approval: 'ok',
      amount: data.amount,
      data: data.sig.replace('0x', ''),
      timestamp: data.timestamp
    };
  }
}

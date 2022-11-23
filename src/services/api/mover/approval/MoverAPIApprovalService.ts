import axios, { AxiosInstance } from 'axios';
import { addSentryBreadcrumb } from 'web-app-shared/logs/sentry';
import { getEndpoint } from 'web-app-shared/references/endpoints';
import { Network } from 'web-app-shared/references/network';
import { getNetwork } from 'web-app-shared/references/references';
import {
  GetApprovalAPIResponse,
  GetApprovalReturn
} from 'web-app-shared/services/api/mover/approval/types';

import { MoverAPIService } from '../MoverAPIService';
import { MoverAPISuccessfulResponse } from '../types';

export class MoverAPIApprovalService extends MoverAPIService {
  protected readonly baseURL: string;
  protected readonly sentryCategoryPrefix = 'permit.api.service';

  protected readonly client: AxiosInstance;

  constructor() {
    super('permit.api.service');
    this.baseURL = this.lookupBaseURL();
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
      type: 'info',
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

  protected lookupBaseURL(): string {
    return getEndpoint('API_VIEW_SERVICE_URL');
  }
}

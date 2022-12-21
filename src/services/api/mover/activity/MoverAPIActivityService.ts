import axios, { AxiosInstance } from 'axios';

import { getNetwork } from '../../../../references/references';
import { MoverAPIService } from '../MoverAPIService';
import { TransactionType } from '../transactions/types';
import { TxData, TxDataDto } from './types';

export class MoverAPIActivityService extends MoverAPIService {
  protected readonly baseURL: string;
  protected readonly client: AxiosInstance;

  constructor(baseURL: string) {
    super('assets.service');
    this.baseURL = `${baseURL}/private/data-managment`;
    this.client = this.applyAxiosInterceptors(axios.create({ baseURL: this.baseURL }));
  }

  public async sendActivityEvent(
    txType: TransactionType,
    data: TxData,
    address: string,
    confirmationSignature: string
  ): Promise<void> {
    const payload: TxDataDto = {
      chainIdFrom: getNetwork(data.networkFrom).chainId,
      chainIdTo: getNetwork(data.networkTo).chainId,
      amount: data.amount,
      token: data.token,
      hash: data.hash,
      type: txType
    };

    if (data.receiverHash !== undefined) {
      payload.receiverHash = `0x${data.receiverHash}`;
    }

    return this.client.post(`/activities`, payload, {
      headers: this.getAuthHeaders(address, confirmationSignature)
    });
  }
}

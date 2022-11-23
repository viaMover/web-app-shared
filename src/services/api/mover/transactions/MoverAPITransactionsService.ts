import axios, { AxiosInstance } from 'axios';
import { Md5 } from 'ts-md5';

import { getEndpoint } from '@/references/endpoints';
import { getNetworkByChainId } from '@/references/references';
import { MoverAPIService } from '@/services/api/mover/MoverAPIService';
import { MoverAPISuccessfulResponse } from '@/services/api/mover/types';
import { ContentName, SameContentError } from '@/services/SameContentError';

import { ApiTransactionsResponse, GetTransactionListReturnItem, TransactionType } from './types';

export class MoverAPITransactionsService extends MoverAPIService {
  protected baseURL: string;

  protected readonly client: AxiosInstance;

  public static localStorageKey = 'txInfo-hash';
  private contentHash: string | undefined;

  constructor() {
    super('transactions.api.service');
    this.baseURL = `${getEndpoint('API_VIEW_SERVICE_URL')}/v2/tx`;
    this.client = this.applyAxiosInterceptors(
      axios.create({
        baseURL: this.baseURL
      })
    );
  }

  public async getTransactions(
    address: string,
    checkContentHash: boolean
  ): Promise<Array<GetTransactionListReturnItem>> {
    const transactions = (
      await this.client.get<MoverAPISuccessfulResponse<ApiTransactionsResponse>>(
        `/txInfo/${address}/all`
      )
    ).data.payload;

    const newHash = Md5.hashStr(JSON.stringify(transactions));
    if (this.contentHash === newHash) {
      if (checkContentHash) {
        throw new SameContentError(ContentName.TxInfo);
      }
    } else {
      this.contentHash = newHash;
    }

    return transactions.chains
      .flatMap((group) => {
        const networkInfo = getNetworkByChainId(group.chainID);
        if (networkInfo === undefined) {
          return [];
        }
        return group.txs.map((tx) => ({ ...tx, network: networkInfo.network }));
      })
      .filter(
        (tx) =>
          tx.type !== TransactionType.SavingsDeposit && tx.type !== TransactionType.SavingsWithdraw
      );
  }
}

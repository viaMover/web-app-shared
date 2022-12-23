import axios, { AxiosInstance } from 'axios';
import hash from 'object-hash';

import { getNetworkByChainId } from '../../../../references/references';
import { ContentName, SameContentError } from '../../../SameContentError';
import { MoverAPIService } from '../MoverAPIService';
import { MoverAPISuccessfulResponse } from '../types';
import { ApiTransactionsResponse, GetTransactionListReturnItem, TransactionType } from './types';

export class MoverAPITransactionsService extends MoverAPIService {
  protected readonly baseURL: string;
  protected readonly client: AxiosInstance;
  private contentHash: string | undefined;

  constructor(baseURL: string) {
    super('transactions.api.service');
    this.baseURL = baseURL;
    this.client = this.applyAxiosInterceptors(
      axios.create({
        baseURL: `${this.baseURL}/v2/tx`
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

    const txs = transactions.chains
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
      )
      .sort((a, b) => {
        return a.hash.localeCompare(b.hash);
      });

    const newHash = hash(txs);
    if (this.contentHash === newHash) {
      if (checkContentHash) {
        throw new SameContentError(ContentName.TxInfo);
      }
    } else {
      this.contentHash = newHash;
    }

    return txs;
  }
}

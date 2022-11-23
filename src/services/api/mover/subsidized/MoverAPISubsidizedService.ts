import axios, { AxiosInstance } from 'axios';
import { addSentryBreadcrumb } from 'web-app-shared/logs/sentry';
import { Network } from 'web-app-shared/references/network';
import { getNetwork } from 'web-app-shared/references/references';
import { MoverAPIError } from 'web-app-shared/services/api/mover/MoverAPIError';
import { MoverAPIService } from 'web-app-shared/services/api/mover/MoverAPIService';
import { MoverAPISubsidizedRequestError } from 'web-app-shared/services/api/mover/subsidized/MoverAPISubsidizedRequestError';
import { NetworkFeatureNotSupportedError } from 'web-app-shared/services/NetworkFeatureNotSupportedError';

import {
  CheckTransactionStatusReturn,
  ExecuteTransactionReturn,
  TransactionStatus,
  TxExecuteRequest,
  TxExecuteResponse,
  TxStatusResponse
} from './types';

export class MoverAPISubsidizedService extends MoverAPIService {
  protected baseURL: string;

  protected readonly client: AxiosInstance;

  protected static NoBaseURLForNetwork = 'NO_BASE_URL_FOR_NETWORK';

  protected readonly network: Network;

  protected readonly currentAddress: string;

  constructor(currentAddress: string, network: Network) {
    super('subsidized.api.service');
    this.network = network;
    this.currentAddress = currentAddress;
    this.baseURL = this.lookupBaseURL(network);
    this.client = this.applyAxiosInterceptors(
      axios.create({
        baseURL: this.baseURL
      })
    );
  }

  public async executeTransaction(
    action: string,
    signature: string,
    changeStepToProcess?: () => Promise<void>
  ): Promise<ExecuteTransactionReturn> {
    if (this.baseURL === MoverAPISubsidizedService.NoBaseURLForNetwork) {
      throw new NetworkFeatureNotSupportedError('Subsidized request', this.network);
    }

    addSentryBreadcrumb({
      type: 'debug',
      category: this.sentryCategoryPrefix,
      message: 'About to send subsidized request',
      data: {
        action,
        accountAddress: this.currentAddress,
        signature
      }
    });

    changeStepToProcess?.();

    try {
      // fixme: has a plain response schema (no .payload entry). Possible v2 endpoint?
      const response = (
        await this.client.post<TxExecuteResponse>('/tx/executeSubsidized', {
          action,
          signature
        } as TxExecuteRequest)
      ).data;

      if (response.txID === undefined && response.queueID === undefined) {
        throw new MoverAPISubsidizedRequestError(
          'Subsidized request did not return execution status',
          'Subsidized request failed',
          response
        );
      }

      return {
        queueID: response.queueID,
        txID: response.txID
      };
    } catch (error) {
      throw new MoverAPISubsidizedRequestError(
        `Failed to send subsidized request: ${error}`,
        'Failed to send subsidized request'
      ).wrap(error);
    }
  }

  public async executeSavingsPlusWithdrawTransaction(
    action: string,
    signature: string,
    changeStepToProcess?: () => Promise<void>
  ): Promise<ExecuteTransactionReturn> {
    const client = this.applyAxiosInterceptors(
      axios.create({
        baseURL: 'https://api.viamover.com/api/v1'
      })
    );

    addSentryBreadcrumb({
      type: 'debug',
      category: this.sentryCategoryPrefix,
      message: 'About to send subsidized request',
      data: {
        action,
        accountAddress: this.currentAddress,
        signature
      }
    });

    changeStepToProcess?.();

    try {
      const response = (
        await client.post<TxExecuteResponse>('/savingsplus/executeWithdraw', {
          action,
          signature
        } as TxExecuteRequest)
      ).data;

      if (response.txID === undefined && response.queueID === undefined) {
        throw new MoverAPISubsidizedRequestError(
          'Subsidized request did not return execution status',
          'Subsidized request failed',
          response
        );
      }

      return {
        queueID: response.queueID,
        txID: response.txID
      };
    } catch (error) {
      throw new MoverAPISubsidizedRequestError(
        `Failed to send subsidized request: ${error}`,
        'Failed to send subsidized request'
      ).wrap(error);
    }
  }

  public async checkTransactionStatus(queueId: string): Promise<CheckTransactionStatusReturn> {
    if (this.baseURL === MoverAPISubsidizedService.NoBaseURLForNetwork) {
      throw new NetworkFeatureNotSupportedError('Subsidized request', this.network);
    }

    try {
      // fixme: has a plain response schema (no .payload entry). Possible v2 endpoint?
      const response = (await this.client.get<TxStatusResponse>(`/tx/executeStatus/${queueId}`))
        .data;

      switch (response.txStatusCode) {
        case TransactionStatus.Discarded:
          addSentryBreadcrumb({
            type: 'error',
            message: 'Subsidized transaction was discarded',
            data: {
              queueId,
              response
            }
          });

          return {
            errorStatus: response.txStatus,
            status: TransactionStatus.Discarded
          };
        case TransactionStatus.Executing:
        case TransactionStatus.Completed:
          if (response.txID === undefined) {
            addSentryBreadcrumb({
              type: 'error',
              message: 'Subsidized transaction has no txID but must have one',
              data: {
                queueId,
                response
              }
            });

            throw new MoverAPISubsidizedRequestError(
              'Subsidized transaction has no txID but must have one',
              'Subsidized transaction status check failed',
              response
            );
          }

          return {
            status: response.txStatusCode,
            txID: response.txID
          };
        case TransactionStatus.Queued:
        default:
          return { status: TransactionStatus.Queued };
      }
    } catch (error) {
      throw new MoverAPIError(
        `Failed to check subsidized transaction status, alerted user`,
        undefined,
        { queueId }
      ).wrap(error);
    }
  }

  protected lookupBaseURL(network?: Network): string {
    if (network === undefined) {
      return MoverAPISubsidizedService.NoBaseURLForNetwork;
    }

    return getNetwork(network)?.subsidizedUrl ?? MoverAPISubsidizedService.NoBaseURLForNetwork;
  }
}

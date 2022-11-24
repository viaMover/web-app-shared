import axios, { AxiosInstance } from 'axios';
import dayjs from 'dayjs';

import { dateFromExplicitPair } from '../../../../helpers/time';
import { getEndpoint } from '../../../../references/endpoints';
import { Network } from '../../../../references/network';
import { getNetwork } from '../../../../references/references';
import { EECode, ExpectedError } from '../../../ExpectedError';
import { MoverError } from '../../../MoverError';
import { MoverAPIError } from '../MoverAPIError';
import { MoverAPIService } from '../MoverAPIService';
import { MoverAPISuccessfulResponse } from '../types';
import {
  DepositExecution,
  DepositTransactionData,
  SavingsPlusInfo,
  SavingsPlusReceipt,
  WithdrawAPIErrorCode,
  WithdrawExecution,
  WithdrawTransactionData
} from './types';

export class MoverAPISavingsPlusService extends MoverAPIService {
  protected baseURL: string;

  protected readonly client: AxiosInstance;

  protected readonly apiviewClient: AxiosInstance;

  protected readonly currentAddress: string;

  constructor(currentAddress: string) {
    super('savings-plus.api.service');
    this.baseURL = `${getEndpoint('API_SERVICE_URL')}/v1/savingsplus`;
    this.currentAddress = currentAddress;
    this.client = this.applyAxiosInterceptors(
      axios.create({
        baseURL: this.baseURL
      })
    );
    this.apiviewClient = this.applyAxiosInterceptors(
      axios.create({
        baseURL: `${getEndpoint('API_VIEW_SERVICE_URL')}/v1/savingsplus`
      })
    );
  }

  public async getInfo(): Promise<SavingsPlusInfo> {
    return (
      await this.apiviewClient.get<MoverAPISuccessfulResponse<SavingsPlusInfo>>(
        `/info/${this.currentAddress}`
      )
    ).data.payload;
  }

  public async getDepositTransactionData(
    currentNetwork: Network,
    inputAmountInUSDCWei: string
  ): Promise<DepositTransactionData> {
    const chainId = getNetwork(currentNetwork)?.chainId;
    if (chainId === undefined) {
      throw new MoverError(`Failed to get chainId of network ${currentNetwork}`);
    }

    const data = (
      await this.client.post<MoverAPISuccessfulResponse<DepositTransactionData>>('/depositTx', {
        from: chainId,
        amount: inputAmountInUSDCWei,
        address: this.currentAddress
      })
    ).data.payload;

    if (![DepositExecution.Direct, DepositExecution.Bridged].includes(data.execution)) {
      throw new MoverError('Received invalid deposit transaction data. Validation failed', {
        data
      });
    }

    return data;
  }

  public async getReceipt(year: number, month: number): Promise<SavingsPlusReceipt | never> {
    const data = (
      await this.apiviewClient.get<MoverAPISuccessfulResponse<SavingsPlusReceipt>>(
        `/receipt/${this.currentAddress}/${year}/${month}`
      )
    ).data.payload;

    data.monthActionHistory = data.monthActionHistory.filter(
      (item) =>
        dayjs.unix(item.timestamp).startOf('month').unix() ===
        dateFromExplicitPair(year, month).startOf('month').unix()
    );
    return data;
  }

  public async getWithdrawTransactionData(
    withdrawToNetwork: Network,
    outputAmountInUSDCWei: string
  ): Promise<WithdrawTransactionData> {
    const chainId = getNetwork(withdrawToNetwork)?.chainId;
    if (chainId === undefined) {
      throw new MoverError(`Failed to get chainId of network ${withdrawToNetwork}`);
    }

    let data;
    try {
      data = (
        await this.client.post<MoverAPISuccessfulResponse<WithdrawTransactionData>>('/withdrawTx', {
          to: chainId,
          amount: outputAmountInUSDCWei,
          address: this.currentAddress
        })
      ).data.payload;
    } catch (error) {
      if (!(error instanceof MoverAPIError)) {
        throw error;
      }

      // re-wrap the error to be distinctive
      // and allow UI to handle the error as needed
      if (error.shortMessage === WithdrawAPIErrorCode.UnsupportedChain) {
        throw new ExpectedError(EECode.withdrawUnsupportedNetwork);
      }

      throw error;
    }

    if (![WithdrawExecution.Direct, WithdrawExecution.Bridged].includes(data.execution)) {
      throw new MoverError('Received invalid withdraw transaction data. Validation failed', {
        data
      });
    }

    return data;
  }
}

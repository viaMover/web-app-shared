import axios, { AxiosError, AxiosInstance } from 'axios';
import dayjs from 'dayjs';
import Web3 from 'web3';

import { addSentryBreadcrumb } from '../../../../logs/sentry';
import { getNetworkByChainId } from '../../../../references/references';
import { EECode, ExpectedError } from '../../../ExpectedError';
import { MoverError } from '../../../MoverError';
import { isRejectedRequestError } from '../../../onchain/ProviderRPCError';
import { MoverAPIError } from '../MoverAPIError';
import { MoverAPIService } from '../MoverAPIService';
import { MoverAPIErrorResponse, MoverAPISuccessfulResponse } from '../types';
import {
  GetIncomingTopUpEventAPIResponse,
  GetTagTopUpCodeRequest,
  GetTagTopUpCodeResponse,
  MoverTopUpInputEventFromService
} from './types';

export class MoverAPITxTagService extends MoverAPIService {
  protected readonly baseURL: string;
  protected readonly client: AxiosInstance;

  constructor(baseURL: string) {
    super('tx-tag.api.service');
    this.baseURL = baseURL;
    this.client = this.applyAxiosInterceptors(
      axios.create({
        baseURL: this.baseURL
      })
    );
  }

  public async GetTagTopUpCode(tag: string): Promise<string> {
    const payload: GetTagTopUpCodeRequest = {
      tag: tag
    };

    const res = await this.client.post<MoverAPISuccessfulResponse<GetTagTopUpCodeResponse>>(
      '/v2/topup/topuptag',
      payload
    );

    return res.data.payload.topupHash;
  }

  public async GetIncomingTopUpEvent(
    address: string,
    confirmationSignature: string
  ): Promise<MoverTopUpInputEventFromService> {
    const res = await this.client.get<MoverAPISuccessfulResponse<GetIncomingTopUpEventAPIResponse>>(
      `/v2/topup/pending/${address}`,
      {
        headers: this.getAuthHeaders(address, confirmationSignature)
      }
    );

    const networkInfo = getNetworkByChainId(res.data.payload.chainID);
    if (networkInfo === undefined) {
      throw new MoverError(
        `GetIncomingTopUpEvent: Unrecognized chain id: ${res.data.payload.chainID}`
      );
    }

    return {
      from: res.data.payload.addressFrom,
      network: networkInfo.network,
      amountInWei: res.data.payload.amount,
      hash: res.data.payload.txHash,
      originalAssetAddress: res.data.payload.token
    };
  }

  public async approveTopUp(
    currentAddress: string,
    currentTag: string,
    amountInWei: string,
    fromAddress: string,
    txHash: string,
    confirmationSignature: string,
    web3: Web3
  ): Promise<void> {
    const timestamp = dayjs().unix();
    const msgToSign = `MOVER WALLET ${currentAddress} TAG ${currentTag} ACCEPT TOPUP AMOUNT ${amountInWei} USDC FROM ${fromAddress} TX ${txHash} TS ${timestamp}`;
    let signature = '';
    try {
      signature = await web3.eth.personal.sign(msgToSign, currentAddress, '');
    } catch (error) {
      if (isRejectedRequestError(error)) {
        throw new ExpectedError(EECode.userRejectSign);
      }
      addSentryBreadcrumb({
        level: 'error',
        message: 'error during signing approval of incoming top up',
        data: {
          currentAddress,
          currentTag,
          amountInWei,
          timestamp,
          fromAddress,
          txHash,
          error
        }
      });
      throw new MoverAPIError("Can't sign approval of incoming top up");
    }

    await this.client.post(
      `/v2/topup/processpending`,
      {
        message: msgToSign,
        sig: signature
      },
      {
        headers: this.getAuthHeaders(currentAddress, confirmationSignature)
      }
    );
  }

  public async rejectTopUp(
    currentAddress: string,
    currentTag: string,
    amountInWei: string,
    fromAddress: string,
    txHash: string,
    confirmationSignature: string,
    web3: Web3
  ): Promise<void> {
    const timestamp = dayjs().unix();
    const msgToSign = `MOVER WALLET ${currentAddress} TAG ${currentTag} REJECT TOPUP AMOUNT ${amountInWei} USDC FROM ${fromAddress} TX ${txHash} TS ${timestamp}`;
    let signature = '';
    try {
      signature = await web3.eth.personal.sign(msgToSign, currentAddress, '');
    } catch (error) {
      if (isRejectedRequestError(error)) {
        throw new ExpectedError(EECode.userRejectSign);
      }
      addSentryBreadcrumb({
        level: 'error',
        message: 'error during signing rejection of incoming top up',
        data: {
          currentAddress,
          currentTag,
          amountInWei,
          timestamp,
          fromAddress,
          txHash,
          error
        }
      });
      throw new MoverAPIError("Can't sign rejection of incoming top up");
    }

    await this.client.post(
      `/v2/topup/processpending`,
      {
        message: msgToSign,
        sig: signature
      },
      {
        headers: this.getAuthHeaders(currentAddress, confirmationSignature)
      }
    );
  }

  protected formatError(error: unknown): never {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<MoverAPIErrorResponse<unknown>>;
      if (axiosError.response?.data.errorCode === 'NOT_FOUND') {
        throw new MoverAPIError(
          axiosError.response.data.error,
          axiosError.response.data.errorCode,
          axiosError.response.data.payload as Record<string, unknown>
        );
      }
    }

    super.formatError(error);
  }
}

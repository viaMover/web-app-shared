import { Breadcrumb } from '@sentry/types';
import axios, { AxiosError, AxiosInstance, AxiosResponse } from 'axios';
import axiosRetry from 'axios-retry';

import { getPureBaseAssetAddress } from '@/helpers/addresses';
import { greaterThan, multiply } from '@/helpers/bigmath';
import { ResponseHTTPErrorCode } from '@/helpers/http';
import { addSentryBreadcrumb } from '@/logs/sentry';
import { Network } from '@/references/network';
import { isBaseAsset } from '@/references/references';
import { EECode, ExpectedError } from '@/services/ExpectedError';
import { MoverError } from '@/services/MoverError';
import { NetworkFeatureNotSupportedError } from '@/services/NetworkFeatureNotSupportedError';
import { Service } from '@/services/Service';
import { getParamsSerializer } from '@/services/utils/params';

import { ISwapper } from '../ISwapper';
import { TransferData } from '../types';
import {
  GeneralErrorCode,
  SwapQuoteParams,
  SwapQuoteResponse,
  ValidationErrorReason,
  ZeroXBadRequestResponse
} from './types';

/**
 * A wrapper class for interacting with 0x.org API
 * @see https://0x.org/docs/api
 */
export class ZeroXAPIService extends Service implements ISwapper {
  protected baseURL: string;

  protected readonly client: AxiosInstance;

  protected readonly network: Network;

  protected static readonly validNetworks: Array<Network> = [
    // Network.ethereum,
    Network.binance,
    // Network.polygon,
    Network.avalanche,
    Network.fantom
  ];

  constructor(network: Network) {
    super('0x.api.service');
    this.network = network;
    this.baseURL = this.lookupBaseURL(network);
    this.client = this.applyAxiosInterceptors(
      axios.create({
        baseURL: this.baseURL,
        paramsSerializer: getParamsSerializer,
        headers: {
          Accept: 'application/json'
        },
        validateStatus: (status) => status === 200
      })
    );
  }

  public isBuyAmountAvailable(): boolean {
    return true;
  }

  public canHandle(network: Network): boolean {
    return ZeroXAPIService.validNetworks.includes(network);
  }

  /**
   * @deprecated
   */
  public async getTransferData(
    buyTokenAddress: string,
    sellTokenAddress: string,
    rawAmount: string,
    slippage: string,
    isInputAmount = true
  ): Promise<TransferData> {
    const slippageFromPercents = multiply(slippage, '0.01');

    const base: Omit<SwapQuoteParams, 'sellAmount' | 'buyAmount'> = {
      buyToken: this.substituteAssetAddressIfNeeded(buyTokenAddress),
      sellToken: this.substituteAssetAddressIfNeeded(sellTokenAddress),
      slippagePercentage: slippageFromPercents
    };

    let requestPromise;
    if (isInputAmount) {
      requestPromise = this.getSwapQuote({
        ...base,
        sellAmount: rawAmount
      });
    } else {
      requestPromise = this.getSwapQuote({
        ...base,
        buyAmount: rawAmount
      });
    }

    return this.mapSwapQuote(await requestPromise);
  }

  /**
   * Requests swap quote with all the estimations needed
   * @param params
   */
  public async getSwapQuote(params: SwapQuoteParams): Promise<SwapQuoteResponse> {
    if (!ZeroXAPIService.ensureNetworkIsSupported(this.network)) {
      throw new NetworkFeatureNotSupportedError('0x swaps', this.network);
    }

    return (await this.client.get<SwapQuoteResponse>('/swap/v1/quote', { params })).data;
  }

  protected mapSwapQuote(data: SwapQuoteResponse): TransferData {
    const via = data.sources.find((s) => greaterThan(s.proportion, 0)) ?? {
      name: ''
    };

    return {
      allowanceTarget: data.allowanceTarget,
      buyAmount: data.buyAmount,
      data: data.data,
      sellAmount: data.sellAmount,
      to: data.to,
      value: data.value,
      swappingVia: via.name,
      buyTokenToEthRate: data.buyTokenToEthRate,
      sellTokenToEthRate: data.sellTokenToEthRate
    };
  }

  protected formatError(error: unknown): never {
    if (axios.isAxiosError(error)) {
      addSentryBreadcrumb(this.formatAxiosErrorSentryBreadcrumb(error));

      if (error.response !== undefined) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        if (error.response.data === undefined) {
          addSentryBreadcrumb({
            type: 'error',
            message: 'API responded with an error',
            category: this.sentryCategoryPrefix,
            data: {
              error: 'no data available',
              axiosError: error
            }
          });

          throw new MoverError(error.message).wrap(error); // no data available
        }

        if (error.response.status === ResponseHTTPErrorCode.BadRequest) {
          // handle and log bad request responses differently
          throw this.formatBadRequestResponse(error.response as any);
        }

        addSentryBreadcrumb({
          type: 'error',
          message: 'API responded with an error',
          category: this.sentryCategoryPrefix,
          data: {
            error
          }
        });

        throw new MoverError(error.message, error.response.data as any).wrap(error);
      } else if (error.request !== undefined) {
        // The request was made but no response was received
        // `error.request` is an instance of XMLHttpRequest
        addSentryBreadcrumb({
          type: 'error',
          message: 'API responded with an error',
          category: this.sentryCategoryPrefix,
          data: {
            error: 'no response received',
            axiosError: error
          }
        });

        throw new MoverError('The request is failed, no response', error.request).wrap(error);
      }
    }

    addSentryBreadcrumb({
      type: 'error',
      message: 'API responded with an error',
      category: this.sentryCategoryPrefix,
      data: {
        error: 'the request is failed during setup',
        originalError: error
      }
    });

    // Something happened in setting up the request that triggered an Error
    // or result handling went wrong

    if (error instanceof Error) {
      // An error is JS-initiated error, just pass it through
      throw new MoverError('The request is failed').wrap(error);
    }

    throw new MoverError(`The request is failed during setup / result handling`, { data: error });
  }

  protected applyAxiosInterceptors(instance: AxiosInstance): AxiosInstance {
    axiosRetry(instance, {
      retries: 3,
      retryCondition: (error: AxiosError) =>
        axiosRetry.isIdempotentRequestError(error) &&
        error.response?.status === ResponseHTTPErrorCode.TooManyRequests
    });

    instance.interceptors.response.use(undefined, this.formatError.bind(this));

    return instance;
  }

  private formatAxiosErrorSentryBreadcrumb(axiosError: AxiosError): Breadcrumb {
    const requestUri = axios.getUri(axiosError.config);
    const { code } = axiosError;

    return {
      message: 'A request to the API is failed',
      category: this.sentryCategoryPrefix,
      data: {
        requestUri,
        code,
        axiosError
      }
    };
  }

  protected formatBadRequestResponse(response: AxiosResponse<ZeroXBadRequestResponse>): never {
    addSentryBreadcrumb({
      type: 'error',
      category: this.sentryCategoryPrefix,
      message: `Request failed with code ${response.status} (${response.statusText}): ${response.data.reason}`,
      data: {
        reason: response.data.reason,
        code: response.data.code,
        validationErrors: response.data.validationErrors
      }
    });

    if (response.data.code === GeneralErrorCode.ValidationFailed) {
      if (
        response.data.validationErrors?.some(
          (item) => item.reason === ValidationErrorReason.InsufficientAssetLiquidity
        )
      ) {
        throw new ExpectedError(EECode.swapInsufficientLiquidity);
      }

      const validationErrorString =
        response.data.validationErrors?.[0].reason ?? response.data.reason;
      throw new MoverError(validationErrorString, response.data);
    }

    throw new MoverError(response.data.reason, response.data);
  }

  protected static ensureNetworkIsSupported(network?: Network): boolean {
    if (network === undefined) {
      return false;
    }

    return ZeroXAPIService.validNetworks.includes(network);
  }

  protected lookupBaseURL(network?: Network): string {
    switch (network) {
      case Network.binance:
        return 'https://bsc.api.0x.org';
      case Network.polygon:
        return 'https://polygon.api.0x.org';
      case Network.avalanche:
        return 'https://avalanche.api.0x.org';
      case Network.fantom:
        return 'https://fantom.api.0x.org';
      case Network.optimism:
        return 'https://optimism.api.0x.org';
      case Network.ethereum:
      default:
        return 'https://api.0x.org';
    }
  }

  protected substituteAssetAddressIfNeeded(address: string): string {
    return ZeroXAPIService.substituteAssetAddressIfNeeded(address);
  }

  protected static substituteAssetAddressIfNeeded(address: string): string {
    if (isBaseAsset(address)) {
      return getPureBaseAssetAddress();
    }

    return address;
  }

  public getName(): string {
    return 'ZeroXAPIService';
  }
}

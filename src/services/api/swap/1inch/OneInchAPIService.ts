import { Breadcrumb } from '@sentry/types';
import axios, { AxiosError, AxiosInstance, AxiosResponse } from 'axios';
import axiosRetry, { exponentialDelay } from 'axios-retry';
import dayjs from 'dayjs';
import Web3 from 'web3';

import { getPureBaseAssetAddress, sameAddress } from '@/helpers/addresses';
import { flattenDeep } from '@/helpers/arrays';
import { BadRequestDescription, ResponseHTTPErrorCode } from '@/helpers/http';
import { addSentryBreadcrumb } from '@/logs/sentry';
import { Network } from '@/references/network';
import { getNetwork, isBaseAsset } from '@/references/references';
import {
  OneInchBadRequestResponse,
  OneInchToken,
  Protocol,
  QuoteParams,
  QuoteResponse,
  SwapParams,
  SwapResponse,
  TokensResponse
} from '@/services/api/swap/1inch/types';
import { ISwapper } from '@/services/api/swap/ISwapper';
import { EECode, ExpectedError } from '@/services/ExpectedError';
import { MoverError } from '@/services/MoverError';
import { NetworkFeatureNotSupportedError } from '@/services/NetworkFeatureNotSupportedError';
import { SingleNetworkService } from '@/services/SingleNetworkService';
import { getParamsSerializer } from '@/services/utils/params';

import { TransferData } from '../types';

export class OneInchAPIService extends SingleNetworkService implements ISwapper {
  protected baseURL: string;

  protected readonly client: AxiosInstance;

  protected static supportedNetworks: Array<Network> = [
    Network.ethereum,
    // Network.binance,
    Network.polygon,
    // Network.optimism,
    // Network.avalanche,
    // Network.fantom,
    Network.arbitrum,
    Network.optimism
  ];

  protected availableTokens: Map<string, OneInchToken> | undefined;

  protected useAvailableTokens: boolean;

  constructor(network: Network, useAvailableTokens = false) {
    super(network, '1inch.api.service');
    this.useAvailableTokens = useAvailableTokens;
    this.baseURL = this.lookupBaseURL(network);
    this.client = this.applyAxiosInterceptors(
      axios.create({
        baseURL: this.baseURL,
        headers: {
          Accept: 'application/json'
        },
        paramsSerializer: getParamsSerializer,
        validateStatus: (status) => status === 200
      })
    );
  }

  public isBuyAmountAvailable(): boolean {
    return false;
  }

  public canHandle(network: Network): boolean {
    return OneInchAPIService.supportedNetworks.includes(network);
  }

  protected applyAxiosInterceptors(instance: AxiosInstance): AxiosInstance {
    axiosRetry(instance, {
      retries: 3,
      retryCondition: (error: AxiosError) =>
        (axiosRetry.isIdempotentRequestError(error) &&
          error.response?.status === ResponseHTTPErrorCode.TooManyRequests) ||
        error.response?.status === ResponseHTTPErrorCode.ServiceUnavailable,
      retryDelay: (retryCount, error) => {
        if (error.response?.headers['retry-after'] !== undefined) {
          const number = Number.parseInt(error.response.headers['retry-after'], 10);
          if (Number.isNaN(number)) {
            return number * 1000;
          }

          return dayjs(error.response.headers['retry-after']).diff(dayjs(), 'millisecond');
        }

        return exponentialDelay(retryCount);
      }
    });

    instance.interceptors.response.use(undefined, this.formatError.bind(this));

    return instance;
  }

  protected async getAvailableTokens(): Promise<Map<string, OneInchToken>> {
    if (this.availableTokens !== undefined) {
      return this.availableTokens;
    }

    const res = await this.client.get<TokensResponse>('/tokens');
    const map = new Map<string, OneInchToken>();
    const networkChainId = getNetwork(this.network)?.chainId;
    res.data.tokens.forEach((token) => {
      let { address } = token;
      try {
        address = Web3.utils.toChecksumAddress(token.address, networkChainId);
      } catch (error) {
        addSentryBreadcrumb({
          type: 'debug',
          message: 'Unable to convert address to checksum variant',
          data: {
            address: token.address,
            error
          }
        });
      } finally {
        map.set(address, token);
      }
    });

    this.availableTokens = map;
    return this.availableTokens;
  }

  // @deprecated use getSwapData()
  public async getTransferData(
    buyTokenAddress: string,
    sellTokenAddress: string,
    rawAmount: string,
    slippage: string,
    isInputAmount = true,
    fromAddress?: string
  ): Promise<TransferData> {
    if (!isInputAmount) {
      throw new MoverError('Unable to use output amount as an argument');
    }
    if (fromAddress === undefined) {
      throw new MoverError('1inch swapper needs `fromAddress`');
    }

    const data = await this.getSwapData({
      toTokenAddress: buyTokenAddress,
      fromTokenAddress: sellTokenAddress,
      amount: rawAmount,
      slippage,
      fromAddress: fromAddress,
      destReceived: fromAddress,
      disableEstimate: true
    });

    let swappingVia = '1inch';
    try {
      const protocolsFlattened = flattenDeep<Protocol>(data.protocols);
      const maxPartValue = Math.max(...protocolsFlattened.map((p) => p.part));
      const maxPartProtocol = protocolsFlattened.find((protocol) => protocol.part === maxPartValue);
      if (maxPartProtocol !== undefined) {
        swappingVia = maxPartProtocol.name.replaceAll('_', ' ');
      }
    } catch (error) {
      addSentryBreadcrumb({
        type: 'warning',
        category: this.sentryCategoryPrefix,
        message: 'Failed to format "swappingVia"',
        data: {
          error
        }
      });
    }

    return {
      buyAmount: data.toTokenAmount,
      data: data.tx.data,
      swappingVia,
      value: data.tx.value,
      sellAmount: data.fromTokenAmount,
      allowanceTarget: data.tx.to,
      buyTokenToEthRate: undefined,
      sellTokenToEthRate: undefined,
      to: data.tx.to
    };
  }

  public async getQuoteData(params: QuoteParams): Promise<QuoteResponse> {
    if (!this.ensureNetworkIsSupported(this.network)) {
      throw new NetworkFeatureNotSupportedError('1inch.io Swaps', this.network);
    }

    const fromTokenAddress = this.substituteAssetAddressIfNeeded(params.fromTokenAddress);
    const fromTokenSupported = await this.ensureTokenSupported(fromTokenAddress);
    if (!fromTokenSupported) {
      throw new MoverError('Input token is not supported by OneInch', {
        address: params.fromTokenAddress
      });
    }

    const toTokenAddress = this.substituteAssetAddressIfNeeded(params.toTokenAddress);
    const toTokenSupported = await this.ensureTokenSupported(toTokenAddress);
    if (!toTokenSupported) {
      throw new MoverError('Output token is not supported by OneInch', {
        address: params.toTokenAddress
      });
    }

    return (
      await this.client.get<QuoteResponse>('/quote', {
        params: {
          ...params,
          fromTokenAddress,
          toTokenAddress
        }
      })
    ).data;
  }

  public async getSwapData(params: SwapParams): Promise<SwapResponse> {
    if (!this.ensureNetworkIsSupported(this.network)) {
      throw new NetworkFeatureNotSupportedError('1inch.io Swaps', this.network);
    }

    const fromTokenAddress = this.substituteAssetAddressIfNeeded(params.fromTokenAddress);
    const fromTokenSupported = await this.ensureTokenSupported(fromTokenAddress);
    if (!fromTokenSupported) {
      throw new MoverError('Input token is not supported by OneInch', {
        address: params.fromTokenAddress
      });
    }

    const toTokenAddress = this.substituteAssetAddressIfNeeded(params.toTokenAddress);
    const toTokenSupported = await this.ensureTokenSupported(toTokenAddress);
    if (!toTokenSupported) {
      throw new MoverError('Output token is not supported by OneInch', {
        address: params.toTokenAddress
      });
    }

    return (
      await this.client.get<SwapResponse>('/swap', {
        params: {
          ...params,
          fromTokenAddress,
          toTokenAddress
        }
      })
    ).data;
  }

  protected async ensureTokenSupported(tokenAddress: string): Promise<boolean> {
    if (!this.useAvailableTokens) {
      return true;
    }

    if (sameAddress(tokenAddress, getPureBaseAssetAddress())) {
      return true;
    }

    try {
      const availableTokensMap = await this.getAvailableTokens();
      return availableTokensMap.has(tokenAddress);
    } catch (error) {
      addSentryBreadcrumb({
        type: 'warn',
        category: this.sentryCategoryPrefix,
        message: 'Failed to load available tokens. Consider token available for swap',
        data: {
          error
        }
      });

      return true;
    }
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

  protected formatBadRequestResponse(response: AxiosResponse<OneInchBadRequestResponse>): never {
    addSentryBreadcrumb({
      type: 'error',
      category: this.sentryCategoryPrefix,
      message: `Request failed with code ${response.status} (${response.statusText}): ${response.data.error}`,
      data: {
        error: response.data.error,
        description: response.data.description,
        meta: response.data.meta
      }
    });

    if (response.data.statusCode === ResponseHTTPErrorCode.BadRequest) {
      if (response.data.description === BadRequestDescription.InsufficientLiquidity) {
        throw new ExpectedError(EECode.swapInsufficientLiquidity);
      }

      if (response.data.description.startsWith(BadRequestDescription.UnsupportedToken)) {
        throw new ExpectedError(EECode.swapUnsupportedToken);
      }

      throw new MoverError(response.data.description, response.data);
    }

    throw new MoverError(response.data.description, response.data);
  }

  protected ensureNetworkIsSupported(network?: Network): boolean {
    if (network === undefined) {
      return false;
    }

    return OneInchAPIService.supportedNetworks.includes(network);
  }

  protected lookupBaseURL(network: Network): string {
    const networkInfo = getNetwork(network);
    return `https://api.1inch.io/v4.0/${networkInfo?.chainId ?? 1}`;
  }

  protected substituteAssetAddressIfNeeded(address: string): string {
    return OneInchAPIService.substituteAssetAddressIfNeeded(address);
  }

  protected static substituteAssetAddressIfNeeded(address: string): string {
    if (isBaseAsset(address)) {
      return getPureBaseAssetAddress();
    }

    return address;
  }

  public getName(): string {
    return 'OneInchAPIService';
  }
}

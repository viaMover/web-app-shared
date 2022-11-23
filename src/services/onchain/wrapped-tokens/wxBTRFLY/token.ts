import { sameAddress } from 'web-app-shared/helpers/addresses';
import {
  convertToString,
  divide,
  floorDivide,
  fromWei,
  multiply,
  sub,
  toWei
} from 'web-app-shared/helpers/bigmath';
import { InMemoryCache } from 'web-app-shared/helpers/cache';
import { addSentryBreadcrumb } from 'web-app-shared/logs/sentry';
import { WX_BTRFLY_ABI } from 'web-app-shared/references/abi';
import { getBTRFLYAssetData } from 'web-app-shared/references/assets';
import { Network } from 'web-app-shared/references/network';
import { getNetworkAddress } from 'web-app-shared/references/references';
import { SmallToken, SmallTokenInfo } from 'web-app-shared/references/tokens';
import { currentBalance } from 'web-app-shared/services/onchain/erc20/balance';
import { OnChainServiceError } from 'web-app-shared/services/onchain/OnChainServiceError';
import {
  InternalTransactionType,
  ITransactionStateEventBus,
  State
} from 'web-app-shared/services/onchain/transaction-states';
import { EstimateResponse, TransactionsParams } from 'web-app-shared/services/onchain/types';
import { WrappedToken } from 'web-app-shared/services/onchain/wrapped-tokens/WrappedToken';
import { WxBTRFLYContract } from 'web-app-shared/services/onchain/wrapped-tokens/wxBTRFLY/types';
import Web3 from 'web3';
import { TransactionReceipt } from 'web3-eth';
import { AbiItem } from 'web3-utils';

export class WrappedTokenWXBTRFLY extends WrappedToken {
  public readonly wrappedTokenAddress: string;

  public readonly unwrappedToken: SmallTokenInfo;

  public readonly contractABI = WX_BTRFLY_ABI;

  private readonly contract: WxBTRFLYContract;

  private readonly multiplierCache: InMemoryCache<string>;

  constructor(accountAddress: string, network: Network, web3: Web3) {
    super(`wrapped-token.wx-btrfl`, accountAddress, network, web3);
    this.wrappedTokenAddress = getNetworkAddress(network, 'WX_BTRFLY_TOKEN_ADDRESS');
    this.unwrappedToken = getBTRFLYAssetData(network);
    this.contract = new this.web3.eth.Contract(
      this.contractABI as AbiItem[],
      this.wrappedTokenAddress
    );

    this.multiplierCache = new InMemoryCache<string>(5 * 60, this.getRealIndex.bind(this));
  }

  public getUnwrappedToken(): SmallTokenInfo {
    return getBTRFLYAssetData(this.network);
  }

  public canHandle(assetAddress: string, network: Network): boolean {
    return network === this.network && sameAddress(this.wrappedTokenAddress, assetAddress);
  }

  public async getUnwrappedAmount(wrappedTokenAmount: string): Promise<string> {
    const mul = await this.multiplierCache.get();
    return multiply(wrappedTokenAmount, mul);
  }

  public async getWrappedAmountByUnwrapped(unwrappedTokenAmount: string): Promise<string> {
    const mul = await this.multiplierCache.get();
    return divide(unwrappedTokenAmount, mul);
  }

  public async estimateUnwrap(
    inputAsset: SmallTokenInfo,
    inputAmount: string
  ): Promise<EstimateResponse> {
    try {
      const transactionParams = {
        from: this.accountAddress
      } as TransactionsParams;

      const inputAmountInWEI = toWei(inputAmount, inputAsset.decimals);

      addSentryBreadcrumb({
        type: 'info',
        category: `${this.sentryCategoryPrefix}.estimate-unwrap`,
        message: 'input amount in WEI',
        data: {
          inputAmountInWEI
        }
      });

      addSentryBreadcrumb({
        type: 'info',
        category: `${this.sentryCategoryPrefix}.estimate-unwrap`,
        message: 'transaction params',
        data: {
          ...transactionParams
        }
      });

      const gasLimitObj = await this.contract.methods
        .unwrapToBTRFLY(inputAmountInWEI)
        .estimateGas(transactionParams);

      if (gasLimitObj) {
        const gasLimit = gasLimitObj.toString();
        const gasLimitWithBuffer = floorDivide(multiply(gasLimit, '120'), '100');

        addSentryBreadcrumb({
          type: 'info',
          category: `${this.sentryCategoryPrefix}.estimate-unwrap`,
          message: 'gas estimations',
          data: {
            gasLimit,
            gasLimitWithBuffer
          }
        });

        return { error: false, gasLimit: gasLimitWithBuffer };
      }
    } catch (error) {
      addSentryBreadcrumb({
        type: 'error',
        category: `${this.sentryCategoryPrefix}.estimate-unwrap`,
        message: 'failed to estimate top up',
        data: {
          error
        }
      });

      throw new OnChainServiceError('Failed to estimate unwrap').wrap(error);
    }

    throw new OnChainServiceError('Failed to estimate unwrap: empty gas limit');
  }

  public async unwrap(
    inputAsset: SmallToken,
    inputAmount: string,
    changeStepToProcess: () => Promise<void>,
    gasLimit: string,
    eb: ITransactionStateEventBus
  ): Promise<string> {
    const balanceBeforeUnwrap = await currentBalance(
      this.web3,
      this.accountAddress,
      this.unwrappedToken.address
    );

    await this._unwrap(inputAsset, inputAmount, changeStepToProcess, gasLimit, eb);

    const balanceAfterUnwrap = await currentBalance(
      this.web3,
      this.accountAddress,
      this.unwrappedToken.address
    );

    return sub(balanceAfterUnwrap, balanceBeforeUnwrap);
  }

  protected async _unwrap(
    inputAsset: SmallToken,
    inputAmount: string,
    changeStepToProcess: () => Promise<void>,
    gasLimit: string,
    eb: ITransactionStateEventBus
  ): Promise<TransactionReceipt> {
    const transactionParams = {
      from: this.accountAddress,
      gas: this.web3.utils.toBN(gasLimit).toNumber(),
      gasPrice: undefined,
      maxFeePerGas: null,
      maxPriorityFeePerGas: null
    } as TransactionsParams;

    const inputAmountInWEI = toWei(inputAmount, inputAsset.decimals);

    addSentryBreadcrumb({
      type: 'info',
      category: `${this.sentryCategoryPrefix}.execute-unwrap`,
      message: 'input amount in WEI',
      data: {
        inputAmountInWEI
      }
    });

    addSentryBreadcrumb({
      type: 'info',
      category: `${this.sentryCategoryPrefix}.estimate-unwrap`,
      message: 'transaction params',
      data: {
        ...transactionParams
      }
    });

    addSentryBreadcrumb({
      type: 'info',
      category: `${this.sentryCategoryPrefix}.estimate-unwrap`,
      message: 'currency'
    });

    return new Promise<TransactionReceipt>((resolve, reject) => {
      this.wrapWithSendMethodCallbacks(
        this.contract.methods.unwrapToBTRFLY(inputAmountInWEI).send(transactionParams),
        resolve,
        reject,
        (hash) => {
          eb.emit({ type: InternalTransactionType.Confirm, state: State.Succeeded });
          eb.emit({ type: InternalTransactionType.Unwrap, state: State.Pending, hash: hash });
          changeStepToProcess();
        }
      );
    });
  }

  private async getRealIndex(): Promise<string> {
    const transactionParams = {
      from: this.accountAddress
    } as TransactionsParams;

    const realIndex = await this.contract.methods.realIndex().call(transactionParams);

    const multiplierInWei = convertToString(realIndex);

    return fromWei(multiplierInWei, this.unwrappedToken.decimals);
  }
}

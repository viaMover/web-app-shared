import Web3 from 'web3';
import { TransactionReceipt } from 'web3-eth';
import { AbiItem } from 'web3-utils';

import { sameAddress } from '@/helpers/addresses';
import {
  convertToString,
  divide,
  floorDivide,
  fromWei,
  multiply,
  sub,
  toWei
} from '@/helpers/bigmath';
import { InMemoryCache } from '@/helpers/cache';
import { addSentryBreadcrumb } from '@/logs/sentry';
import { IDLE_TOKEN_ABI } from '@/references/abi';
import { Network } from '@/references/network';
import { getIdleTokenByAddress, WrapTokenData } from '@/references/specialTokens/idleTokensData';
import { SmallToken, SmallTokenInfo } from '@/references/tokens';
import { currentBalance } from '@/services/onchain/erc20/balance';
import { OnChainServiceError } from '@/services/onchain/OnChainServiceError';
import {
  InternalTransactionType,
  ITransactionStateEventBus,
  State
} from '@/services/onchain/transaction-states';
import { EstimateResponse, TransactionsParams } from '@/services/onchain/types';
import { IdleContract } from '@/services/onchain/wrapped-tokens/idle/types';
import { WrappedToken } from '@/services/onchain/wrapped-tokens/WrappedToken';

export class WrappedTokenIdle extends WrappedToken {
  private readonly wrapTokenData: WrapTokenData;

  private readonly multiplierCache: InMemoryCache<string>;

  private readonly contract: IdleContract;

  private readonly contractABI = IDLE_TOKEN_ABI;

  constructor(wrappedAssetAddress: string, accountAddress: string, network: Network, web3: Web3) {
    const idleToken = getIdleTokenByAddress(wrappedAssetAddress, network);
    if (idleToken === undefined) {
      throw new Error(`Can't find idle token by address: ${wrappedAssetAddress}`);
    }
    super(`wrapped-token.idle-token.${idleToken.wrapToken.symbol}`, accountAddress, network, web3);

    this.wrapTokenData = idleToken;

    this.contract = new this.web3.eth.Contract(
      this.contractABI as AbiItem[],
      this.wrapTokenData.wrapToken.address
    );

    this.multiplierCache = new InMemoryCache<string>(5 * 60, this.getMultiplier.bind(this));
  }

  public getUnwrappedToken(): SmallTokenInfo {
    return this.wrapTokenData.commonToken;
  }

  canHandle(assetAddress: string, network: Network): boolean {
    return (
      network === this.network && sameAddress(this.wrapTokenData.wrapToken.address, assetAddress)
    );
  }

  public async getUnwrappedAmount(wrappedTokenAmount: string): Promise<string> {
    const mul = await this.multiplierCache.get();
    return multiply(wrappedTokenAmount, mul);
  }

  public async getWrappedAmountByUnwrapped(unwrappedTokenAmount: string): Promise<string> {
    const mul = await this.multiplierCache.get();
    return divide(unwrappedTokenAmount, mul);
  }

  async estimateUnwrap(inputAsset: SmallTokenInfo, inputAmount: string): Promise<EstimateResponse> {
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
          inputAmountInWEI,
          idleName: this.wrapTokenData.name,
          idleAddress: this.wrapTokenData.wrapToken.address,
          idleCommonToken: this.wrapTokenData.commonToken.address
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
        .redeemIdleToken(inputAmountInWEI)
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

      throw new OnChainServiceError('Failed to estimate simple yearn vault unwrap').wrap(error);
    }

    throw new OnChainServiceError('Failed to estimate simple yearn vault unwrap: empty gas limit');
  }

  async unwrap(
    inputAsset: SmallToken,
    inputAmount: string,
    changeStepToProcess: () => Promise<void>,
    gasLimit: string,
    eb: ITransactionStateEventBus
  ): Promise<string> {
    const balanceBeforeUnwrap = await currentBalance(
      this.web3,
      this.accountAddress,
      this.wrapTokenData.commonToken.address
    );

    await this._unwrap(inputAsset, inputAmount, changeStepToProcess, gasLimit, eb);

    const balanceAfterUnwrap = await currentBalance(
      this.web3,
      this.accountAddress,
      this.wrapTokenData.commonToken.address
    );

    return sub(balanceAfterUnwrap, balanceBeforeUnwrap);
  }

  private async _unwrap(
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
        inputAmountInWEI,
        idleName: this.wrapTokenData.name,
        idleAddress: this.wrapTokenData.wrapToken.address,
        idleCommonToken: this.wrapTokenData.commonToken.address
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
        this.contract.methods.redeemIdleToken(inputAmountInWEI).send(transactionParams),
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

  private async getMultiplier(): Promise<string> {
    const multiplier = await this.contract.methods.tokenPriceWithFee(this.accountAddress).call({
      from: this.accountAddress
    });

    const multiplierInWei = convertToString(multiplier);

    return fromWei(multiplierInWei, this.wrapTokenData.commonToken.decimals);
  }
}

import Web3 from 'web3';
import { TransactionReceipt } from 'web3-eth';
import { AbiItem } from 'web3-utils';

import { sameAddress } from '../../../../helpers/addresses';
import { floorDivide, multiply, sub, toWei } from '../../../../helpers/bigmath';
import { asyncSleep } from '../../../../helpers/sleep';
import { addSentryBreadcrumb } from '../../../../logs/sentry';
import { AAVE_LANDING_POOL_ABI } from '../../../../references/abi';
import { Network } from '../../../../references/network';
import { getNetworkAddress } from '../../../../references/references';
import { ATokenData, getATokenByAddress } from '../../../../references/specialTokens/aTokensData';
import { SmallToken, SmallTokenInfo } from '../../../../references/tokens';
import { currentBalance } from '../../erc20/balance';
import { OnChainServiceError } from '../../OnChainServiceError';
import {
  InternalTransactionType,
  ITransactionStateEventBus,
  State
} from '../../transaction-states';
import { EstimateResponse, TransactionsParams } from '../../types';
import { WrappedToken } from '../WrappedToken';
import { AAVEPoolContract } from './types';

export class WrappedTokenAToken extends WrappedToken {
  private readonly aToken: ATokenData;

  private readonly contractABI = AAVE_LANDING_POOL_ABI;
  private readonly poolContract: AAVEPoolContract;

  constructor(wrappedAssetAddress: string, accountAddress: string, network: Network, web3: Web3) {
    const aToken = getATokenByAddress(wrappedAssetAddress, network);
    if (aToken === undefined) {
      throw new Error(`Can't find aToken by address: ${wrappedAssetAddress}`);
    }
    super(`wrapped-token.atoken.${aToken.wrapToken.symbol}`, accountAddress, network, web3);

    this.aToken = aToken;

    // pools have the same withdraw function, use the same ABI
    if (this.aToken.poolVersion === 3) {
      this.poolContract = new this.web3.eth.Contract(
        this.contractABI as AbiItem[],
        getNetworkAddress(network, 'AAVE_LANDING_POOL_V3_ADDRESS')
      );
    } else {
      this.poolContract = new this.web3.eth.Contract(
        this.contractABI as AbiItem[],
        getNetworkAddress(network, 'AAVE_LANDING_POOL_V2_ADDRESS')
      );
    }
  }

  getUnwrappedToken(): SmallTokenInfo {
    return this.aToken.commonToken;
  }

  canHandle(assetAddress: string, network: Network): boolean {
    return network === this.network && sameAddress(this.aToken.wrapToken.address, assetAddress);
  }

  public async getUnwrappedAmount(wrappedTokenAmount: string): Promise<string> {
    return wrappedTokenAmount;
  }

  public async getWrappedAmountByUnwrapped(unwrappedTokenAmount: string): Promise<string> {
    return unwrappedTokenAmount;
  }

  async estimateUnwrap(inputAsset: SmallTokenInfo, inputAmount: string): Promise<EstimateResponse> {
    try {
      const transactionParams = {
        from: this.accountAddress
      } as TransactionsParams;

      const inputAmountInWEI = toWei(inputAmount, inputAsset.decimals);

      addSentryBreadcrumb({
        level: 'info',
        category: `${this.sentryCategoryPrefix}.estimate-unwrap`,
        message: 'input amount in WEI',
        data: {
          inputAmountInWEI,
          aTokenName: this.aToken.name,
          aTokenAddress: this.aToken.wrapToken.address,
          aTokenCommonToken: this.aToken.commonToken.address
        }
      });

      addSentryBreadcrumb({
        level: 'info',
        category: `${this.sentryCategoryPrefix}.estimate-unwrap`,
        message: 'transaction params',
        data: {
          ...transactionParams
        }
      });

      const gasLimitObj = await this.poolContract.methods
        .withdraw(this.aToken.commonToken.address, inputAmountInWEI, this.accountAddress)
        .estimateGas(transactionParams);

      if (gasLimitObj) {
        const gasLimit = gasLimitObj.toString();
        const gasLimitWithBuffer = floorDivide(multiply(gasLimit, '120'), '100');

        addSentryBreadcrumb({
          level: 'info',
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
        level: 'error',
        category: `${this.sentryCategoryPrefix}.estimate-unwrap`,
        message: 'failed to estimate top up',
        data: {
          error
        }
      });

      throw new OnChainServiceError('Failed to estimate aToken unwrap').wrap(error);
    }

    throw new OnChainServiceError('Failed to estimate aToken unwrap: empty gas limit');
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
      this.aToken.commonToken.address
    );

    addSentryBreadcrumb({
      level: 'info',
      category: `${this.sentryCategoryPrefix}.execute-unwrap`,
      message: 'balanceBeforeUnwrap',
      data: {
        balanceBeforeUnwrap,
        aTokenName: this.aToken.name,
        aTokenAddress: this.aToken.wrapToken.address,
        aTokenCommonToken: this.aToken.commonToken.address
      }
    });

    await this._unwrap(inputAsset, inputAmount, changeStepToProcess, gasLimit, eb);

    await asyncSleep(60000);

    const balanceAfterUnwrap = await currentBalance(
      this.web3,
      this.accountAddress,
      this.aToken.commonToken.address
    );

    addSentryBreadcrumb({
      level: 'info',
      category: `${this.sentryCategoryPrefix}.execute-unwrap`,
      message: 'balanceAfterUnwrap',
      data: {
        balanceAfterUnwrap,
        aTokenName: this.aToken.name,
        aTokenAddress: this.aToken.wrapToken.address,
        aTokenCommonToken: this.aToken.commonToken.address
      }
    });

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
      level: 'info',
      category: `${this.sentryCategoryPrefix}.execute-unwrap`,
      message: 'input amount in WEI',
      data: {
        inputAmountInWEI,
        aTokenName: this.aToken.name,
        aTokenAddress: this.aToken.wrapToken.address,
        aTokenCommonToken: this.aToken.commonToken.address
      }
    });

    addSentryBreadcrumb({
      level: 'info',
      category: `${this.sentryCategoryPrefix}.estimate-unwrap`,
      message: 'transaction params',
      data: {
        ...transactionParams
      }
    });

    addSentryBreadcrumb({
      level: 'info',
      category: `${this.sentryCategoryPrefix}.estimate-unwrap`,
      message: 'currency'
    });

    return new Promise<TransactionReceipt>((resolve, reject) => {
      this.wrapWithSendMethodCallbacks(
        this.poolContract.methods
          .withdraw(this.aToken.commonToken.address, inputAmountInWEI, this.accountAddress)
          .send(transactionParams),
        resolve,
        reject,
        (hash) => {
          eb.emit({ type: InternalTransactionType.Confirm, state: State.Succeeded });
          eb.emit({ type: InternalTransactionType.Unwrap, state: State.Pending, hash: hash });
          changeStepToProcess();
        }
      );

      return;
    });
  }
}

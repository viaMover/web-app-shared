import { sameAddress } from 'web-app-shared/helpers/addresses';
import { floorDivide, multiply, sub, toWei } from 'web-app-shared/helpers/bigmath';
import { addSentryBreadcrumb } from 'web-app-shared/logs/sentry';
import { DCULT_ABI } from 'web-app-shared/references/abi';
import { getCULTAssetData } from 'web-app-shared/references/assets';
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
import { dCULTContract } from 'web-app-shared/services/onchain/wrapped-tokens/dCULT/types';
import { WrappedToken } from 'web-app-shared/services/onchain/wrapped-tokens/WrappedToken';
import Web3 from 'web3';
import { TransactionReceipt } from 'web3-eth';
import { AbiItem } from 'web3-utils';

export class WrappedTokenDCult extends WrappedToken {
  public readonly wrappedTokenAddress: string;

  public readonly unwrappedTokenAddress: string;

  private readonly contract: dCULTContract;

  public readonly contractABI = DCULT_ABI;

  constructor(accountAddress: string, network: Network, web3: Web3) {
    super(`wrapped-token.dcult`, accountAddress, network, web3);
    this.wrappedTokenAddress = getNetworkAddress(network, 'DCULT_TOKEN_ADDRESS');
    this.unwrappedTokenAddress = getNetworkAddress(network, 'CULT_TOKEN_ADDRESS');

    this.contract = new this.web3.eth.Contract(
      this.contractABI as AbiItem[],
      this.wrappedTokenAddress
    );
  }

  public getUnwrappedToken(): SmallTokenInfo {
    return getCULTAssetData(this.network);
  }

  public canHandle(assetAddress: string, network: Network): boolean {
    return network === this.network && sameAddress(this.wrappedTokenAddress, assetAddress);
  }

  public async getUnwrappedAmount(wrappedTokenAmount: string): Promise<string> {
    return wrappedTokenAmount;
  }

  public async getWrappedAmountByUnwrapped(unwrappedTokenAmount: string): Promise<string> {
    return unwrappedTokenAmount;
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
        .withdraw('0', inputAmountInWEI)
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
      this.unwrappedTokenAddress
    );

    await this._unwrap(inputAsset, inputAmount, changeStepToProcess, gasLimit, eb);

    const balanceAfterUnwrap = await currentBalance(
      this.web3,
      this.accountAddress,
      this.unwrappedTokenAddress
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
        this.contract.methods.withdraw('0', inputAmountInWEI).send(transactionParams),
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
}

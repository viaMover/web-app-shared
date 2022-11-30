import Web3 from 'web3';
import { TransactionReceipt } from 'web3-eth';
import { AbiItem } from 'web3-utils';

import { sameAddress } from '../../../../helpers/addresses';
import {
  convertToString,
  floorDivide,
  fromWei,
  multiply,
  sub,
  toWei
} from '../../../../helpers/bigmath';
import { addSentryBreadcrumb } from '../../../../logs/sentry';
import { GOHM_ABI, OLYMPUS_STAKING_ABI } from '../../../../references/abi';
import { getGOHMAssetData, getOHMAssetData } from '../../../../references/assets';
import { Network } from '../../../../references/network';
import { getNetworkAddress } from '../../../../references/references';
import { SmallToken, SmallTokenInfo } from '../../../../references/tokens';
import { MoverError } from '../../../MoverError';
import { currentBalance } from '../../erc20/balance';
import { OnChainServiceError } from '../../OnChainServiceError';
import {
  InternalTransactionType,
  ITransactionStateEventBus,
  State
} from '../../transaction-states';
import { EstimateResponse, TransactionsParams } from '../../types';
import { WrappedToken } from '../WrappedToken';
import { gOHMContract, OlympusStakingContract } from './types';

export class WrappedTokenGOHM extends WrappedToken {
  public readonly wrappedTokenAddress: string;
  public readonly unwrappedTokenAddress: string;
  public readonly stakingContractAddress: string;

  private readonly stakeContract: OlympusStakingContract;
  private readonly gOHMContract: gOHMContract;

  public readonly stakeContractABI = OLYMPUS_STAKING_ABI;
  public readonly gohmABI = GOHM_ABI;

  constructor(accountAddress: string, network: Network, web3: Web3) {
    super(`wrapped-token.gohm`, accountAddress, network, web3);
    if (network === Network.ethereum) {
      this.wrappedTokenAddress = getNetworkAddress(network, 'GOHM_TOKEN_ADDRESS');
      this.unwrappedTokenAddress = getNetworkAddress(network, 'OHM_V2_TOKEN_ADDRESS');
      this.stakingContractAddress = getNetworkAddress(network, 'OLYMPUS_STAKING_ADDRESS');
    } else {
      throw new MoverError('Supports gOHM only on ethereum mainnet');
    }

    this.stakeContract = new this.web3.eth.Contract(
      this.stakeContractABI as AbiItem[],
      this.stakingContractAddress
    );

    this.gOHMContract = new this.web3.eth.Contract(
      this.gohmABI as AbiItem[],
      this.wrappedTokenAddress
    );
  }

  public getUnwrappedToken(): SmallTokenInfo {
    return getOHMAssetData(this.network);
  }

  public canHandle(assetAddress: string, network: Network): boolean {
    return network === this.network && sameAddress(this.wrappedTokenAddress, assetAddress);
  }

  public async getUnwrappedAmount(wrappedTokenAmount: string): Promise<string> {
    const transactionParams = {
      from: this.accountAddress
    } as TransactionsParams;

    const wrappedTokenAmountInWei = toWei(
      wrappedTokenAmount,
      getGOHMAssetData(this.network).decimals
    );
    const amountInOHM = await this.gOHMContract.methods
      .balanceFrom(wrappedTokenAmountInWei)
      .call(transactionParams);

    return fromWei(convertToString(amountInOHM), getOHMAssetData(this.network).decimals);
  }

  public async getWrappedAmountByUnwrapped(unwrappedTokenAmount: string): Promise<string> {
    const transactionParams = {
      from: this.accountAddress
    } as TransactionsParams;

    const unwrappedTokenAmountInWei = toWei(
      unwrappedTokenAmount,
      getGOHMAssetData(this.network).decimals
    );
    const amountIngOHM = await this.gOHMContract.methods
      .balanceTo(unwrappedTokenAmountInWei)
      .call(transactionParams);

    return fromWei(convertToString(amountIngOHM), getGOHMAssetData(this.network).decimals);
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
        level: 'info',
        category: `${this.sentryCategoryPrefix}.estimate-unwrap`,
        message: 'input amount in WEI',
        data: {
          inputAmountInWEI
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

      const gasLimitObj = await this.stakeContract.methods
        .unstake(this.accountAddress, inputAmountInWEI, false, false)
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
      level: 'info',
      category: `${this.sentryCategoryPrefix}.execute-unwrap`,
      message: 'input amount in WEI',
      data: {
        inputAmountInWEI
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
        this.stakeContract.methods
          .unstake(this.accountAddress, inputAmountInWEI, false, false)
          .send(transactionParams),
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

import Web3 from 'web3';
import { TransactionReceipt } from 'web3-eth';
import { ContractSendMethod } from 'web3-eth-contract';
import { AbiItem } from 'web3-utils';

import { sameAddress } from '../../../../helpers/addresses';
import {
  convertToString,
  divide,
  floorDivide,
  fromWei,
  multiply,
  sub,
  toWei
} from '../../../../helpers/bigmath';
import { InMemoryCache } from '../../../../helpers/cache';
import { addSentryBreadcrumb } from '../../../../logs/sentry';
import { YEARN_SIMPLE_VAULT_ABI } from '../../../../references/abi';
import { Network } from '../../../../references/network';
import {
  getSimpleYearnVaultTokenByAddress,
  YearnVaultData
} from '../../../../references/specialTokens/yearnVaultsData';
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
import { YearnVaultContract } from './types';

export class WrappedTokenYearn extends WrappedToken {
  private readonly vault: YearnVaultData;

  private readonly contractABI = YEARN_SIMPLE_VAULT_ABI;

  private readonly contract: YearnVaultContract;

  private readonly multiplierCache: InMemoryCache<string>;

  constructor(wrappedAssetAddress: string, accountAddress: string, network: Network, web3: Web3) {
    const vault = getSimpleYearnVaultTokenByAddress(wrappedAssetAddress, network);
    if (vault === undefined) {
      throw new Error(`Can't find simple yearn vault by address: ${wrappedAssetAddress}`);
    }
    super(`wrapped-token.simple-yearn.${vault.vaultToken.symbol}`, accountAddress, network, web3);
    this.vault = vault;

    this.contract = new this.web3.eth.Contract(
      this.contractABI as AbiItem[],
      this.vault.vaultToken.address
    );

    this.multiplierCache = new InMemoryCache<string>(5 * 60, this.getMultiplier.bind(this));
  }

  getUnwrappedToken(): SmallTokenInfo {
    return this.vault.commonToken;
  }

  canHandle(assetAddress: string, network: Network): boolean {
    return network === this.network && sameAddress(this.vault.vaultToken.address, assetAddress);
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
        level: 'info',
        category: `${this.sentryCategoryPrefix}.estimate-unwrap`,
        message: 'input amount in WEI',
        data: {
          inputAmountInWEI,
          vaultName: this.vault.name,
          vaultAddress: this.vault.vaultToken.address,
          vaultCommonToken: this.vault.commonToken.address
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

      const gasLimitObj = await this.contract.methods
        .withdraw(inputAmountInWEI)
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
      this.vault.commonToken.address
    );

    await this._unwrap(inputAsset, inputAmount, changeStepToProcess, gasLimit, eb);

    const balanceAfterUnwrap = await currentBalance(
      this.web3,
      this.accountAddress,
      this.vault.commonToken.address
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
      level: 'info',
      category: `${this.sentryCategoryPrefix}.execute-unwrap`,
      message: 'input amount in WEI',
      data: {
        inputAmountInWEI,
        vaultName: this.vault.name,
        vaultAddress: this.vault.vaultToken.address,
        vaultCommonToken: this.vault.commonToken.address
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
        this.contract.methods.withdraw(inputAmountInWEI).send(transactionParams),
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
    const multiplier = await (this.contract.methods.pricePerShare() as ContractSendMethod).call({
      from: this.accountAddress
    });

    const multiplierInWei = convertToString(multiplier);

    return fromWei(multiplierInWei, this.vault.commonToken.decimals);
  }
}

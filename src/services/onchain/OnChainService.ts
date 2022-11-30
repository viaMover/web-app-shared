import Web3 from 'web3';
import { TransactionReceipt } from 'web3-eth';
import { ContractOptions } from 'web3-eth-contract';
import { AbiItem } from 'web3-utils';

import { getPureBaseAssetAddress } from '../../helpers/addresses';
import { floorDivide, fromWei, greaterThan, MAXUINT256, multiply } from '../../helpers/bigmath';
import { addSentryBreadcrumb } from '../../logs/sentry';
import { ERC20_ABI } from '../../references/abi';
import { Network } from '../../references/network';
import { isBaseAsset } from '../../references/references';
import { SmallTokenInfo } from '../../references/tokens';
import { TransactionInMemPoolTemplate } from '../api/mover/transactions/types';
import { EECode, ExpectedError } from '../ExpectedError';
import { NetworkFeatureNotSupportedError } from '../NetworkFeatureNotSupportedError';
import { OnChainServiceError } from './OnChainServiceError';
import { PromiEventWrapper } from './PromiEventWrapper';
import { isRejectedRequestError } from './ProviderRPCError';
import { InternalTransactionType, ITransactionStateEventBus, State } from './transaction-states';
import {
  AnyFn,
  CompoundEstimateResponse,
  CustomContractType,
  ERC20ContractMethods,
  IMemPoolTxAdder,
  TransactionsParams
} from './types';

export abstract class OnChainService extends PromiEventWrapper {
  protected readonly currentAddress: string;
  protected readonly network: Network;
  protected readonly web3Client: Web3;
  protected addMemPoolTxHandler?: IMemPoolTxAdder;

  protected constructor(
    sentryCategoryPrefix: string,
    currentAddress: string,
    network: Network,
    web3Client: Web3
  ) {
    super(sentryCategoryPrefix);
    this.currentAddress = currentAddress;
    this.network = network;
    this.web3Client = web3Client;
  }

  public setAddMemPoolTxHandler(handler: IMemPoolTxAdder): this {
    this.addMemPoolTxHandler = handler;
    return this;
  }

  protected async addMemPoolTxToLocalStorage(
    template: TransactionInMemPoolTemplate
  ): Promise<void> {
    if (this.addMemPoolTxHandler === undefined) {
      addSentryBreadcrumb({
        level: 'debug',
        category: this.sentryCategoryPrefix,
        message: 'Missing addMemPoolTxHandler. Unable to add tx to mem pool'
      });
      return;
    }

    let txNonce;
    try {
      const tx = await this.web3Client.eth.getTransaction(template.hash);
      if (tx === undefined || tx === null) {
        txNonce = 1 + (await this.web3Client.eth.getTransactionCount(this.currentAddress));
      } else {
        txNonce = tx.nonce;
      }
    } catch (error) {
      addSentryBreadcrumb({
        level: 'warning',
        category: this.sentryCategoryPrefix,
        message: 'Failed to get transaction by hash during addition of mempool tx',
        data: {
          hash: template.hash,
          error: error
        }
      });
      txNonce = 0;
    }

    this.addMemPoolTxHandler.addMemPoolTx({
      ...template,
      nonce: txNonce
    });
  }

  protected createArbitraryContract<M = void>(
    contractAddress: string,
    jsonInterface: AbiItem[] | AbiItem,
    options?: ContractOptions
  ): CustomContractType<M> | undefined {
    try {
      // the reasoning behind try/catch here is this feature of web3-eth:
      // https://web3js.readthedocs.io/en/v1.7.0/web3-eth.html#note-on-checksum-addresses
      return new this.web3Client.eth.Contract(jsonInterface, contractAddress, options);
    } catch (error) {
      addSentryBreadcrumb({
        level: 'warning',
        category: this.sentryCategoryPrefix,
        message: 'Failed to create / find Smart Contract at given address',
        data: {
          jsonInterface,
          contractAddress,
          options,
          error
        }
      });
      return undefined;
    }
  }

  protected async wrapWithSentryLogger<T extends AnyFn>(
    executor: T,
    breadcrumbPayload?: Record<string, unknown>
  ): Promise<ReturnType<T>> {
    try {
      // as each and every function is going to fail under
      // strange circumstances, it's a good idea to add a breadcrumb with some useful info beforehand
      return await executor();
    } catch (error) {
      addSentryBreadcrumb({
        level: 'error',
        category: this.sentryCategoryPrefix,
        message: 'On-chain call failed',
        data: {
          ...breadcrumbPayload,
          error
        }
      });
      throw error;
    }
  }

  protected async estimateApproveIfNeeded(
    token: SmallTokenInfo,
    amountToApprove: string,
    contractAddress: string
  ): Promise<string | undefined> {
    try {
      const needsApprove = await this.needsApprove(token, amountToApprove, contractAddress);

      if (!needsApprove) {
        return undefined;
      }
    } catch (error) {
      addSentryBreadcrumb({
        level: 'error',
        category: this.sentryCategoryPrefix,
        message: 'Failed to "needsApprove" check',
        data: {
          error,
          token,
          amountToApprove,
          contractAddress
        }
      });

      throw new OnChainServiceError('Failed "needsApprove" check').wrap(error);
    }

    addSentryBreadcrumb({
      level: 'debug',
      category: this.sentryCategoryPrefix,
      message: 'Needs approve'
    });

    try {
      return await this.estimateApprove(token.address, contractAddress);
    } catch (error) {
      addSentryBreadcrumb({
        level: 'error',
        category: this.sentryCategoryPrefix,
        message: 'Failed "approve" estimation',
        data: {
          error,
          token,
          amountToApprove,
          contractAddress
        }
      });

      throw new OnChainServiceError('Failed approve estimation').wrap(error);
    }
  }

  protected async needsApprove(
    token: SmallTokenInfo,
    amountToApprove: string,
    contractAddress: string
  ): Promise<boolean | never> {
    // Base network asset doesn't need approve to be spent by Smart Contracts
    if (isBaseAsset(token.address)) {
      return false;
    }

    const tokenContract = this.createArbitraryContract<ERC20ContractMethods>(
      token.address,
      ERC20_ABI as AbiItem[]
    );

    if (tokenContract === undefined) {
      throw new NetworkFeatureNotSupportedError(
        `ERC20 Contract on ${contractAddress}`,
        this.network
      );
    }

    try {
      const allowance = await tokenContract.methods
        .allowance(this.currentAddress, contractAddress)
        .call({
          from: contractAddress
        });

      const rawAmount = fromWei(amountToApprove, token.decimals);
      return !greaterThan(allowance, rawAmount);
    } catch (error) {
      addSentryBreadcrumb({
        level: 'error',
        category: this.sentryCategoryPrefix,
        message: 'Failed to get allowance for token',
        data: {
          token,
          amountToApprove,
          spender: contractAddress,
          owner: this.currentAddress,
          error
        }
      });

      throw new OnChainServiceError(`Failed to get allowance for token: ${token.address}`, {
        token,
        contractAddress
      }).wrap(error);
    }
  }

  protected async approveCompound(
    tokenAddress: string,
    spenderAddress: string,
    amountInWei: string,
    changeStepToProcess: () => Promise<void>,
    eb: ITransactionStateEventBus,
    skipApproveEventClosing: boolean
  ): Promise<TransactionReceipt> {
    const gasLimit = await this.estimateApprove(tokenAddress, spenderAddress, amountInWei);

    return this.approve(
      tokenAddress,
      spenderAddress,
      changeStepToProcess,
      gasLimit,
      amountInWei,
      eb,
      skipApproveEventClosing
    );
  }

  private async estimateApprove(
    tokenAddress: string,
    spenderAddress: string,
    amountInWei = MAXUINT256
  ): Promise<string | never> {
    const tokenContract = this.createArbitraryContract<ERC20ContractMethods>(
      tokenAddress,
      ERC20_ABI as AbiItem[]
    );

    if (tokenContract === undefined) {
      throw new NetworkFeatureNotSupportedError(`ERC20 Contract on ${tokenAddress}`, this.network);
    }

    try {
      const gasLimit = await tokenContract.methods
        .approve(spenderAddress, amountInWei)
        .estimateGas({
          from: this.currentAddress
        });

      if (gasLimit) {
        return this.addGasBuffer(gasLimit.toString());
      }
    } catch (error) {
      addSentryBreadcrumb({
        level: 'error',
        category: this.sentryCategoryPrefix,
        message: 'Failed to estimate approve',
        data: {
          tokenAddress,
          spenderAddress,
          error
        }
      });

      throw new OnChainServiceError(`Failed to estimate approve for ${tokenAddress}`).wrap(error);
    }

    throw new OnChainServiceError(
      `Failed to estimate approve for ${tokenAddress}: empty gas limit`
    );
  }

  protected async approve(
    tokenAddress: string,
    spenderAddress: string,
    onApproveHash: (hash: string) => void,
    gasLimit: string,
    amountInWei = MAXUINT256,
    eb: ITransactionStateEventBus,
    skipApproveEventClosing = false
  ): Promise<TransactionReceipt> {
    return new Promise((resolve, reject) => {
      const tokenContract = this.createArbitraryContract<ERC20ContractMethods>(
        tokenAddress,
        ERC20_ABI as AbiItem[]
      );

      if (tokenContract === undefined) {
        throw new NetworkFeatureNotSupportedError(
          `ERC20 Contract on ${tokenAddress}`,
          this.network
        );
      }

      try {
        if (!skipApproveEventClosing) {
          eb.emit({
            type: InternalTransactionType.Confirm,
            state: State.Pending
          });
        }
        this.wrapWithSendMethodCallbacks(
          tokenContract.methods
            .approve(spenderAddress, amountInWei)
            .send(this.getDefaultTransactionsParams(gasLimit, undefined)),
          (receipt) => {
            if (!skipApproveEventClosing) {
              eb.emit({
                type: InternalTransactionType.Approve,
                state: State.Succeeded,
                hash: receipt.transactionHash
              });
            }
            resolve(receipt);
          },
          reject,
          (hash) => {
            eb.emit({
              type: InternalTransactionType.Confirm,
              state: State.Succeeded
            });
            eb.emit({
              type: InternalTransactionType.Approve,
              state: State.Pending
            });
            onApproveHash(hash);
          },
          { tokenAddress, spenderAddress, gasLimit }
        );
      } catch (error) {
        addSentryBreadcrumb({
          level: 'error',
          category: this.sentryCategoryPrefix,
          message: 'Failed to approve',
          data: {
            tokenAddress,
            spenderAddress,
            gasLimit,
            error
          }
        });

        reject(
          new OnChainServiceError(`Failed to execute approve for ${tokenAddress}`).wrap(error)
        );
      }
    });
  }

  protected async executeTransactionWithApprove(
    token: SmallTokenInfo,
    contractAddress: string,
    amount: string,
    action: (newGasLimit: string) => Promise<TransactionReceipt>,
    estimateHandler: () => Promise<CompoundEstimateResponse>,
    onApproveHash: (hash: string) => void,
    approveGasLimit: string,
    actionGasLimit: string,
    eb: ITransactionStateEventBus
  ): Promise<TransactionReceipt | never> {
    let newActionGasLimit = actionGasLimit;
    if (await this.needsApprove(token, amount, contractAddress)) {
      const approveTxReceipt = await this.approve(
        token.address,
        contractAddress,
        onApproveHash,
        approveGasLimit,
        undefined,
        eb
      );

      try {
        // estimate transaction once more to get exact gas limit
        // and prevent expensive transactions and out of gas
        // reverts
        const estimation = await estimateHandler();

        addSentryBreadcrumb({
          level: 'debug',
          message: 'Estimated transaction after approve',
          data: {
            oldGasLimit: actionGasLimit,
            newGasLimit: estimation.actionGasLimit,
            approveTxHash: approveTxReceipt.transactionHash
          }
        });

        newActionGasLimit = estimation.actionGasLimit;
      } catch (error) {
        throw new OnChainServiceError('Failed to estimate transaction after approve', {
          approveTxReceipt
        }).wrap(error);
      }
    }

    return action(newActionGasLimit);
  }

  protected substituteAssetAddressIfNeeded(address: string): string {
    return OnChainService.substituteAssetAddressIfNeeded(address);
  }

  protected static substituteAssetAddressIfNeeded(address: string): string {
    if (isBaseAsset(address)) {
      return getPureBaseAssetAddress();
    }

    return address;
  }

  protected getDefaultTransactionsParams(gasLimit: string, value?: string): TransactionsParams {
    return OnChainService.getDefaultTransactionsParams(
      this.currentAddress,
      this.web3Client,
      gasLimit,
      value
    );
  }

  protected static getDefaultTransactionsParams(
    fromAddress: string,
    web3Client: Web3,
    gasLimit: string,
    value?: string
  ): TransactionsParams {
    return {
      from: fromAddress,
      value,
      gas: web3Client.utils.toBN(gasLimit).toNumber(),
      gasPrice: undefined,
      maxFeePerGas: null,
      maxPriorityFeePerGas: null
    };
  }

  protected addGasBuffer(gas: string | number, buffer = '120'): string {
    return OnChainService.addGasBuffer(gas, buffer);
  }

  protected static addGasBuffer(gas: string | number, buffer = '120'): string {
    return floorDivide(multiply(gas, buffer), '100');
  }

  protected rethrowIfUserRejectedRequest(
    error: unknown,
    errorCode: EECode = EECode.userRejectTransaction
  ): void | never {
    if (isRejectedRequestError(error)) {
      throw new ExpectedError(errorCode);
    }
  }
}

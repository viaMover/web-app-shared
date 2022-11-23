import dayjs from 'dayjs';
import Web3 from 'web3';
import { TransactionReceipt } from 'web3-eth';

import { sameAddress } from '@/helpers/addresses';
import { clampLeft, getInteger, multiply, sub, toWei } from '@/helpers/bigmath';
import { asyncSleep } from '@/helpers/sleep';
import { addSentryBreadcrumb } from '@/logs/sentry';
import { getCentralTransferProxyAbi } from '@/references/abi';
import { getUSDCAssetData } from '@/references/assets';
import { gasDefaults } from '@/references/gasDefaults';
import { Network } from '@/references/network';
import { getNetwork, getNetworkAddress } from '@/references/references';
import { SmallTokenInfo, Token } from '@/references/tokens';
import {
  DepositExecution,
  DepositOnlyTransactionData,
  DepositTransactionData,
  DepositWithBridgeTransactionData,
  isDepositWithBridgeTransactionData,
  isWithdrawComplexTransactionData,
  WithdrawExecution,
  WithdrawOnlyTransactionData,
  WithdrawTransactionData
} from '@/services/api/mover/savings-plus/types';
import { TransactionStatus } from '@/services/api/mover/subsidized/types';
import { TransactionDirection, TransactionType } from '@/services/api/mover/transactions/types';
import { TransferData } from '@/services/api/swap/types';
import { EECode } from '@/services/ExpectedError';
import { MoverError } from '@/services/MoverError';
import { NetworkFeatureNotSupportedError } from '@/services/NetworkFeatureNotSupportedError';
import { MoverOnChainService } from '@/services/onchain/mover/MoverOnChainService';
import { InvalidNetworkForOperationError } from '@/services/onchain/mover/savings-plus/InvalidNetworkForOperationError';
import { PreparedAction } from '@/services/onchain/mover/subsidized/types';
import { TransferProxyContract } from '@/services/onchain/mover/types';
import { OnChainServiceError } from '@/services/onchain/OnChainServiceError';
import {
  InternalTransactionType,
  ITransactionStateEventBus,
  State,
  TransactionScenario,
  TransactionStateItem
} from '@/services/onchain/transaction-states';
import { CompoundEstimateResponse } from '@/services/onchain/types';

export class SavingsPlusOnChainService extends MoverOnChainService {
  protected readonly centralTransferProxyContract: TransferProxyContract | undefined;

  protected readonly usdcAssetData: SmallTokenInfo;

  protected static MintMultiplier = 0.995;

  protected static DyMultiplier = 0.98;

  constructor(currentAddress: string, network: Network, web3Client: Web3) {
    super('savings-plus.on-chain.service', currentAddress, network, web3Client);

    this.centralTransferProxyContract = this.createContract(
      'TRANSFER_PROXY_ADDRESS',
      getCentralTransferProxyAbi(network)
    );
    this.usdcAssetData = getUSDCAssetData(network);
  }

  public async explainDepositCompound(
    inputAsset: Token,
    swapTarget: Token,
    inputAmount: string,
    execution: DepositExecution
  ): Promise<TransactionScenario> {
    let index = 0;
    const steps = new Array<TransactionStateItem>();
    const isApproveNeeded = await this.needsApprove(
      inputAsset,
      inputAmount,
      getNetworkAddress(this.network, 'TRANSFER_PROXY_ADDRESS')
    );

    if (isApproveNeeded) {
      steps.push({
        index: index++,
        type: InternalTransactionType.Confirm,
        state: State.Queued,
        estimation: 0,
        token: inputAsset,
        network: inputAsset.network,
        timestamp: 0
      });

      steps.push({
        index: index++,
        type: InternalTransactionType.Approve,
        state: State.Queued,
        estimation: 15,
        token: inputAsset,
        network: inputAsset.network,
        timestamp: 0
      });
    }

    const isSwapNeeded = !sameAddress(inputAsset.address, swapTarget.address);

    steps.push({
      index: index++,
      type: InternalTransactionType.Confirm,
      state: State.Queued,
      estimation: 0,
      token: inputAsset,
      network: inputAsset.network,
      timestamp: 0
    });

    if (isSwapNeeded) {
      steps.push({
        index: index++,
        type: InternalTransactionType.Swap,
        state: State.Queued,
        estimation: 15,
        token: inputAsset,
        network: inputAsset.network,
        timestamp: 0
      });
    }

    if (execution === DepositExecution.Bridged) {
      steps.push({
        index: index++,
        type: InternalTransactionType.Bridge,
        state: State.Queued,
        estimation: 5 * 60,
        token: swapTarget,
        network: inputAsset.network,
        timestamp: 0
      });

      steps.push({
        index: index++,
        type: InternalTransactionType.Deposit,
        state: State.Queued,
        estimation: 2 * 60,
        token: swapTarget,
        network: Network.polygon,
        timestamp: 0
      });
    } else {
      steps.push({
        index: index++,
        type: InternalTransactionType.Deposit,
        state: State.Queued,
        estimation: 15,
        token: swapTarget,
        network: Network.polygon,
        timestamp: 0
      });
    }

    return {
      toNetwork: Network.polygon,
      startNetwork: inputAsset.network,
      type: TransactionType.SavingsPlusDeposit,
      steps: steps
    };
  }

  public async estimateDepositCompound(
    inputAsset: SmallTokenInfo,
    outputAsset: SmallTokenInfo,
    inputAmount: string,
    transferData: TransferData | undefined,
    depositData: DepositTransactionData | undefined
  ): Promise<CompoundEstimateResponse> {
    if (!this.isValidUSDCishToken(outputAsset.address)) {
      throw new OnChainServiceError(
        'Wrong token supplied to estimateDepositCompound(). outputAsset is not USDC-ish',
        {
          inputAsset,
          outputAsset
        }
      );
    }

    if (depositData === undefined) {
      throw new OnChainServiceError('Failed to estimate deposit: missing depositData');
    }

    if (!sameAddress(inputAsset.address, outputAsset.address) && transferData === undefined) {
      throw new OnChainServiceError('Failed to estimate deposit: missing transferData');
    }

    const approveGasLimit = await this.estimateApproveIfNeeded(
      inputAsset,
      inputAmount,
      getNetworkAddress(this.network, 'TRANSFER_PROXY_ADDRESS')
    );

    if (approveGasLimit !== undefined) {
      return {
        approveGasLimit,
        actionGasLimit: gasDefaults.basic_savings_plus_deposit
      };
    }

    try {
      if (isDepositWithBridgeTransactionData(depositData)) {
        addSentryBreadcrumb({
          type: 'debug',
          category: this.sentryCategoryPrefix,
          message: 'Needs bridge. Will estimateDepositWithBridge',
          data: {
            inputAsset,
            outputAsset,
            transferData,
            depositData
          }
        });

        return await this.estimateDepositWithBridge(
          inputAsset,
          outputAsset,
          inputAmount,
          transferData,
          depositData
        );
      }

      addSentryBreadcrumb({
        type: 'debug',
        category: this.sentryCategoryPrefix,
        message: 'Does not need bridge. Will estimateDeposit',
        data: {
          inputAsset,
          outputAsset,
          transferData,
          depositData
        }
      });

      return await this.estimateDeposit(
        inputAsset,
        outputAsset,
        inputAmount,
        transferData,
        depositData
      );
    } catch (error) {
      addSentryBreadcrumb({
        type: 'error',
        category: this.sentryCategoryPrefix,
        message: 'Failed to estimate deposit',
        data: {
          error,
          inputAsset,
          outputAsset,
          inputAmount,
          transferData,
          depositData
        }
      });

      throw new OnChainServiceError('Failed to estimate deposit').wrap(error);
    }
  }

  public async depositCompound(
    inputAsset: SmallTokenInfo,
    outputAsset: SmallTokenInfo,
    inputAmount: string,
    transferData: TransferData | undefined,
    depositData: DepositTransactionData,
    onTransactionHash: (hash: string) => void,
    actionGasLimit: string,
    approveGasLimit: string,
    eb: ITransactionStateEventBus
  ): Promise<TransactionReceipt> {
    if (!this.isValidUSDCishToken(outputAsset.address)) {
      throw new OnChainServiceError(
        'Wrong token supplied to depositCompound(). outputAsset is not USDC-ish',
        {
          inputAsset,
          outputAsset
        }
      );
    }

    if (depositData === undefined) {
      throw new OnChainServiceError('Failed to deposit: missing depositData');
    }

    if (!sameAddress(inputAsset.address, outputAsset.address) && transferData === undefined) {
      throw new OnChainServiceError('Failed to deposit: missing transferData');
    }

    try {
      return await this.executeTransactionWithApprove(
        inputAsset,
        getNetworkAddress(this.network, 'TRANSFER_PROXY_ADDRESS'),
        inputAmount,
        (newGasLimit) => {
          if (isDepositWithBridgeTransactionData(depositData)) {
            addSentryBreadcrumb({
              type: 'debug',
              category: this.sentryCategoryPrefix,
              message: 'Needs bridge. Will depositWithBridge',
              data: {
                inputAsset,
                outputAsset,
                transferData,
                depositData
              }
            });

            return this.depositWithBridge(
              inputAsset,
              outputAsset,
              inputAmount,
              transferData,
              depositData,
              onTransactionHash,
              newGasLimit,
              eb
            );
          }

          addSentryBreadcrumb({
            type: 'debug',
            category: this.sentryCategoryPrefix,
            message: 'Does not need bridge. Will deposit',
            data: {
              inputAsset,
              outputAsset,
              transferData,
              depositData
            }
          });

          return this.deposit(
            inputAsset,
            inputAmount,
            transferData,
            depositData,
            onTransactionHash,
            newGasLimit,
            eb
          );
        },
        () =>
          this.estimateDepositCompound(
            inputAsset,
            outputAsset,
            inputAmount,
            transferData,
            depositData
          ),
        async () => {
          //
        },
        approveGasLimit,
        actionGasLimit,
        eb
      );
    } catch (error) {
      eb.fail(error);
      this.rethrowIfUserRejectedRequest(error);

      addSentryBreadcrumb({
        type: 'error',
        category: this.sentryCategoryPrefix,
        message: 'Failed to deposit',
        data: {
          error,
          inputAsset,
          outputAsset,
          inputAmount,
          transferData,
          depositData,
          actionGasLimit,
          approveGasLimit
        }
      });

      throw new OnChainServiceError('Failed to deposit').wrap(error);
    }
  }

  public async explainWithdrawCompound(
    outputAsset: Token,
    withdrawToNetwork: Network,
    execution: WithdrawExecution
  ): Promise<TransactionScenario> {
    let index = 0;
    const steps = new Array<TransactionStateItem>();

    steps.push({
      index: index++,
      type: InternalTransactionType.Confirm,
      state: State.Queued,
      estimation: 0,
      token: outputAsset,
      network: Network.polygon,
      timestamp: 0
    });

    if (execution === WithdrawExecution.Bridged) {
      steps.push({
        index: index++,
        type: InternalTransactionType.Bridge,
        state: State.Queued,
        estimation: 5 * 60,
        token: outputAsset,
        network: Network.polygon,
        timestamp: 0
      });

      steps.push({
        index: index++,
        type: InternalTransactionType.Withdraw,
        state: State.Queued,
        estimation: 2 * 60,
        token: outputAsset,
        network: withdrawToNetwork,
        timestamp: 0
      });
    } else {
      steps.push({
        index: index++,
        type: InternalTransactionType.Withdraw,
        state: State.Queued,
        estimation: 15,
        token: outputAsset,
        network: withdrawToNetwork,
        timestamp: 0
      });
    }

    return {
      toNetwork: withdrawToNetwork,
      startNetwork: Network.polygon,
      type: TransactionType.SavingsPlusWithdraw,
      steps: steps
    };
  }

  public async estimateWithdrawCompound(
    outputAsset: SmallTokenInfo,
    outputAmount: string,
    withdrawToNetwork: Network,
    withdrawData?: WithdrawTransactionData
  ): Promise<CompoundEstimateResponse> {
    if (!this.isValidUSDCishToken(outputAsset.address)) {
      throw new OnChainServiceError(
        'Wrong token supplied to estimateWithdrawCompound(). Output asset must be USDC-ish',
        {
          outputAsset
        }
      );
    }

    if (withdrawData === undefined) {
      throw new OnChainServiceError('Failed to estimate withdraw: missing withdrawData');
    }

    if (isWithdrawComplexTransactionData(withdrawData)) {
      addSentryBreadcrumb({
        type: 'debug',
        category: this.sentryCategoryPrefix,
        message: 'Execution is planned in another network. No need to estimate',
        data: {
          fromNetwork: this.network,
          toNetwork: withdrawToNetwork,
          transactionData: withdrawData
        }
      });
      return { approveGasLimit: '0', actionGasLimit: '0' };
    }

    // if the withdrawToNetwork is the one where S+ exists,
    // and it is expected to be on-chain TX but current network
    // is not the target network
    if (this.network !== withdrawToNetwork) {
      throw new InvalidNetworkForOperationError(this.network, withdrawToNetwork);
    }

    addSentryBreadcrumb({
      type: 'debug',
      category: this.sentryCategoryPrefix,
      message: 'Execution is planned in current network',
      data: {
        transactionData: withdrawData
      }
    });

    if (this.centralTransferProxyContract === undefined) {
      throw new NetworkFeatureNotSupportedError('Savings Plus withdraw', this.network);
    }

    try {
      const gasLimit = await this.centralTransferProxyContract.methods
        .withdrawFromPool(
          withdrawData.withdrawPoolAddress,
          toWei(outputAmount, outputAsset.decimals)
        )
        .estimateGas({ from: this.currentAddress });

      return {
        approveGasLimit: '0',
        actionGasLimit: this.addGasBuffer(gasLimit)
      };
    } catch (error) {
      addSentryBreadcrumb({
        type: 'error',
        category: this.sentryCategoryPrefix,
        message: 'Failed to estimate withdraw',
        data: {
          error,
          outputAsset,
          outputAmount,
          withdrawData
        }
      });

      throw new OnChainServiceError('Failed to estimate withdraw').wrap(error);
    }
  }

  public async withdrawCompound(
    outputAsset: SmallTokenInfo,
    outputAmount: string,
    withdrawToNetwork: Network,
    onTransactionHash: (hash: string) => void,
    withdrawData: WithdrawTransactionData | undefined,
    gasLimit: string,
    eb: ITransactionStateEventBus
  ): Promise<TransactionReceipt | undefined> {
    if (!this.isValidUSDCishToken(outputAsset.address)) {
      throw new OnChainServiceError(
        'Wrong token supplied to withdrawCompound(). Output asset must be USDC-ish',
        {
          outputAsset
        }
      );
    }

    if (withdrawData === undefined) {
      throw new OnChainServiceError('Failed to withdraw: missing withdrawData');
    }

    if (isWithdrawComplexTransactionData(withdrawData)) {
      addSentryBreadcrumb({
        type: 'debug',
        category: this.sentryCategoryPrefix,
        message: 'Execution is planned in another network',
        data: {
          fromNetwork: this.network,
          toNetwork: withdrawToNetwork,
          transactionData: withdrawData
        }
      });

      try {
        return await this.withdrawComplex(
          outputAsset,
          outputAmount,
          withdrawToNetwork,
          onTransactionHash,
          eb
        );
      } catch (error) {
        eb.fail(error);
        this.rethrowIfUserRejectedRequest(error, EECode.userRejectSign);

        addSentryBreadcrumb({
          type: 'error',
          category: this.sentryCategoryPrefix,
          message: 'Failed to withdraw (backend execution failed)',
          data: {
            error,
            outputAsset,
            outputAmount,
            withdrawToNetwork,
            withdrawData,
            gasLimit
          }
        });

        throw new OnChainServiceError('Failed to withdraw').wrap(error);
      }
    }

    if (this.network !== withdrawToNetwork) {
      throw new InvalidNetworkForOperationError(this.network, withdrawToNetwork);
    }

    if (gasLimit === undefined) {
      throw new OnChainServiceError(
        'Failed to withdraw: Transaction should be executed in the same bridge but no gasLimit provided',
        {
          network: this.network
        }
      );
    }

    addSentryBreadcrumb({
      type: 'debug',
      category: this.sentryCategoryPrefix,
      message: 'Execution is planned in current network',
      data: {
        outputAsset,
        outputAmount,
        gasLimit,
        transactionData: withdrawData
      }
    });

    try {
      return await this.withdraw(
        outputAsset,
        outputAmount,
        withdrawData,
        onTransactionHash,
        gasLimit,
        eb
      );
    } catch (error) {
      eb.fail(error);
      this.rethrowIfUserRejectedRequest(error);

      addSentryBreadcrumb({
        type: 'error',
        category: this.sentryCategoryPrefix,
        message: 'Failed to withdraw (same network tx execution failed)',
        data: {
          error,
          outputAsset,
          outputAmount,
          withdrawToNetwork,
          withdrawData,
          gasLimit
        }
      });

      throw new OnChainServiceError('Failed to withdraw').wrap(error);
    }
  }

  protected async estimateDeposit(
    inputAsset: SmallTokenInfo,
    outputAsset: SmallTokenInfo,
    inputAmount: string,
    transferData: TransferData | undefined,
    depositData: DepositTransactionData
  ): Promise<CompoundEstimateResponse> {
    if (this.centralTransferProxyContract === undefined) {
      throw new NetworkFeatureNotSupportedError('Savings Plus deposit', this.network);
    }

    if (isDepositWithBridgeTransactionData(depositData)) {
      throw new OnChainServiceError('Wrong transaction data passed to estimateDeposit()', {
        depositData
      });
    }

    const gasLimitObj = await this.centralTransferProxyContract.methods
      .depositToPool(
        depositData.depositPoolAddress,
        this.substituteAssetAddressIfNeeded(inputAsset.address),
        toWei(inputAmount, inputAsset.decimals),
        this.mapTransferDataToExpectedMinimumAmount(transferData),
        this.mapTransferDataToBytes(transferData)
      )
      .estimateGas({
        from: this.currentAddress,
        value: this.mapTransferDataToValue(transferData)
      });

    return {
      approveGasLimit: '0',
      actionGasLimit: this.addGasBuffer(gasLimitObj.toString())
    };
  }

  protected async estimateDepositWithBridge(
    inputAsset: SmallTokenInfo,
    outputAsset: SmallTokenInfo,
    inputAmount: string,
    transferData: TransferData | undefined,
    depositData: DepositWithBridgeTransactionData
  ): Promise<CompoundEstimateResponse> {
    if (this.centralTransferProxyContract === undefined) {
      throw new NetworkFeatureNotSupportedError('Savings Plus deposit', this.network);
    }

    if (transferData === undefined) {
      addSentryBreadcrumb({
        type: 'debug',
        category: this.sentryCategoryPrefix,
        message: 'transferData is undefined. Estimate bridgeAsset instead of swapBridgeAsset',
        data: {
          inputAsset,
          outputAsset,
          transferData,
          depositData
        }
      });

      const gasLimitObj = await this.centralTransferProxyContract.methods
        .bridgeAsset(
          this.substituteAssetAddressIfNeeded(outputAsset.address),
          toWei(inputAmount, inputAsset.decimals),
          this.mapDepositDataToBytes(depositData),
          depositData.targetChainRelay
        )
        .estimateGas({ from: this.currentAddress });

      return {
        approveGasLimit: '0',
        actionGasLimit: this.addGasBuffer(gasLimitObj.toString())
      };
    }

    addSentryBreadcrumb({
      type: 'debug',
      category: this.sentryCategoryPrefix,
      message:
        'transferData is not undefined so additional swap is needed. Estimate swapBridgeAsset instead of bridgeAsset',
      data: {
        inputAsset,
        outputAsset,
        transferData,
        depositData
      }
    });

    if (this.network === Network.ethereum) {
      const additionalParams = this.mapAdditionalSwapBridgeParams(transferData, depositData);

      addSentryBreadcrumb({
        type: 'debug',
        category: this.sentryCategoryPrefix,
        message: 'Using different signature with minToMint and minDy as current network is mainnet',
        data: additionalParams
      });

      const gasLimitObj = await this.centralTransferProxyContract.methods
        .swapBridgeAsset(
          this.substituteAssetAddressIfNeeded(inputAsset.address),
          outputAsset.address,
          toWei(inputAmount, inputAsset.decimals),
          additionalParams._expectedMinimumReceived,
          this.mapTransferDataToBytes(transferData),
          this.mapDepositDataToBytes(depositData),
          depositData.targetChainRelay,
          additionalParams._minToMint,
          additionalParams._minDy
        )
        .estimateGas({
          from: this.currentAddress,
          value: this.mapTransferDataToValue(transferData)
        });

      return {
        approveGasLimit: '0',
        actionGasLimit: this.addGasBuffer(gasLimitObj.toString())
      };
    }

    const gasLimitObj = await this.centralTransferProxyContract.methods
      .swapBridgeAsset(
        this.substituteAssetAddressIfNeeded(inputAsset.address),
        outputAsset.address,
        toWei(inputAmount, inputAsset.decimals),
        this.mapTransferDataToExpectedMinimumAmount(transferData),
        this.mapTransferDataToBytes(transferData),
        this.mapDepositDataToBytes(depositData),
        depositData.targetChainRelay
      )
      .estimateGas({
        from: this.currentAddress,
        value: this.mapTransferDataToValue(transferData)
      });

    return {
      approveGasLimit: '0',
      actionGasLimit: this.addGasBuffer(gasLimitObj.toString())
    };
  }

  protected async deposit(
    inputAsset: SmallTokenInfo,
    inputAmount: string,
    transferData: TransferData | undefined,
    depositData: DepositOnlyTransactionData,
    onTransactionHash: (hash: string) => void,
    gasLimit: string,
    eb: ITransactionStateEventBus
  ): Promise<TransactionReceipt> {
    return new Promise<TransactionReceipt>((resolve, reject) => {
      if (this.centralTransferProxyContract === undefined) {
        throw new NetworkFeatureNotSupportedError('Savings Plus deposit', this.network);
      }

      eb.emit({
        type: InternalTransactionType.Confirm,
        state: State.Pending
      });
      this.wrapWithSendMethodCallbacks(
        this.centralTransferProxyContract.methods
          .depositToPool(
            depositData.depositPoolAddress,
            this.substituteAssetAddressIfNeeded(inputAsset.address),
            toWei(inputAmount, inputAsset.decimals),
            this.mapTransferDataToExpectedMinimumAmount(transferData),
            this.mapTransferDataToBytes(transferData)
          )
          .send(
            this.getDefaultTransactionsParams(gasLimit, this.mapTransferDataToValue(transferData))
          ),
        (receipt) => {
          eb.emit({
            type: InternalTransactionType.Deposit,
            state: State.Succeeded,
            hash: receipt.transactionHash
          });
          resolve(receipt);
        },
        reject,
        async (hash) => {
          await this.addMemPoolTxToLocalStorage({
            internalType: TransactionType.SavingsPlusDeposit,
            token: getUSDCAssetData(this.network),
            network: this.network,
            amount: inputAmount,
            timestamp: dayjs().unix(),
            direction: TransactionDirection.Out,
            hash: hash,
            toAddress: getNetworkAddress(this.network, 'TRANSFER_PROXY_ADDRESS')
          });
          eb.emit({
            type: InternalTransactionType.Deposit,
            state: State.Pending,
            hash: hash
          });
          onTransactionHash(hash);
        }
      );
    });
  }

  protected async depositWithBridge(
    inputAsset: SmallTokenInfo,
    outputAsset: SmallTokenInfo,
    inputAmount: string,
    transferData: TransferData | undefined,
    depositData: DepositWithBridgeTransactionData,
    onTransactionHash: (hash: string) => void,
    gasLimit: string,
    eb: ITransactionStateEventBus
  ): Promise<TransactionReceipt> {
    return new Promise<TransactionReceipt>((resolve, reject) => {
      if (this.centralTransferProxyContract === undefined) {
        throw new NetworkFeatureNotSupportedError('Savings Plus deposit', this.network);
      }

      if (transferData === undefined) {
        addSentryBreadcrumb({
          type: 'debug',
          category: this.sentryCategoryPrefix,
          message: 'transferData is undefined. Execute bridgeAsset instead of swapBridgeAsset',
          data: {
            inputAsset,
            outputAsset,
            transferData,
            depositData
          }
        });

        eb.emit({
          type: InternalTransactionType.Confirm,
          state: State.Pending
        });
        this.wrapWithSendMethodCallbacks(
          this.centralTransferProxyContract.methods
            .bridgeAsset(
              this.substituteAssetAddressIfNeeded(outputAsset.address),
              toWei(inputAmount, inputAsset.decimals),
              this.mapDepositDataToBytes(depositData),
              depositData.targetChainRelay
            )
            .send(this.getDefaultTransactionsParams(gasLimit)),
          resolve,
          reject,
          async (hash) => {
            await this.addMemPoolTxToLocalStorage({
              internalType: TransactionType.SavingsPlusDeposit,
              token: getUSDCAssetData(this.network),
              network: this.network,
              amount: inputAmount,
              timestamp: dayjs().unix(),
              direction: TransactionDirection.Out,
              hash: hash,
              toAddress: getNetworkAddress(this.network, 'TRANSFER_PROXY_ADDRESS')
            });
            eb.emit({
              type: InternalTransactionType.Confirm,
              state: State.Succeeded
            });
            eb.emit({
              type: InternalTransactionType.Bridge,
              state: State.Pending,
              hash: hash
            });
            onTransactionHash(hash);
          }
        );

        return;
      }

      addSentryBreadcrumb({
        type: 'debug',
        category: this.sentryCategoryPrefix,
        message:
          'transferData is not undefined so additional swap is needed. Execute swapBridgeAsset instead of bridgeAsset',
        data: {
          inputAsset,
          outputAsset,
          transferData,
          depositData
        }
      });

      if (this.network === Network.ethereum) {
        const additionalParams = this.mapAdditionalSwapBridgeParams(transferData, depositData);

        addSentryBreadcrumb({
          type: 'debug',
          category: this.sentryCategoryPrefix,
          message:
            'Using different signature with minToMint and minDy as current network is mainnet',
          data: additionalParams
        });

        eb.emit({
          type: InternalTransactionType.Confirm,
          state: State.Pending
        });
        this.wrapWithSendMethodCallbacks(
          this.centralTransferProxyContract.methods
            .swapBridgeAsset(
              this.substituteAssetAddressIfNeeded(inputAsset.address),
              this.substituteAssetAddressIfNeeded(outputAsset.address),
              toWei(inputAmount, inputAsset.decimals),
              additionalParams._expectedMinimumReceived,
              this.mapTransferDataToBytes(transferData),
              this.mapDepositDataToBytes(depositData),
              depositData.targetChainRelay,
              additionalParams._minToMint,
              additionalParams._minDy
            )
            .send(
              this.getDefaultTransactionsParams(gasLimit, this.mapTransferDataToValue(transferData))
            ),
          (receipt) => {
            eb.emit({
              type: InternalTransactionType.Swap,
              state: State.Succeeded,
              hash: receipt.transactionHash
            });
            eb.emit({
              type: InternalTransactionType.Bridge,
              state: State.Pending,
              hash: receipt.transactionHash
            });
            resolve(receipt);
          },
          reject,
          async (hash) => {
            await this.addMemPoolTxToLocalStorage({
              internalType: TransactionType.SavingsPlusDeposit,
              token: getUSDCAssetData(this.network),
              network: this.network,
              amount: inputAmount,
              timestamp: dayjs().unix(),
              direction: TransactionDirection.Out,
              hash: hash,
              toAddress: getNetworkAddress(this.network, 'TRANSFER_PROXY_ADDRESS')
            });

            eb.emit({
              type: InternalTransactionType.Confirm,
              state: State.Succeeded
            });
            eb.emit({
              type: InternalTransactionType.Swap,
              state: State.Pending,
              hash: hash
            });
            onTransactionHash(hash);
          }
        );
        return;
      }

      eb.emit({
        type: InternalTransactionType.Confirm,
        state: State.Pending
      });
      this.wrapWithSendMethodCallbacks(
        this.centralTransferProxyContract.methods
          .swapBridgeAsset(
            this.substituteAssetAddressIfNeeded(inputAsset.address),
            this.substituteAssetAddressIfNeeded(outputAsset.address),
            toWei(inputAmount, inputAsset.decimals),
            this.mapTransferDataToExpectedMinimumAmount(transferData),
            this.mapTransferDataToBytes(transferData),
            this.mapDepositDataToBytes(depositData),
            depositData.targetChainRelay
          )
          .send(
            this.getDefaultTransactionsParams(gasLimit, this.mapTransferDataToValue(transferData))
          ),
        (receipt) => {
          eb.emit({
            type: InternalTransactionType.Swap,
            state: State.Succeeded,
            hash: receipt.transactionHash
          });
          eb.emit({
            type: InternalTransactionType.Bridge,
            state: State.Pending,
            hash: receipt.transactionHash
          });
          resolve(receipt);
        },
        reject,
        async (hash) => {
          await this.addMemPoolTxToLocalStorage({
            internalType: TransactionType.SavingsPlusDeposit,
            token: getUSDCAssetData(this.network),
            network: this.network,
            amount: inputAmount,
            timestamp: dayjs().unix(),
            direction: TransactionDirection.Out,
            hash: hash,
            toAddress: getNetworkAddress(this.network, 'TRANSFER_PROXY_ADDRESS')
          });

          eb.emit({
            type: InternalTransactionType.Confirm,
            state: State.Succeeded
          });
          eb.emit({
            type: InternalTransactionType.Swap,
            state: State.Pending,
            hash: hash
          });
          onTransactionHash(hash);
        }
      );
    });
  }

  protected async withdrawComplex(
    outputAsset: SmallTokenInfo,
    outputAmount: string,
    withdrawToNetwork: Network,
    onTransactionHash: (hash: string) => void,
    eb: ITransactionStateEventBus
  ): Promise<TransactionReceipt | undefined> {
    try {
      const chainId = getNetwork(withdrawToNetwork)?.chainId;
      if (chainId === undefined) {
        throw new MoverError(`Failed to get chainId of network ${withdrawToNetwork}`);
      }

      eb.emit({
        type: InternalTransactionType.Confirm,
        state: State.Pending
      });
      const preparedAction = await this.prepareSavingsPlusComplexWithdrawAction(
        toWei(outputAmount, outputAsset.decimals),
        chainId
      );
      eb.emit({
        type: InternalTransactionType.Confirm,
        state: State.Succeeded
      });

      const subsidizedResponse =
        await this.subsidizedAPIService.executeSavingsPlusWithdrawTransaction(
          preparedAction.actionString,
          preparedAction.signature,
          async () => {
            //
          }
        );

      if (subsidizedResponse.txID !== undefined) {
        eb.emit({
          type: InternalTransactionType.Bridge,
          state: State.Pending,
          hash: subsidizedResponse.txID
        });
        onTransactionHash(subsidizedResponse.txID);
      }

      if (subsidizedResponse.queueID !== undefined) {
        const pollingFn = async (queueId: string): Promise<void> => {
          const resp = await this.subsidizedAPIService.checkTransactionStatus(queueId);
          if (resp.status === TransactionStatus.Discarded) {
            throw new OnChainServiceError(
              `Transaction was discarded because of ${resp.errorStatus}`
            );
          }

          if (resp.status === TransactionStatus.Queued) {
            await asyncSleep(5000); // fixme: better way?
            return pollingFn(queueId);
          }

          eb.emit({
            type: InternalTransactionType.Bridge,
            state: State.Pending,
            hash: resp.txID
          });
          onTransactionHash(resp.txID);
        };

        await pollingFn(subsidizedResponse.queueID);
      }

      return undefined;
    } catch (error) {
      eb.fail(error);
      throw error;
    }
  }

  protected async withdraw(
    outputAsset: SmallTokenInfo,
    outputAmount: string,
    withdrawData: WithdrawOnlyTransactionData,
    onTransactionHash: (hash: string) => void,
    gasLimit: string,
    eb: ITransactionStateEventBus
  ): Promise<TransactionReceipt | never> {
    return new Promise<TransactionReceipt>((resolve, reject) => {
      if (this.centralTransferProxyContract === undefined) {
        throw new NetworkFeatureNotSupportedError('Savings Plus withdraw', this.network);
      }

      eb.emit({
        type: InternalTransactionType.Confirm,
        state: State.Pending
      });
      this.wrapWithSendMethodCallbacks(
        this.centralTransferProxyContract.methods
          .withdrawFromPool(
            withdrawData.withdrawPoolAddress,
            toWei(outputAmount, outputAsset.decimals)
          )
          .send(this.getDefaultTransactionsParams(gasLimit)),
        (receipt) => {
          eb.emit({
            type: InternalTransactionType.Withdraw,
            state: State.Succeeded,
            hash: receipt.transactionHash
          });
          resolve(receipt);
        },
        reject,
        async (hash) => {
          await this.addMemPoolTxToLocalStorage({
            internalType: TransactionType.SavingsPlusWithdraw,
            token: getUSDCAssetData(this.network),
            network: this.network,
            amount: outputAmount,
            timestamp: dayjs().unix(),
            direction: TransactionDirection.In,
            hash: hash,
            toAddress: getNetworkAddress(this.network, 'TRANSFER_PROXY_ADDRESS')
          });

          eb.emit({
            type: InternalTransactionType.Confirm,
            state: State.Succeeded
          });
          eb.emit({
            type: InternalTransactionType.Withdraw,
            state: State.Pending,
            hash: hash
          });
          onTransactionHash(hash);
        },
        {
          outputAsset,
          outputAmount,
          withdrawData,
          gasLimit
        }
      );
    });
  }

  protected isValidUSDCishToken(address: string): boolean {
    return sameAddress(address, this.usdcAssetData.address);
  }

  protected mapDepositDataToBytes(data?: DepositWithBridgeTransactionData): number[] {
    return SavingsPlusOnChainService.mapDepositDataToBytes(this.web3Client, data);
  }

  protected static mapDepositDataToBytes(
    web3Client: Web3,
    data?: DepositWithBridgeTransactionData
  ): number[] {
    if (data === undefined) {
      return [];
    }

    return Array.prototype.concat(
      web3Client.utils.hexToBytes(data.bridgeTxAddress),
      web3Client.utils.hexToBytes(data.bridgeTxData)
    );
  }

  protected async prepareSavingsPlusComplexWithdrawAction(
    amount: string,
    chainId: number
  ): Promise<PreparedAction> {
    return this.prepareSubsidizedAction(
      `ON BEHALF ${
        this.currentAddress
      } TIMESTAMP ${dayjs().unix()} EXECUTE WITHDRAW FROM SAVINGSPLUS AMOUNT_TOKEN ${amount} TO NETWORK ${chainId}`
    );
  }

  protected mapAdditionalSwapBridgeParams(
    transferData: TransferData,
    depositData: DepositWithBridgeTransactionData
  ): { _expectedMinimumReceived: string; _minToMint: string; _minDy: string } {
    const _expectedMinimumReceived = this.mapTransferDataToExpectedMinimumAmount(transferData);
    const _minToMint = getInteger(
      multiply(_expectedMinimumReceived, SavingsPlusOnChainService.MintMultiplier)
    );
    const _minDy = getInteger(
      multiply(
        // clamp value from 0 to +Inf
        // special case when the bridge will cause whole amount to be zeroed
        clampLeft(sub(_minToMint, depositData.bridgeFee)),
        SavingsPlusOnChainService.DyMultiplier
      )
    );

    return { _expectedMinimumReceived, _minToMint, _minDy };
  }
}

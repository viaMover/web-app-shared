import dayjs from 'dayjs';
import { sameAddress } from 'web-app-shared/helpers/addresses';
import { toWei } from 'web-app-shared/helpers/bigmath';
import { addSentryBreadcrumb } from 'web-app-shared/logs/sentry';
import { UBT_STAKING_CONTRACT_ABI } from 'web-app-shared/references/abi';
import { getUBTAssetData } from 'web-app-shared/references/assets';
import { gasDefaults } from 'web-app-shared/references/gasDefaults';
import { Network } from 'web-app-shared/references/network';
import { getNetworkAddress } from 'web-app-shared/references/references';
import { SmallTokenInfo, Token } from 'web-app-shared/references/tokens';
import {
  TransactionDirection,
  TransactionType
} from 'web-app-shared/services/api/mover/transactions/types';
import { NetworkFeatureNotSupportedError } from 'web-app-shared/services/NetworkFeatureNotSupportedError';
import { MoverOnChainService } from 'web-app-shared/services/onchain/mover/MoverOnChainService';
import { OnChainServiceError } from 'web-app-shared/services/onchain/OnChainServiceError';
import {
  InternalTransactionType,
  ITransactionStateEventBus,
  State,
  TransactionScenario,
  TransactionStateItem
} from 'web-app-shared/services/onchain/transaction-states';
import { CompoundEstimateResponse } from 'web-app-shared/services/onchain/types';
import Web3 from 'web3';
import { TransactionReceipt } from 'web3-eth';
import { AbiItem } from 'web3-utils';

import { StakingContract } from './types';

export class StakingUbtOnChainService extends MoverOnChainService {
  protected readonly stakingContract: StakingContract | undefined;

  protected readonly UBTAssetData: SmallTokenInfo;

  constructor(currentAddress: string, network: Network, web3Client: Web3) {
    super('staking-ubt.on-chain.service', currentAddress, network, web3Client);

    this.stakingContract = this.createContract(
      'STAKING_UBT_CONTRACT_ADDRESS',
      UBT_STAKING_CONTRACT_ABI as AbiItem[]
    );
    this.UBTAssetData = getUBTAssetData(this.network);
  }

  public async depositCompound(
    inputAsset: SmallTokenInfo,
    inputAmount: string,
    onTransactionHash: (hash: string) => void,
    actionGasLimit: string,
    approveGasLimit: string,
    eb: ITransactionStateEventBus
  ): Promise<TransactionReceipt> {
    if (!sameAddress(inputAsset.address, this.UBTAssetData.address)) {
      throw new OnChainServiceError('Wrong token supplied to depositCompound()', { inputAsset });
    }

    try {
      return await this.executeTransactionWithApprove(
        inputAsset,
        getNetworkAddress(this.network, 'STAKING_UBT_CONTRACT_ADDRESS'),
        inputAmount,
        (newGasLimit) => this.deposit(inputAsset, inputAmount, onTransactionHash, newGasLimit, eb),
        () => this.estimateDepositCompound(inputAsset, inputAmount),
        () => {
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
          inputAmount,
          actionGasLimit,
          approveGasLimit
        }
      });

      throw new OnChainServiceError('Failed to deposit').wrap(error);
    }
  }

  public async explainDepositCompound(
    inputAsset: Token,
    inputAmount: string
  ): Promise<TransactionScenario> {
    let index = 0;
    const steps = new Array<TransactionStateItem>();
    const isApproveNeeded = await this.needsApprove(
      inputAsset,
      inputAmount,
      getNetworkAddress(this.network, 'STAKING_UBT_CONTRACT_ADDRESS')
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
      type: InternalTransactionType.Deposit,
      state: State.Queued,
      estimation: 15,
      token: inputAsset,
      network: Network.ethereum,
      timestamp: 0
    });

    return {
      toNetwork: Network.ethereum,
      startNetwork: inputAsset.network,
      type: TransactionType.StakingDeposit,
      steps: steps
    };
  }

  public async estimateDepositCompound(
    inputAsset: SmallTokenInfo,
    inputAmount: string
  ): Promise<CompoundEstimateResponse> {
    if (!sameAddress(inputAsset.address, this.UBTAssetData.address)) {
      throw new OnChainServiceError('Wrong token supplied to estimateDepositCompound()', {
        inputAsset
      });
    }

    if (this.stakingContract === undefined) {
      throw new NetworkFeatureNotSupportedError('UBT staking deposit', this.network);
    }

    const approveGasLimit = await this.estimateApproveIfNeeded(
      inputAsset,
      inputAmount,
      getNetworkAddress(this.network, 'STAKING_UBT_CONTRACT_ADDRESS')
    );

    if (approveGasLimit !== undefined) {
      return {
        approveGasLimit,
        actionGasLimit: gasDefaults.basic_savings_plus_deposit
      };
    }

    try {
      const gasLimitObj = await this.stakingContract.methods
        .deposit(toWei(inputAmount, inputAsset.decimals))
        .estimateGas({ from: this.currentAddress });

      if (gasLimitObj) {
        return {
          approveGasLimit: '0',
          actionGasLimit: this.addGasBuffer(gasLimitObj.toString())
        };
      }
    } catch (error) {
      addSentryBreadcrumb({
        type: 'error',
        category: this.sentryCategoryPrefix,
        message: 'Failed to estimate deposit',
        data: {
          error,
          inputAsset,
          inputAmount
        }
      });

      throw new OnChainServiceError('Failed to estimate deposit').wrap(error);
    }

    throw new OnChainServiceError('Failed to estimate deposit: empty gas limit');
  }

  public async withdrawCompound(
    outputAsset: SmallTokenInfo,
    outputAmount: string,
    onTransactionHash: (hash: string) => void,
    actionGasLimit: string,
    eb: ITransactionStateEventBus
  ): Promise<TransactionReceipt> {
    if (!sameAddress(outputAsset.address, this.UBTAssetData.address)) {
      throw new OnChainServiceError('Wrong token supplied to withdrawCompound()', { outputAsset });
    }

    try {
      return await this.withdraw(outputAsset, outputAmount, onTransactionHash, actionGasLimit, eb);
    } catch (error) {
      eb.fail(error);
      this.rethrowIfUserRejectedRequest(error);

      addSentryBreadcrumb({
        type: 'error',
        category: this.sentryCategoryPrefix,
        message: 'Failed to withdraw',
        data: {
          error,
          outputAsset,
          outputAmount,
          actionGasLimit
        }
      });

      throw new OnChainServiceError('Failed to withdraw').wrap(error);
    }
  }

  public async explainWithdrawCompound(outputAsset: Token): Promise<TransactionScenario> {
    let index = 0;
    const steps = new Array<TransactionStateItem>();

    steps.push({
      index: index++,
      type: InternalTransactionType.Confirm,
      state: State.Queued,
      estimation: 0,
      token: outputAsset,
      network: Network.ethereum,
      timestamp: 0
    });

    steps.push({
      index: index++,
      type: InternalTransactionType.Withdraw,
      state: State.Queued,
      estimation: 15,
      token: outputAsset,
      network: Network.ethereum,
      timestamp: 0
    });

    return {
      toNetwork: Network.ethereum,
      startNetwork: this.network,
      type: TransactionType.StakingWithdraw,
      steps: steps
    };
  }

  public async estimateWithdrawCompound(
    outputAsset: SmallTokenInfo,
    outputAmount: string
  ): Promise<CompoundEstimateResponse> {
    if (this.stakingContract === undefined) {
      throw new NetworkFeatureNotSupportedError('UBT staking withdraw', this.network);
    }

    try {
      const gasLimitObj = await this.stakingContract.methods
        .withdraw(toWei(outputAmount, outputAsset.decimals))
        .estimateGas({ from: this.currentAddress });

      return {
        actionGasLimit: this.addGasBuffer(gasLimitObj.toString()),
        approveGasLimit: '0'
      };
    } catch (error) {
      addSentryBreadcrumb({
        type: 'error',
        category: this.sentryCategoryPrefix,
        message: 'Failed to estimate withdraw',
        data: {
          error,
          outputAsset,
          outputAmount
        }
      });

      throw new OnChainServiceError('Failed to estimate withdraw').wrap(error);
    }
  }

  protected async deposit(
    inputAsset: SmallTokenInfo,
    inputAmount: string,
    onTransactionHash: (hash: string) => void,
    gasLimit: string,
    eb: ITransactionStateEventBus
  ): Promise<TransactionReceipt> {
    return new Promise<TransactionReceipt>((resolve, reject) => {
      if (this.stakingContract === undefined) {
        throw new NetworkFeatureNotSupportedError('UBT staking deposit', this.network);
      }

      eb.emit({
        type: InternalTransactionType.Confirm,
        state: State.Pending
      });
      this.wrapWithSendMethodCallbacks(
        this.stakingContract.methods
          .deposit(toWei(inputAmount, inputAsset.decimals))
          .send(this.getDefaultTransactionsParams(gasLimit)),
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
            internalType: TransactionType.StakingDeposit,
            token: getUBTAssetData(this.network),
            network: this.network,
            amount: inputAmount,
            timestamp: dayjs().unix(),
            direction: TransactionDirection.Out,
            hash: hash,
            toAddress: getNetworkAddress(this.network, 'STAKING_UBT_CONTRACT_ADDRESS')
          });

          eb.emit({
            type: InternalTransactionType.Confirm,
            state: State.Succeeded
          });
          eb.emit({
            type: InternalTransactionType.Deposit,
            state: State.Pending,
            hash: hash
          });
          onTransactionHash(hash);
        },
        {
          gasLimit
        }
      );
    });
  }

  protected async withdraw(
    outputAsset: SmallTokenInfo,
    outputAmount: string,
    onTransactionHash: (hash: string) => void,
    gasLimit: string,
    eb: ITransactionStateEventBus
  ): Promise<TransactionReceipt> {
    return new Promise<TransactionReceipt>((resolve, reject) => {
      if (this.stakingContract === undefined) {
        throw new NetworkFeatureNotSupportedError('UBT staking withdraw', this.network);
      }

      eb.emit({
        type: InternalTransactionType.Confirm,
        state: State.Pending
      });
      this.wrapWithSendMethodCallbacks(
        this.stakingContract.methods
          .withdraw(toWei(outputAmount, outputAsset.decimals))
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
            internalType: TransactionType.StakingWithdraw,
            token: getUBTAssetData(this.network),
            network: this.network,
            amount: outputAmount,
            timestamp: dayjs().unix(),
            direction: TransactionDirection.In,
            hash: hash,
            toAddress: getNetworkAddress(this.network, 'STAKING_UBT_CONTRACT_ADDRESS')
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
          gasLimit
        }
      );
    });
  }
}

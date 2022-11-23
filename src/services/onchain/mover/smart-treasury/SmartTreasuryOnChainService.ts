import dayjs from 'dayjs';
import { sameAddress } from 'web-app-shared/helpers/addresses';
import { toWei } from 'web-app-shared/helpers/bigmath';
import { addSentryBreadcrumb } from 'web-app-shared/logs/sentry';
import { getCentralTransferProxyAbi, SMART_TREASURY_ABI } from 'web-app-shared/references/abi';
import {
  getMoveAssetData,
  getMoveWethLPAssetData,
  getUSDCAssetData
} from 'web-app-shared/references/assets';
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
import { TransferProxyContract } from 'web-app-shared/services/onchain/mover/types';
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

import { SmartTreasuryContract } from './types';

export class SmartTreasuryOnChainService extends MoverOnChainService {
  protected readonly transferProxyContract: TransferProxyContract | undefined;

  protected readonly smartTreasuryContract: SmartTreasuryContract | undefined;

  protected readonly usdcAssetData: SmallTokenInfo;

  protected readonly moveAssetData: SmallTokenInfo;

  protected readonly moveEthLPAssetData: SmallTokenInfo;

  constructor(currentAddress: string, network: Network, web3Client: Web3) {
    super('smart-treasury.on-chain.service', currentAddress, network, web3Client);

    this.transferProxyContract = this.createContract(
      'TRANSFER_PROXY_ADDRESS',
      getCentralTransferProxyAbi(network)
    );
    this.smartTreasuryContract = this.createContract(
      'SMART_TREASURY_ADDRESS',
      SMART_TREASURY_ABI as AbiItem[]
    );
    this.usdcAssetData = getUSDCAssetData(network);
    this.moveAssetData = getMoveAssetData(network);
    this.moveEthLPAssetData = getMoveWethLPAssetData(network);
  }

  public async depositCompound(
    inputAsset: SmallTokenInfo,
    inputAmount: string,
    onTransactionHash: (hash: string) => void,
    actionGasLimit: string,
    approveGasLimit: string,
    eb: ITransactionStateEventBus
  ): Promise<TransactionReceipt | never> {
    try {
      return await this.executeTransactionWithApprove(
        inputAsset,
        getNetworkAddress(this.network, 'TRANSFER_PROXY_ADDRESS'),
        inputAmount,
        (newGasLimit) => this.deposit(inputAsset, inputAmount, newGasLimit, onTransactionHash, eb),
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
          inputAsset,
          inputAmount,
          actionGasLimit,
          approveGasLimit,
          error
        }
      });
      throw new OnChainServiceError('Failed to execute deposit').wrap(error);
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
      type: TransactionType.TreasuryDeposit,
      steps: steps
    };
  }

  public async estimateDepositCompound(
    inputAsset: SmallTokenInfo,
    inputAmount: string
  ): Promise<CompoundEstimateResponse> {
    const approveGasLimit = await this.estimateApproveIfNeeded(
      inputAsset,
      inputAmount,
      getNetworkAddress(this.network, 'TRANSFER_PROXY_ADDRESS')
    );

    if (approveGasLimit !== undefined) {
      return {
        approveGasLimit,
        actionGasLimit: gasDefaults.basic_treasury_deposit
      };
    }

    if (this.transferProxyContract === undefined) {
      throw new NetworkFeatureNotSupportedError('Smart Treasury deposit', this.network);
    }

    if (
      !(
        sameAddress(inputAsset.address, this.moveAssetData.address) ||
        sameAddress(inputAsset.address, this.moveEthLPAssetData.address)
      )
    ) {
      throw new OnChainServiceError('Wrong token used for Smart Treasury Deposit', { inputAsset });
    }

    const inputAmountInWEI = toWei(inputAmount, inputAsset.decimals);

    const moveAmount = sameAddress(inputAsset.address, this.moveAssetData.address)
      ? inputAmountInWEI
      : '0';
    const moveEthAmount = sameAddress(inputAsset.address, this.moveEthLPAssetData.address)
      ? inputAmountInWEI
      : '0';

    try {
      const gasLimitObj = await this.transferProxyContract.methods
        .depositToTreasury(moveAmount, moveEthAmount)
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
          inputAmount,
          moveAmount,
          moveEthAmount
        }
      });

      throw new OnChainServiceError('Failed to estimate deposit').wrap(error);
    }

    addSentryBreadcrumb({
      type: 'error',
      category: this.sentryCategoryPrefix,
      message: 'Failed to estimate deposit: empty gas limit',
      data: {
        inputAsset,
        inputAmount,
        moveAmount,
        moveEthAmount
      }
    });

    throw new OnChainServiceError('Failed to estimate deposit: empty gas limit');
  }

  public async withdrawCompound(
    outputAsset: SmallTokenInfo,
    outputAmount: string,
    onTransactionHash: (hash: string) => void,
    actionGasLimit: string,
    eb: ITransactionStateEventBus
  ): Promise<TransactionReceipt> {
    try {
      return await this.withdraw(outputAsset, outputAmount, actionGasLimit, onTransactionHash, eb);
    } catch (error) {
      eb.fail(error);
      this.rethrowIfUserRejectedRequest(error);

      addSentryBreadcrumb({
        type: 'error',
        category: this.sentryCategoryPrefix,
        message: 'Failed to withdraw',
        data: {
          outputAsset,
          outputAmount,
          actionGasLimit,
          error
        }
      });

      throw error;
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
      estimation: 0,
      token: outputAsset,
      network: Network.ethereum,
      timestamp: 0
    });

    return {
      toNetwork: Network.ethereum,
      startNetwork: this.network,
      type: TransactionType.TreasuryWithdraw,
      steps: steps
    };
  }

  public async estimateWithdrawCompound(
    outputAsset: SmallTokenInfo,
    outputAmount: string
  ): Promise<CompoundEstimateResponse> {
    if (
      !(
        sameAddress(outputAsset.address, this.moveAssetData.address) ||
        sameAddress(outputAsset.address, this.moveEthLPAssetData.address)
      )
    ) {
      throw new OnChainServiceError('Wrong token used for Smart Treasury Withdraw', {
        outputAsset
      });
    }

    if (this.smartTreasuryContract === undefined) {
      throw new NetworkFeatureNotSupportedError('Smart Treasury withdraw', this.network);
    }

    const outputAmountInWEI = toWei(outputAmount, outputAsset.decimals);

    const moveAmount = sameAddress(outputAsset.address, this.moveAssetData.address)
      ? outputAmountInWEI
      : '0';
    const moveEthAmount = sameAddress(outputAsset.address, this.moveEthLPAssetData.address)
      ? outputAmountInWEI
      : '0';

    try {
      const gasLimitObj = await this.smartTreasuryContract.methods
        .withdraw(moveAmount, moveEthAmount)
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
        message: 'Failed to estimate withdraw',
        data: {
          error,
          inputAmount: outputAmount,
          moveAmount,
          moveEthAmount
        }
      });

      throw new OnChainServiceError('Failed to estimate withdraw').wrap(error);
    }

    addSentryBreadcrumb({
      type: 'error',
      category: this.sentryCategoryPrefix,
      message: 'Failed to estimate withdraw: empty gas limit',
      data: {
        outputAsset,
        inputAmount: outputAmount,
        moveAmount,
        moveEthAmount
      }
    });

    throw new OnChainServiceError('Failed to estimate withdraw: empty gas limit');
  }

  protected async deposit(
    inputAsset: SmallTokenInfo,
    inputAmount: string,
    gasLimit: string,
    onTransactionHash: (hash: string) => void,
    eb: ITransactionStateEventBus
  ): Promise<TransactionReceipt> {
    const inputAmountInWEI = toWei(inputAmount, inputAsset.decimals);

    if (
      !(
        sameAddress(inputAsset.address, this.moveAssetData.address) ||
        sameAddress(inputAsset.address, this.moveEthLPAssetData.address)
      )
    ) {
      throw new OnChainServiceError('Wrong token used for Smart Treasury Deposit', { inputAsset });
    }

    const moveAmount = sameAddress(inputAsset.address, this.moveAssetData.address)
      ? inputAmountInWEI
      : '0';
    const moveEthAmount = sameAddress(inputAsset.address, this.moveEthLPAssetData.address)
      ? inputAmountInWEI
      : '0';

    return new Promise<TransactionReceipt>((resolve, reject) => {
      if (this.transferProxyContract === undefined) {
        throw new NetworkFeatureNotSupportedError('Treasury deposit', this.network);
      }

      eb.emit({
        type: InternalTransactionType.Confirm,
        state: State.Pending
      });
      this.wrapWithSendMethodCallbacks(
        this.transferProxyContract.methods
          .depositToTreasury(moveAmount, moveEthAmount)
          .send(this.getDefaultTransactionsParams(gasLimit)),
        (receipt) => {
          eb.emit({
            type: InternalTransactionType.Deposit,
            state: State.Pending,
            hash: receipt.transactionHash
          });
          resolve(receipt);
        },
        reject,
        async (hash) => {
          const t = sameAddress(inputAsset.address, this.moveAssetData.address)
            ? getMoveAssetData(this.network)
            : getMoveWethLPAssetData(this.network);
          await this.addMemPoolTxToLocalStorage({
            internalType: TransactionType.TreasuryDeposit,
            token: t,
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
            type: InternalTransactionType.Deposit,
            state: State.Pending,
            hash: hash
          });
          onTransactionHash(hash);
        },
        {
          moveAmount,
          moveEthAmount,
          gasLimit
        }
      );
    });
  }

  protected async withdraw(
    outputAsset: SmallTokenInfo,
    outputAmount: string,
    gasLimit: string,
    onTransactionHash: (hash: string) => void,
    eb: ITransactionStateEventBus
  ): Promise<TransactionReceipt> {
    if (
      !(
        sameAddress(outputAsset.address, this.moveAssetData.address) ||
        sameAddress(outputAsset.address, this.moveEthLPAssetData.address)
      )
    ) {
      throw new OnChainServiceError('Wrong token used for Smart Treasury Withdraw', {
        outputAsset
      });
    }

    const outputAmountInWEI = toWei(outputAmount, outputAsset.decimals);

    const moveAmount = sameAddress(outputAsset.address, this.moveAssetData.address)
      ? outputAmountInWEI
      : '0';
    const moveEthAmount = sameAddress(outputAsset.address, this.moveEthLPAssetData.address)
      ? outputAmountInWEI
      : '0';

    return new Promise<TransactionReceipt>((resolve, reject) => {
      if (this.smartTreasuryContract === undefined) {
        throw new NetworkFeatureNotSupportedError('Treasury withdraw', this.network);
      }

      eb.emit({
        type: InternalTransactionType.Confirm,
        state: State.Pending
      });
      this.wrapWithSendMethodCallbacks(
        this.smartTreasuryContract.methods
          .withdraw(moveAmount, moveEthAmount)
          .send(this.getDefaultTransactionsParams(gasLimit)),
        (receipt) => {
          eb.emit({
            type: InternalTransactionType.Withdraw,
            state: State.Pending,
            hash: receipt.transactionHash
          });
          resolve(receipt);
        },
        reject,
        async (hash) => {
          const t = sameAddress(outputAsset.address, this.moveAssetData.address)
            ? getMoveAssetData(this.network)
            : getMoveWethLPAssetData(this.network);
          await this.addMemPoolTxToLocalStorage({
            internalType: TransactionType.TreasuryWithdraw,
            token: t,
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
          moveAmount,
          moveEthAmount,
          gasLimit
        }
      );
    });
  }
}

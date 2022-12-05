import { BigNumber } from 'bignumber.js';
import dayjs from 'dayjs';
import Web3 from 'web3';
import { TransactionReceipt } from 'web3-eth';

import { sameAddress } from '../../../../helpers/addresses';
import { fromWei, greaterThan, isEqual, multiply, sub, toWei } from '../../../../helpers/bigmath';
import { asyncSleep } from '../../../../helpers/sleep';
import { addSentryBreadcrumb } from '../../../../logs/sentry';
import { getCentralTransferProxyAbi } from '../../../../references/abi';
import { getTopUpProxyAbi } from '../../../../references/abi/topup-proxy';
import { getUSDCAssetData } from '../../../../references/assets';
import { BridgeType, mapBrideTypeToContractsConstant } from '../../../../references/bridge';
import { Network } from '../../../../references/network';
import {
  getNetwork,
  getNetworkAddress,
  getNetworkConstant,
  isBaseAssetByNetwork
} from '../../../../references/references';
import {
  PermitData,
  SmallToken,
  SmallTokenInfo,
  Token,
  TokenWithPrice
} from '../../../../references/tokens';
import { AcrossAPIService } from '../../../api/mover/across/AcrossAPIService';
import { MoverAPIApprovalService } from '../../../api/mover/approval/MoverAPIApprovalService';
import { GetApprovalReturn } from '../../../api/mover/approval/types';
import { MoverAssetsService } from '../../../api/mover/assets/MoverAPIAssetsService';
import { TransactionDirection, TransactionType } from '../../../api/mover/transactions/types';
import { SwapAPIService } from '../../../api/swap/SwapAPIService';
import { TransferData } from '../../../api/swap/types';
import { EECode } from '../../../ExpectedError';
import { MoverError } from '../../../MoverError';
import { NetworkFeatureNotSupportedError } from '../../../NetworkFeatureNotSupportedError';
import { hexStringToBuffer, uintBufferToHex } from '../../../utils/parsing';
import { OnChainServiceError } from '../../OnChainServiceError';
import { PermitOnChainService } from '../../permit/PermitOnChainService';
import {
  InternalTransactionType,
  ITransactionStateEventBus,
  State,
  TransactionScenario,
  TransactionStateItem
} from '../../transaction-states';
import { TransactionsParams } from '../../types';
import { MoverOnChainService } from '../MoverOnChainService';
import { ProveOnChainService } from '../prove-txn/ProveOnChainService';
import { TransferProxyContract } from '../types';
import { BridgeDataResponse, TopUpProxyContract, UnwrapEstimationData } from './types';

export class DebitCardOnChainService extends MoverOnChainService {
  protected readonly sentryCategoryPrefix = 'debit-card.on-chain.service';

  protected readonly usdcAssetData: SmallTokenInfo;

  protected readonly centralTransferProxyAddress: string;
  protected readonly centralTransferProxyContract: TransferProxyContract | undefined;

  protected readonly topUpProxyAddress: string;
  protected readonly topUpProxyContract: TopUpProxyContract | undefined;

  private readonly useMockEstimation = false;

  constructor(
    currentAddress: string,
    network: Network,
    web3Client: Web3,
    protected readonly getWalletTokens: () => Array<TokenWithPrice>,
    protected readonly swapService: SwapAPIService,
    protected readonly acrossService: AcrossAPIService,
    protected readonly assetsService: MoverAssetsService,
    protected readonly permitService: PermitOnChainService,
    protected readonly approvalService: MoverAPIApprovalService,
    protected readonly proofService: ProveOnChainService
  ) {
    super('debit-card.on-chain.service', currentAddress, network, web3Client);
    this.usdcAssetData = getUSDCAssetData(network);
    this.centralTransferProxyAddress = getNetworkAddress(network, 'TRANSFER_PROXY_ADDRESS');
    this.centralTransferProxyContract = this.createContract(
      'TRANSFER_PROXY_ADDRESS',
      getCentralTransferProxyAbi(network)
    );

    this.topUpProxyAddress = getNetworkAddress(network, 'TOP_UP_PROXY_ADDRESS');
    try {
      this.topUpProxyContract = this.createContract(
        'TOP_UP_PROXY_ADDRESS',
        getTopUpProxyAbi(network)
      );
    } catch (e) {
      addSentryBreadcrumb({
        level: 'info',
        category: `${this.sentryCategoryPrefix}.constructor`,
        message: 'can not init hardenedTopUpProxyContract for this network',
        data: {
          network: this.network
        }
      });
    }
  }

  public async explainTopUpCompound(
    inputAsset: SmallToken & PermitData
  ): Promise<TransactionScenario> {
    let index = 0;
    const steps = new Array<TransactionStateItem>();

    const isUnwrapSupported = await this.isUnwrapSupported(inputAsset.address);

    const isBase = isBaseAssetByNetwork(inputAsset.address, this.network);

    if (!isBase) {
      if (inputAsset.hasPermit && inputAsset.permitType === 'erc2612') {
        steps.push({
          index: index++,
          type: InternalTransactionType.Confirm,
          state: State.Queued,
          estimation: 0,
          token: inputAsset,
          network: inputAsset.network,
          timestamp: 0
        });
      } else {
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
    }

    const isSwapNeeded = !sameAddress(inputAsset.address, this.usdcAssetData.address);

    steps.push({
      index: index++,
      type: InternalTransactionType.Confirm,
      state: State.Queued,
      estimation: 0,
      token: inputAsset,
      network: inputAsset.network,
      timestamp: 0
    });

    if (isUnwrapSupported) {
      steps.push({
        index: index++,
        type: InternalTransactionType.Unwrap,
        state: State.Queued,
        estimation: 15,
        token: inputAsset,
        network: inputAsset.network,
        timestamp: 0
      });
    }

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

    const usdc = getUSDCAssetData(inputAsset.network);

    if (inputAsset.network !== Network.ethereum) {
      steps.push({
        index: index++,
        type: InternalTransactionType.Bridge,
        state: State.Queued,
        estimation: 5 * 60,
        token: usdc,
        network: inputAsset.network,
        timestamp: 0
      });

      steps.push({
        index: index++,
        type: InternalTransactionType.TopUp,
        state: State.Queued,
        estimation: 2 * 60,
        token: usdc,
        network: Network.ethereum,
        timestamp: 0
      });
    } else {
      steps.push({
        index: index++,
        type: InternalTransactionType.TopUp,
        state: State.Queued,
        estimation: 15,
        token: usdc,
        network: Network.ethereum,
        timestamp: 0
      });
    }

    return {
      toNetwork: Network.ethereum,
      startNetwork: inputAsset.network,
      type: TransactionType.CardTopUp,
      steps: steps
    };
  }

  public async topUpCompound(
    inputAsset: SmallToken & PermitData,
    inputNetwork: Network,
    inputAmount: string,
    transferData: TransferData | undefined,
    tagHash: string,
    bridgingFeeInUSDC: string,
    onTransactionHash: (hash: string) => void,
    eb: ITransactionStateEventBus
  ): Promise<TransactionReceipt> {
    try {
      let tokenAddressForSwap = inputAsset.address;
      let tokenAmountInWeiForSwap = toWei(inputAmount, inputAsset.decimals);
      const isUnwrapSupported = await this.isUnwrapSupported(inputAsset.address);

      if (isUnwrapSupported) {
        const unwrapData = await this.estimateUnwrapData(
          inputAsset.address,
          toWei(inputAmount, inputAsset.decimals)
        );

        tokenAddressForSwap = unwrapData.UnwrappedTokenAddress;
        tokenAmountInWeiForSwap = unwrapData.UnwrappedAmountInWei;
      }

      if (
        transferData === undefined &&
        !sameAddress(tokenAddressForSwap, this.usdcAssetData.address)
      ) {
        addSentryBreadcrumb({
          type: 'error',
          category: `${this.sentryCategoryPrefix}.topUpCompound`,
          message: 'missing transferData',
          data: {
            isUnwrapSupported,
            inputAssetAddress: inputAsset.address
          }
        });
        throw new OnChainServiceError('Failed to top up: missing transferData');
      }

      eb.emit({ type: InternalTransactionType.Confirm, state: State.Pending });
      const bridgeType = getNetworkConstant(this.network, 'BRIDGE_TYPE');
      if (bridgeType === undefined) {
        throw new OnChainServiceError('Failed to top up: bridge type is undefined');
      }

      let bridgeData = Buffer.from([]);
      if (bridgeType !== BridgeType.None) {
        let amountForBridge = '0';
        let usdcSent = '0';
        if (!isUnwrapSupported) {
          if (sameAddress(inputAsset.address, this.usdcAssetData.address)) {
            amountForBridge = toWei(inputAmount, inputAsset.decimals);
            usdcSent = toWei(inputAmount, this.usdcAssetData.decimals);
          } else {
            amountForBridge = this.getAmountForBrideFromMinimumReceive(transferData);
            if (transferData === undefined) {
              throw new MoverError('transfer data is undefined in case of USDC');
            }
            usdcSent = transferData.buyAmount;
          }
        } else {
          if (sameAddress(tokenAddressForSwap, this.usdcAssetData.address)) {
            amountForBridge = tokenAmountInWeiForSwap;
            usdcSent = tokenAmountInWeiForSwap;
          } else {
            amountForBridge = this.getAmountForBrideFromMinimumReceive(transferData);
            if (transferData === undefined) {
              throw new MoverError('transfer data is undefined in case of USDC');
            }
            usdcSent = transferData.buyAmount;
          }
        }

        const bridgeDataResp = await this.getBridgeData(bridgeType, amountForBridge);
        bridgeData = bridgeDataResp.BridgeData;

        const newFeeInUsdc = fromWei(
          multiply(usdcSent, bridgeDataResp.BridgeFeeInPercents),
          this.usdcAssetData.decimals
        );

        const deltaFeeActual = sub(newFeeInUsdc, bridgingFeeInUSDC);

        if (greaterThan(deltaFeeActual, '30')) {
          addSentryBreadcrumb({
            level: 'error',
            category: `${this.sentryCategoryPrefix}.topUpCompound`,
            message: 'actualFee is bigger than calculated before',
            data: {
              newFeeInUsdc,
              bridgingFeeInUSDC
            }
          });

          throw new MoverError('actual bridging fee is too bigger than calculated before');
        }
      }
      addSentryBreadcrumb({
        level: 'info',
        category: `${this.sentryCategoryPrefix}.topUpCompound`,
        message: 'bridge data',
        data: {
          bridgeType,
          bridgeData: bridgeData.toString('hex')
        }
      });

      const receiverHash = hexStringToBuffer(tagHash);
      // const receiverHash = Buffer.from(
      //   this.web3Client.utils.hexToBytes(this.web3Client.utils.padLeft('0x0', 32))
      // );
      const spender = this.topUpProxyAddress;

      // for base asset create synthetic permit data
      // there is an inner condition in permit flow to handle it further
      if (isBaseAssetByNetwork(inputAsset.address, this.network)) {
        inputAsset.permitVersion = '1';
        inputAsset.permitType = 'erc2612';
        inputAsset.hasPermit = true;
      }

      if (inputAsset.hasPermit && inputAsset.permitType === 'erc2612') {
        addSentryBreadcrumb({
          level: 'info',
          category: `${this.sentryCategoryPrefix}.topUpCompound`,
          message: 'Token has permit',
          data: {
            inputAsset
          }
        });
        // deadline - an hour
        const deadline = dayjs().unix() + 3600;
        let permitCallData = '';
        if (!isBaseAssetByNetwork(inputAsset.address, this.network)) {
          try {
            permitCallData = await this.permitService.buildPermitData(
              'callData',
              inputAsset.permitType,
              this.currentAddress,
              inputAsset.address,
              spender,
              getNetwork(this.network).chainId,
              toWei(inputAmount, inputAsset.decimals),
              deadline,
              inputAsset.permitVersion
            );
            await asyncSleep(5000);
          } catch (error) {
            this.rethrowIfUserRejectedRequest(error, EECode.userRejectSign);
            throw error;
          }
          permitCallData = permitCallData.replace('0x', '');

          eb.emit({ type: InternalTransactionType.Confirm, state: State.Pending });
        } else {
          // for base asset
          permitCallData = '';
        }

        const topUpWithPermitGasLimit = await this.estimateTopUpWithPermit(
          inputAsset,
          inputAmount,
          transferData,
          permitCallData,
          bridgeType,
          bridgeData,
          receiverHash,
          isUnwrapSupported,
          tokenAddressForSwap
        );

        try {
          return await this.topUpWithPermit(
            inputAsset,
            inputAmount,
            transferData,
            permitCallData,
            bridgeType,
            bridgeData,
            receiverHash,
            isUnwrapSupported,
            tokenAddressForSwap,
            onTransactionHash,
            topUpWithPermitGasLimit,
            eb
          );
        } catch (error) {
          this.rethrowIfUserRejectedRequest(error, EECode.userRejectTransaction);
          throw error;
        }
      } else {
        // try to make request to backend
        addSentryBreadcrumb({
          level: 'info',
          category: `${this.sentryCategoryPrefix}.topUpCompound`,
          message: 'Token has no permit - try to Top Up with trust',
          data: {
            inputAsset
          }
        });
        try {
          return await this.tryTopUpWithBackend(
            inputAsset,
            inputAmount,
            transferData,
            spender,
            bridgeType,
            bridgeData,
            receiverHash,
            isUnwrapSupported,
            tokenAddressForSwap,
            onTransactionHash,
            undefined,
            eb
          );
        } catch (error) {
          this.rethrowIfUserRejectedRequest(error, EECode.userRejectTransaction);
          throw error;
        }
      }
    } catch (error) {
      eb.fail(error);
      throw error;
    }
  }

  public async tryTopUpWithBackend(
    inputAsset: SmallTokenInfo,
    inputAmount: string,
    transferData: TransferData | undefined,
    spender: string,
    bridgeType: BridgeType,
    bridgeData: Buffer,
    receiverHash: Buffer,
    isUnwrapSupported: boolean,
    tokenAddressForSwap: string,
    onTransactionHash: (hash: string) => void,
    attemptNumber = 1,
    eb: ITransactionStateEventBus
  ): Promise<TransactionReceipt> {
    let approvalData: GetApprovalReturn | undefined = undefined;
    try {
      const amountInWei = toWei(inputAmount, inputAsset.decimals);
      approvalData = await this.approvalService.checkApproval(
        this.currentAddress,
        inputAsset.address,
        amountInWei,
        this.network
      );
      if (!isEqual(approvalData.amount, amountInWei)) {
        addSentryBreadcrumb({
          level: 'info',
          category: `${this.sentryCategoryPrefix}.tryTopUpWithBackend`,
          message: 'wrong approve amount',
          data: {
            amountInWeiRequested: amountInWei,
            amountInWeiFromBackend: approvalData.amount
          }
        });
        approvalData = {
          approval: 'wrong',
          amount: '0',
          data: '',
          timestamp: 0
        };
      }
    } catch (err) {
      if (err instanceof MoverError && err.message === 'no matching approve tx for address') {
        addSentryBreadcrumb({
          level: 'info',
          category: `${this.sentryCategoryPrefix}.tryTopUpWithBackend`,
          message: 'no matching approve tx for address'
        });
        approvalData = {
          approval: 'wrong',
          amount: '0',
          data: '',
          timestamp: 0
        };
      } else {
        addSentryBreadcrumb({
          level: 'error',
          category: `${this.sentryCategoryPrefix}.tryTopUpWithBackend`,
          message: 'Failed to get trust from backend',
          data: {
            inputAssetAddress: inputAsset.address,
            inputAmount
          }
        });
        approvalData = undefined;
      }
    }

    if (approvalData === undefined) {
      addSentryBreadcrumb({
        level: 'info',
        category: `${this.sentryCategoryPrefix}.tryTopUpWithBackend`,
        message: 'cant receive approval data from backend - try Top Up with proof'
      });
      const approveTransactionReceipt = await this.approveCompound(
        inputAsset.address,
        spender,
        toWei(inputAmount, inputAsset.decimals),
        async () => {
          //
        },
        eb,
        true
      );

      const proof = await this.proofService.calcTransactionProof(
        this.network,
        approveTransactionReceipt.blockNumber,
        approveTransactionReceipt.transactionIndex
      );

      const proofStr = uintBufferToHex(proof);

      const gasLimit = await this.estimateTopUpWithProof(
        inputAsset,
        inputAmount,
        transferData,
        approveTransactionReceipt.blockNumber,
        proofStr,
        bridgeType,
        bridgeData,
        receiverHash,
        isUnwrapSupported,
        tokenAddressForSwap
      );

      eb.emit({ type: InternalTransactionType.Approve, state: State.Succeeded });
      eb.emit({ type: InternalTransactionType.Confirm, state: State.Pending });
      return await this.topUpWithProof(
        inputAsset,
        inputAmount,
        transferData,
        approveTransactionReceipt.blockNumber,
        proofStr,
        bridgeType,
        bridgeData,
        receiverHash,
        isUnwrapSupported,
        tokenAddressForSwap,
        onTransactionHash,
        gasLimit,
        eb
      );
    }

    if (approvalData.approval === 'ok') {
      addSentryBreadcrumb({
        level: 'info',
        category: `${this.sentryCategoryPrefix}.tryTopUpWithBackend`,
        message: 'approval is correct, do Top Up with trust',
        data: {
          approvalData: approvalData.data,
          approvalTimestamp: approvalData.timestamp,
          approvalAmount: approvalData.amount
        }
      });

      //let gasLimit = '3000000';

      const gasLimit = await this.estimateTopUpWithTrust(
        inputAsset,
        inputAmount,
        transferData,
        approvalData.timestamp,
        approvalData.data,
        bridgeType,
        bridgeData,
        receiverHash,
        isUnwrapSupported,
        tokenAddressForSwap
      );

      addSentryBreadcrumb({
        level: 'info',
        category: `${this.sentryCategoryPrefix}.tryTopUpWithBackend`,
        message: 'estimated is correct',
        data: {
          gasLimit: gasLimit
        }
      });

      if (eb.getActiveStep().type === InternalTransactionType.Approve) {
        eb.emit({
          type: InternalTransactionType.Approve,
          state: State.Succeeded
        });
        eb.emit({
          type: InternalTransactionType.Confirm,
          state: State.Pending
        });
      }
      return await this.topUpWithTrust(
        inputAsset,
        inputAmount,
        transferData,
        approvalData.timestamp,
        approvalData.data,
        bridgeType,
        bridgeData,
        receiverHash,
        isUnwrapSupported,
        tokenAddressForSwap,
        onTransactionHash,
        gasLimit,
        eb
      );
    } else {
      if (attemptNumber > 2) {
        addSentryBreadcrumb({
          level: 'error',
          category: `${this.sentryCategoryPrefix}.tryTopUpWithBackend`,
          message: 'approval is incorrect even in third try, raise error'
        });

        throw new MoverError('backend cant see approval');
      } else if (attemptNumber === 1) {
        addSentryBreadcrumb({
          level: 'info',
          category: `${this.sentryCategoryPrefix}.tryTopUpWithBackend`,
          message: 'approval is incorrect, make approve'
        });

        await this.approveCompound(
          inputAsset.address,
          spender,
          toWei(inputAmount, inputAsset.decimals),
          async () => {
            //
          },
          eb,
          true
        );
      }

      addSentryBreadcrumb({
        level: 'info',
        category: `${this.sentryCategoryPrefix}.tryTopUpWithBackend`,
        message: 'Waiting 10 sec'
      });

      await asyncSleep(10000);

      addSentryBreadcrumb({
        level: 'info',
        category: `${this.sentryCategoryPrefix}.tryTopUpWithBackend`,
        message: 'After wait lets check one more time'
      });

      return await this.tryTopUpWithBackend(
        inputAsset,
        inputAmount,
        transferData,
        spender,
        bridgeType,
        bridgeData,
        receiverHash,
        isUnwrapSupported,
        tokenAddressForSwap,
        onTransactionHash,
        attemptNumber + 1,
        eb
      );
    }
  }

  public async estimateTopUpWithProof(
    inputAsset: SmallToken,
    inputAmount: string,
    transferData: TransferData | undefined,
    blockNumber: number,
    proof: string,
    bridgeType: BridgeType,
    bridgeData: Buffer,
    receiverHash: Buffer,
    isUnwrapSupported: boolean,
    tokenAddressForSwap: string
  ): Promise<string> {
    if (this.useMockEstimation) {
      return '3000000';
    }

    if (this.topUpProxyContract === undefined) {
      throw new NetworkFeatureNotSupportedError('Card Top Up', this.network);
    }

    this.checkTransferData(inputAsset, isUnwrapSupported, tokenAddressForSwap, transferData);

    try {
      let gasLimitObj;
      if (inputAsset.network === Network.ethereum) {
        // use ethereum version
        gasLimitObj = await this.topUpProxyContract.methods
          .CardTopupMPTProof(
            this.substituteAssetAddressIfNeeded(inputAsset.address),
            toWei(inputAmount, inputAsset.decimals),
            blockNumber,
            Buffer.from(proof, 'hex'),
            this.mapTransferDataToExpectedMinimumAmount(transferData),
            this.mapTransferDataToBytes(transferData),
            receiverHash
          )
          .estimateGas({
            from: this.currentAddress,
            value: this.mapTransferDataToValue(transferData)
          });
      } else {
        // use l2 version
        gasLimitObj = await this.topUpProxyContract.methods
          .CardTopupMPTProof(
            this.substituteAssetAddressIfNeeded(inputAsset.address),
            toWei(inputAmount, inputAsset.decimals),
            blockNumber,
            Buffer.from(proof, 'hex'),
            this.mapTransferDataToExpectedMinimumAmount(transferData),
            this.mapTransferDataToBytes(transferData),
            mapBrideTypeToContractsConstant(bridgeType),
            bridgeData,
            receiverHash
          )
          .estimateGas({
            from: this.currentAddress,
            value: this.mapTransferDataToValue(transferData)
          });
      }

      return this.addGasBuffer(gasLimitObj.toString());
    } catch (error) {
      addSentryBreadcrumb({
        level: 'error',
        category: `${this.sentryCategoryPrefix}.estimateTopUpWithProof`,
        message: 'Failed to estimate top up with proof',
        data: {
          error,
          inputAsset,
          inputAmount,
          transferData,
          proof,
          bridgeType: mapBrideTypeToContractsConstant(bridgeType),
          bridgeData: bridgeData.toString('hex'),
          receiverHash: receiverHash.toString('hex')
        }
      });

      throw new OnChainServiceError('Failed to estimate top up with proof').wrap(error);
    }
  }

  protected async topUpWithProof(
    inputAsset: SmallTokenInfo,
    inputAmount: string,
    transferData: TransferData | undefined,
    blockNumber: number,
    proof: string,
    bridgeType: BridgeType,
    bridgeData: Buffer,
    receiverHash: Buffer,
    isUnwrapSupported: boolean,
    tokenAddressForSwap: string,
    onTransactionHash: (hash: string) => void,
    gasLimit: string,
    eb: ITransactionStateEventBus
  ): Promise<TransactionReceipt> {
    addSentryBreadcrumb({
      level: 'info',
      category: `${this.sentryCategoryPrefix}.topUpWithProof`,
      message: 'Ready to call CardTopupMPTProof',
      data: {
        inputAsset,
        inputAmount,
        transferData,
        blockNumber,
        proof,
        bridgeType: mapBrideTypeToContractsConstant(bridgeType),
        bridgeData: bridgeData.toString('hex'),
        receiverHash: receiverHash.toString('hex'),
        gasLimit
      }
    });

    this.checkTransferData(inputAsset, isUnwrapSupported, tokenAddressForSwap, transferData);

    return new Promise<TransactionReceipt>((resolve, reject) => {
      if (this.topUpProxyContract === undefined) {
        throw new NetworkFeatureNotSupportedError('Card Top Up with proof', this.network);
      }

      let contractMethodToCall;
      if (inputAsset.network === Network.ethereum) {
        // use ethereum version
        contractMethodToCall = this.topUpProxyContract.methods.CardTopupMPTProof(
          this.substituteAssetAddressIfNeeded(inputAsset.address),
          toWei(inputAmount, inputAsset.decimals),
          blockNumber,
          Buffer.from(proof, 'hex'),
          this.mapTransferDataToExpectedMinimumAmount(transferData),
          this.mapTransferDataToBytes(transferData),
          receiverHash
        );
      } else {
        // use l2 version
        contractMethodToCall = this.topUpProxyContract.methods.CardTopupMPTProof(
          this.substituteAssetAddressIfNeeded(inputAsset.address),
          toWei(inputAmount, inputAsset.decimals),
          blockNumber,
          Buffer.from(proof, 'hex'),
          this.mapTransferDataToExpectedMinimumAmount(transferData),
          this.mapTransferDataToBytes(transferData),
          mapBrideTypeToContractsConstant(bridgeType),
          bridgeData,
          receiverHash
        );
      }

      this.wrapWithSendMethodCallbacks(
        contractMethodToCall.send(
          this.getDefaultTransactionsParams(gasLimit, this.mapTransferDataToValue(transferData))
        ),
        (receipt) => {
          if (!sameAddress(getUSDCAssetData(this.network).address, inputAsset.address)) {
            eb.emit({ type: InternalTransactionType.Swap, state: State.Succeeded });
            if (bridgeType !== BridgeType.None) {
              eb.emit({
                type: InternalTransactionType.Bridge,
                state: State.Pending,
                hash: receipt.transactionHash
              });
            } else {
              eb.emit({
                type: InternalTransactionType.TopUp,
                state: State.Pending,
                hash: receipt.transactionHash
              });
            }
          }

          resolve(receipt);
        },
        reject,
        async (hash) => {
          await this.addMemPoolTxToLocalStorage({
            internalType: TransactionType.CardTopUp,
            token: inputAsset as Token,
            network: this.network,
            amount: inputAmount,
            timestamp: dayjs().unix(),
            direction: TransactionDirection.Out,
            hash: hash,
            toAddress: getNetworkAddress(this.network, 'TOP_UP_PROXY_ADDRESS')
          });
          eb.emit({ type: InternalTransactionType.Confirm, state: State.Succeeded });
          if (!sameAddress(getUSDCAssetData(this.network).address, inputAsset.address)) {
            eb.emit({ type: InternalTransactionType.Swap, state: State.Pending, hash: hash });
          } else {
            if (bridgeType !== BridgeType.None) {
              eb.emit({ type: InternalTransactionType.Bridge, state: State.Pending, hash: hash });
            } else {
              eb.emit({ type: InternalTransactionType.TopUp, state: State.Pending, hash: hash });
            }
          }
          onTransactionHash(hash);
        }
      );
    });
  }

  public async estimateTopUpWithTrust(
    inputAsset: SmallToken,
    inputAmount: string,
    transferData: TransferData | undefined,
    timestamp: number,
    backendData: string,
    bridgeType: BridgeType,
    bridgeData: Buffer,
    receiverHash: Buffer,
    isUnwrapSupported: boolean,
    tokenAddressForSwap: string
  ): Promise<string> {
    if (this.useMockEstimation) {
      return '3000000';
    }
    if (this.topUpProxyContract === undefined) {
      throw new NetworkFeatureNotSupportedError('Card Top Up', this.network);
    }

    this.checkTransferData(inputAsset, isUnwrapSupported, tokenAddressForSwap, transferData);

    try {
      let gasLimitObj;
      if (inputAsset.network === Network.ethereum) {
        gasLimitObj = await this.topUpProxyContract.methods
          .CardTopupTrusted(
            this.substituteAssetAddressIfNeeded(inputAsset.address),
            toWei(inputAmount, inputAsset.decimals),
            timestamp,
            Buffer.from(backendData, 'hex'),
            this.mapTransferDataToExpectedMinimumAmount(transferData),
            this.mapTransferDataToBytes(transferData),
            receiverHash
          )
          .estimateGas({
            from: this.currentAddress,
            value: this.mapTransferDataToValue(transferData)
          });
      } else {
        // use l2 version
        gasLimitObj = await this.topUpProxyContract.methods
          .CardTopupTrusted(
            this.substituteAssetAddressIfNeeded(inputAsset.address),
            toWei(inputAmount, inputAsset.decimals),
            timestamp,
            Buffer.from(backendData, 'hex'),
            this.mapTransferDataToExpectedMinimumAmount(transferData),
            this.mapTransferDataToBytes(transferData),
            mapBrideTypeToContractsConstant(bridgeType),
            bridgeData,
            receiverHash
          )
          .estimateGas({
            from: this.currentAddress,
            value: this.mapTransferDataToValue(transferData)
          });
      }

      return this.addGasBuffer(gasLimitObj.toString());
    } catch (error) {
      addSentryBreadcrumb({
        level: 'error',
        category: `${this.sentryCategoryPrefix}.estimateTopUpWithTrust`,
        message: 'Failed to estimate top up with trust from server',
        data: {
          error,
          inputAsset,
          inputAmount,
          transferData,
          backendData,
          bridgeType: mapBrideTypeToContractsConstant(bridgeType),
          bridgeData: bridgeData.toString('hex'),
          receiverHash: receiverHash.toString('hex')
        }
      });

      throw new OnChainServiceError('Failed to estimate top up with trust from server').wrap(error);
    }
  }

  protected async topUpWithTrust(
    inputAsset: SmallTokenInfo,
    inputAmount: string,
    transferData: TransferData | undefined,
    timestamp: number,
    backendData: string,
    bridgeType: BridgeType,
    bridgeData: Buffer,
    receiverHash: Buffer,
    isUnwrapSupported: boolean,
    tokenAddressForSwap: string,
    onTransactionHash: (hash: string) => void,
    gasLimit: string,
    eb: ITransactionStateEventBus
  ): Promise<TransactionReceipt> {
    addSentryBreadcrumb({
      level: 'info',
      category: `${this.sentryCategoryPrefix}.topUpWithTrust`,
      message: 'Ready to call CardTopupTrusted',
      data: {
        inputAsset,
        inputAmount,
        transferData,
        timestamp,
        backendData,
        bridgeType: mapBrideTypeToContractsConstant(bridgeType),
        bridgeData: bridgeData.toString('hex'),
        receiverHash: receiverHash.toString('hex'),
        gasLimit
      }
    });

    this.checkTransferData(inputAsset, isUnwrapSupported, tokenAddressForSwap, transferData);

    return new Promise<TransactionReceipt>((resolve, reject) => {
      if (this.topUpProxyContract === undefined) {
        throw new NetworkFeatureNotSupportedError('Card Top Up with trust', this.network);
      }

      let contractMethodToCall;
      if (inputAsset.network === Network.ethereum) {
        // use ethereum version
        contractMethodToCall = this.topUpProxyContract.methods.CardTopupTrusted(
          this.substituteAssetAddressIfNeeded(inputAsset.address),
          toWei(inputAmount, inputAsset.decimals),
          timestamp,
          Buffer.from(backendData, 'hex'),
          this.mapTransferDataToExpectedMinimumAmount(transferData),
          this.mapTransferDataToBytes(transferData),
          receiverHash
        );
      } else {
        // use l2 version
        contractMethodToCall = this.topUpProxyContract.methods.CardTopupTrusted(
          this.substituteAssetAddressIfNeeded(inputAsset.address),
          toWei(inputAmount, inputAsset.decimals),
          timestamp,
          Buffer.from(backendData, 'hex'),
          this.mapTransferDataToExpectedMinimumAmount(transferData),
          this.mapTransferDataToBytes(transferData),
          mapBrideTypeToContractsConstant(bridgeType),
          bridgeData,
          receiverHash
        );
      }

      this.wrapWithSendMethodCallbacks(
        contractMethodToCall.send(
          this.getDefaultTransactionsParams(gasLimit, this.mapTransferDataToValue(transferData))
        ),
        (receipt) => {
          if (bridgeType !== BridgeType.None) {
            eb.emit({
              type: InternalTransactionType.Bridge,
              state: State.Pending,
              hash: receipt.transactionHash
            });
          } else {
            eb.emit({
              type: InternalTransactionType.TopUp,
              state: State.Succeeded,
              hash: receipt.transactionHash
            });
          }

          resolve(receipt);
        },
        reject,
        async (hash) => {
          await this.addMemPoolTxToLocalStorage({
            internalType: TransactionType.CardTopUp,
            token: inputAsset as Token,
            network: this.network,
            amount: inputAmount,
            timestamp: dayjs().unix(),
            direction: TransactionDirection.Out,
            hash: hash,
            toAddress: getNetworkAddress(this.network, 'TOP_UP_PROXY_ADDRESS')
          });
          eb.emit({ type: InternalTransactionType.Confirm, state: State.Succeeded });
          if (!sameAddress(getUSDCAssetData(this.network).address, inputAsset.address)) {
            eb.emit({ type: InternalTransactionType.Swap, state: State.Pending, hash: hash });
          } else {
            if (bridgeType !== BridgeType.None) {
              eb.emit({ type: InternalTransactionType.Bridge, state: State.Pending, hash: hash });
            } else {
              eb.emit({ type: InternalTransactionType.TopUp, state: State.Pending, hash: hash });
            }
          }
          onTransactionHash(hash);
        }
      );
    });
  }

  public async estimateTopUpWithPermit(
    inputAsset: SmallToken,
    inputAmount: string,
    transferData: TransferData | undefined,
    permitCallData: string,
    bridgeType: BridgeType,
    bridgeData: Buffer,
    receiverHash: Buffer,
    isUnwrapSupported: boolean,
    tokenAddressForSwap: string
  ): Promise<string> {
    if (this.useMockEstimation) {
      return '3000000';
    }

    if (this.topUpProxyContract === undefined) {
      throw new NetworkFeatureNotSupportedError('Card Top Up', this.network);
    }

    this.checkTransferData(inputAsset, isUnwrapSupported, tokenAddressForSwap, transferData);

    try {
      let gasLimitObj;
      if (inputAsset.network === Network.ethereum) {
        // use ethereum version
        gasLimitObj = await this.topUpProxyContract.methods
          .CardTopupPermit(
            this.substituteAssetAddressIfNeeded(inputAsset.address),
            toWei(inputAmount, inputAsset.decimals),
            //this.web3Client.utils.hexToBytes(permitCallData),
            Buffer.from(permitCallData, 'hex'),
            this.mapTransferDataToExpectedMinimumAmount(transferData),
            this.mapTransferDataToBytes(transferData),
            receiverHash
          )
          .estimateGas({
            from: this.currentAddress,
            value: this.mapTransferDataToValue(transferData)
          });
      } else {
        // use l2 contract version
        gasLimitObj = await this.topUpProxyContract.methods
          .CardTopupPermit(
            this.substituteAssetAddressIfNeeded(inputAsset.address),
            toWei(inputAmount, inputAsset.decimals),
            //this.web3Client.utils.hexToBytes(permitCallData),
            Buffer.from(permitCallData, 'hex'),
            this.mapTransferDataToExpectedMinimumAmount(transferData),
            this.mapTransferDataToBytes(transferData),
            mapBrideTypeToContractsConstant(bridgeType),
            bridgeData,
            receiverHash
          )
          .estimateGas({
            from: this.currentAddress,
            value: this.mapTransferDataToValue(transferData)
          });
      }

      return this.addGasBuffer(gasLimitObj.toString());
    } catch (error) {
      addSentryBreadcrumb({
        level: 'error',
        category: `${this.sentryCategoryPrefix}.estimateTopUpWithPermit`,
        message: 'Failed to estimate top up with permit',
        data: {
          error,
          inputAsset,
          inputAmount,
          transferData,
          permitCallData,
          bridgeType: mapBrideTypeToContractsConstant(bridgeType),
          bridgeData: bridgeData.toString('hex'),
          receiverHash: receiverHash.toString('hex')
        }
      });

      throw new OnChainServiceError('Failed to estimate top up with permit').wrap(error);
    }
  }

  protected async topUpWithPermit(
    inputAsset: SmallTokenInfo,
    inputAmount: string,
    transferData: TransferData | undefined,
    permitCallData: string,
    bridgeType: BridgeType,
    bridgeData: Buffer,
    receiverHash: Buffer,
    isUnwrapSupported: boolean,
    tokenAddressForSwap: string,
    onTransactionHash: (hash: string) => void,
    gasLimit: string,
    eb: ITransactionStateEventBus
  ): Promise<TransactionReceipt> {
    addSentryBreadcrumb({
      level: 'info',
      category: `${this.sentryCategoryPrefix}.TopUpWithPermit`,
      message: 'Ready to call CardTopupPermit',
      data: {
        inputAsset,
        inputAmount,
        transferData,
        permitCallData,
        bridgeType: mapBrideTypeToContractsConstant(bridgeType),
        bridgeData: bridgeData.toString('hex'),
        receiverHash: receiverHash.toString('hex'),
        gasLimit
      }
    });

    this.checkTransferData(inputAsset, isUnwrapSupported, tokenAddressForSwap, transferData);

    return new Promise<TransactionReceipt>((resolve, reject) => {
      if (this.topUpProxyContract === undefined) {
        throw new NetworkFeatureNotSupportedError('Card Top Up with permit', this.network);
      }

      let contractMethodToCall;
      if (inputAsset.network === Network.ethereum) {
        // use ethereum version
        contractMethodToCall = this.topUpProxyContract.methods.CardTopupPermit(
          this.substituteAssetAddressIfNeeded(inputAsset.address),
          toWei(inputAmount, inputAsset.decimals),
          Buffer.from(permitCallData, 'hex'),
          this.mapTransferDataToExpectedMinimumAmount(transferData),
          this.mapTransferDataToBytes(transferData),
          receiverHash
        );
      } else {
        // use l2 version
        contractMethodToCall = this.topUpProxyContract.methods.CardTopupPermit(
          this.substituteAssetAddressIfNeeded(inputAsset.address),
          toWei(inputAmount, inputAsset.decimals),
          Buffer.from(permitCallData, 'hex'),
          this.mapTransferDataToExpectedMinimumAmount(transferData),
          this.mapTransferDataToBytes(transferData),
          mapBrideTypeToContractsConstant(bridgeType),
          bridgeData,
          receiverHash
        );
      }
      this.wrapWithSendMethodCallbacks(
        contractMethodToCall.send(
          this.getDefaultTransactionsParams(gasLimit, this.mapTransferDataToValue(transferData))
        ),
        (receipt) => {
          if (!sameAddress(getUSDCAssetData(this.network).address, inputAsset.address)) {
            eb.emit({ type: InternalTransactionType.Swap, state: State.Succeeded });
            if (bridgeType !== BridgeType.None) {
              eb.emit({
                type: InternalTransactionType.Bridge,
                state: State.Pending,
                hash: receipt.transactionHash
              });
            } else {
              eb.emit({
                type: InternalTransactionType.TopUp,
                state: State.Pending,
                hash: receipt.transactionHash
              });
            }
          }

          resolve(receipt);
        },
        reject,
        async (hash) => {
          await this.addMemPoolTxToLocalStorage({
            internalType: TransactionType.CardTopUp,
            token: inputAsset as Token,
            network: this.network,
            amount: inputAmount,
            timestamp: dayjs().unix(),
            direction: TransactionDirection.Out,
            hash: hash,
            toAddress: getNetworkAddress(this.network, 'TOP_UP_PROXY_ADDRESS')
          });
          eb.emit({ type: InternalTransactionType.Confirm, state: State.Succeeded });
          if (!sameAddress(getUSDCAssetData(this.network).address, inputAsset.address)) {
            eb.emit({ type: InternalTransactionType.Swap, state: State.Pending, hash: hash });
          } else {
            if (bridgeType !== BridgeType.None) {
              eb.emit({ type: InternalTransactionType.Bridge, state: State.Pending, hash: hash });
            } else {
              eb.emit({ type: InternalTransactionType.TopUp, state: State.Pending, hash: hash });
            }
          }
          onTransactionHash(hash);
        }
      );
    });
  }

  protected getAmountForBrideFromMinimumReceive(transferData?: TransferData): string {
    return new BigNumber(
      multiply(this.mapTransferDataToExpectedMinimumAmount(transferData), '0.75')
    ).toFixed(0);
  }

  protected async getBridgeData(
    bridgeType: BridgeType,
    amount: string
  ): Promise<BridgeDataResponse> {
    if (bridgeType === BridgeType.Across) {
      const bridgeFee = await this.acrossService.getRelayFee(
        this.network,
        this.usdcAssetData.address,
        amount
      );

      const bridgeFeeIndex = this.web3Client.utils.padLeft(
        new BigNumber(bridgeFee).toString(16),
        64
      );

      let acrossAddress = getNetworkAddress(this.network, 'ACROSS_ADDRESS');
      acrossAddress = acrossAddress.replace('0x', '');

      return {
        BridgeData: Buffer.from(`${acrossAddress}${bridgeFeeIndex}`, 'hex'),
        BridgeFeeInPercents: fromWei(bridgeFee, 18)
      };
    } else {
      throw new Error(`Bridge type ${bridgeType} - Not implemented`);
    }
  }

  protected async isUnwrapSupported(tokenAddress: string): Promise<boolean> {
    const transactionParams = {
      from: this.currentAddress
    } as TransactionsParams;

    if (this.topUpProxyContract === undefined) {
      throw new MoverError('topUpProxyContract is undefined in IsUnwrapSupported function');
    }

    const isUnwrapSupported = await this.topUpProxyContract.methods
      .unwrapSupported(tokenAddress)
      .call(transactionParams);

    return isUnwrapSupported;
  }

  protected async estimateUnwrapData(
    tokenAddress: string,
    amountInWei: string
  ): Promise<UnwrapEstimationData> {
    const transactionParams = {
      from: this.currentAddress
    } as TransactionsParams;

    if (this.topUpProxyContract === undefined) {
      throw new MoverError('topUpProxyContract is undefined in EstimateUnwrapData function');
    }

    const { 0: newTokenAddress, 1: newAmountInWei } = await this.topUpProxyContract.methods
      .estimateUnwrap(tokenAddress, amountInWei)
      .call(transactionParams);

    return {
      UnwrappedTokenAddress: newTokenAddress,
      UnwrappedAmountInWei: newAmountInWei
    };
  }

  protected checkTransferData(
    inputAsset: SmallTokenInfo,
    isUnwrapSupported: boolean,
    tokenAddressForSwap: string,
    transferData: TransferData | undefined
  ): void {
    if (
      !isUnwrapSupported &&
      !sameAddress(inputAsset.address, this.usdcAssetData.address) &&
      transferData === undefined
    ) {
      throw new OnChainServiceError('missing transferData');
    }

    if (
      isUnwrapSupported &&
      !sameAddress(tokenAddressForSwap, this.usdcAssetData.address) &&
      transferData === undefined
    ) {
      throw new OnChainServiceError('missing transferData (with unwrap)');
    }
  }
}

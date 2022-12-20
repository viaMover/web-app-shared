import { BigNumber } from 'bignumber.js';
import dayjs from 'dayjs';
import Web3 from 'web3';
import { TransactionReceipt } from 'web3-eth';

import { sameAddress } from '../../../../helpers/addresses';
import {
  fromWei,
  getInteger,
  greaterThan,
  isEqual,
  multiply,
  sub,
  toWei
} from '../../../../helpers/bigmath';
import { asyncSleep } from '../../../../helpers/sleep';
import { addSentryBreadcrumb } from '../../../../logs/sentry';
import { getCentralTransferProxyAbi } from '../../../../references/abi';
import { getTopUpProxyAbi } from '../../../../references/abi/topup-proxy';
import { getUSDCAssetData } from '../../../../references/assets';
import { BridgeType, mapBrideTypeToContractsConstant } from '../../../../references/bridge';
import { gasDefaults } from '../../../../references/gasDefaults';
import { Network } from '../../../../references/network';
import {
  getNetwork,
  getNetworkAddress,
  getNetworkConstant,
  getSlippage,
  isBaseAssetByNetwork
} from '../../../../references/references';
import { addresses as aTokenAddresses } from '../../../../references/specialTokens/aTokensData';
import { addresses as idleTokenAddresses } from '../../../../references/specialTokens/idleTokensData';
import { addresses as yearnSimpleVaultAddresses } from '../../../../references/specialTokens/yearnVaultsData';
import {
  PermitData,
  SmallToken,
  SmallTokenInfo,
  Token,
  TokenWithPrice
} from '../../../../references/tokens';
import { AcrossAPIService } from '../../../api/mover/across/AcrossAPIService';
import { TxData } from '../../../api/mover/activity/types';
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
import { CompoundEstimateWithUnwrapResponse, UnwrappedData, WrappedData } from '../../types';
import { WrappedTokenAToken } from '../../wrapped-tokens/aTokens/token';
import { WrappedTokenDCult } from '../../wrapped-tokens/dCULT/token';
import { WrappedTokenGALCX } from '../../wrapped-tokens/gALCX/token';
import { WrappedTokenGOHM } from '../../wrapped-tokens/gOHM/token';
import { WrappedTokenIdle } from '../../wrapped-tokens/idle/token';
import { WrappedToken } from '../../wrapped-tokens/WrappedToken';
import { WrappedTokenWXBTRFLY } from '../../wrapped-tokens/wxBTRFLY/token';
import { WrappedTokenYearn } from '../../wrapped-tokens/yearn/token';
import { MoverOnChainService } from '../MoverOnChainService';
import { ProveOnChainService } from '../prove-txn/ProveOnChainService';
import { TransferProxyContract } from '../types';
import { BridgeDataResponse, TopUpProxyContract } from './types';

export class DebitCardOnChainService extends MoverOnChainService {
  protected readonly sentryCategoryPrefix = 'debit-card.on-chain.service';

  specialTokenHandlers: Array<WrappedToken> = [];

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

    Object.entries(yearnSimpleVaultAddresses).forEach(([n, vaults]) => {
      vaults.forEach((vault) => {
        this.specialTokenHandlers.push(
          new WrappedTokenYearn(
            vault.vaultToken.address,
            this.currentAddress,
            n as Network,
            this.web3Client
          )
        );
      });
    });

    Object.entries(idleTokenAddresses).forEach(([n, idleTokens]) => {
      idleTokens.forEach((idleToken) => {
        this.specialTokenHandlers.push(
          new WrappedTokenIdle(
            idleToken.wrapToken.address,
            this.currentAddress,
            n as Network,
            this.web3Client
          )
        );
      });
    });

    for (const [n, aTokens] of Object.entries(aTokenAddresses)) {
      for (const aToken of aTokens) {
        this.specialTokenHandlers.push(
          new WrappedTokenAToken(
            aToken.wrapToken.address,
            this.currentAddress,
            n as Network,
            this.web3Client
          )
        );
      }
    }

    this.specialTokenHandlers.push(
      new WrappedTokenWXBTRFLY(this.currentAddress, Network.ethereum, this.web3Client)
    );
    this.specialTokenHandlers.push(
      new WrappedTokenDCult(this.currentAddress, Network.ethereum, this.web3Client)
    );
    this.specialTokenHandlers.push(
      new WrappedTokenGALCX(this.currentAddress, Network.ethereum, this.web3Client)
    );
    this.specialTokenHandlers.push(
      new WrappedTokenGOHM(this.currentAddress, Network.ethereum, this.web3Client)
    );
  }

  public async explainTopUpCompound(
    inputAsset: SmallToken & PermitData,
    amountInWei: string
  ): Promise<TransactionScenario> {
    let index = 0;
    const steps = new Array<TransactionStateItem>();

    const specialTokenHandler = this.specialTokenHandlers.find((h) =>
      h.canHandle(inputAsset.address, inputAsset.network)
    );

    if (specialTokenHandler !== undefined) {
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
        type: InternalTransactionType.Unwrap,
        state: State.Queued,
        estimation: 15,
        token: inputAsset,
        network: inputAsset.network,
        timestamp: 0
      });

      const unwrappedTokenData = specialTokenHandler.getUnwrappedToken();
      const unwrappedTokenPermitData = await this.assetsService.getPermitData(
        unwrappedTokenData.address,
        inputAsset.network
      );

      inputAsset = {
        ...unwrappedTokenData,
        ...unwrappedTokenPermitData
      };
    }

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
        if (sameAddress(inputAsset.address, this.tetherAddress)) {
          const allowance = await this.getAllowance(
            inputAsset.address,
            inputAsset.network,
            this.topUpProxyAddress
          );
          if (greaterThan(allowance, '0') && !isEqual(allowance, amountInWei)) {
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

  public getUnwrappedToken(inputAsset: SmallToken): SmallToken {
    const specialTokenHandler = this.specialTokenHandlers.find((h) =>
      h.canHandle(inputAsset.address, this.network)
    );

    if (specialTokenHandler !== undefined) {
      return specialTokenHandler.getUnwrappedToken();
    }

    return inputAsset;
  }

  /**
   * return price of the unwrapped token (return input price in case of simple token)
   * throws exception in case of price is unavailable
   * @param inputAsset
   * @param inputAssetPrice
   */
  public async getUnwrappedTokenPrice(inputAsset: Token, inputAssetPrice: string): Promise<string> {
    const specialTokenHandler = this.specialTokenHandlers.find((h) =>
      h.canHandle(inputAsset.address, inputAsset.network)
    );

    if (specialTokenHandler !== undefined) {
      return await this.getPriceByAddress(
        specialTokenHandler.getUnwrappedToken().address,
        inputAsset.network
      );
    }

    return inputAssetPrice;
  }

  public async getUnwrappedData(
    inputAsset: Token,
    inputAmount: string,
    inputAssetPrice: string
  ): Promise<UnwrappedData> {
    const specialTokenHandler = this.specialTokenHandlers.find((h) =>
      h.canHandle(inputAsset.address, inputAsset.network)
    );

    if (specialTokenHandler === undefined) {
      return {
        unwrappedToken: inputAsset,
        amountInWei: toWei(inputAmount, inputAsset.decimals),
        unwrappedTokenPrice: inputAssetPrice
      };
    }

    const newAmount = await specialTokenHandler.getUnwrappedAmount(inputAmount);
    const unwrappedToken = specialTokenHandler.getUnwrappedToken();

    let unwrappedTokenPrice = '0';
    try {
      unwrappedTokenPrice = await this.getPriceByAddress(
        unwrappedToken.address,
        inputAsset.network
      );
    } catch (e) {
      addSentryBreadcrumb({
        level: 'error',
        category: `${this.sentryCategoryPrefix}.getUnwrappedData`,
        message: 'can not get unwrapped token price, return zero',
        data: {
          error: e,
          assetAddress: unwrappedToken.address
        }
      });
    }

    return {
      unwrappedToken,
      amountInWei: getInteger(toWei(newAmount, unwrappedToken.decimals)),
      unwrappedTokenPrice
    };
  }

  public async getWrappedDataByUnwrapped(
    wrappedAsset: Token,
    unwrappedAsset: SmallTokenInfo,
    unwrappedAmount: string
  ): Promise<WrappedData> {
    const specialTokenHandler = this.specialTokenHandlers.find((h) =>
      h.canHandle(wrappedAsset.address, wrappedAsset.network)
    );

    if (specialTokenHandler === undefined) {
      // unwrappedAsset should be equal to wrappedAsset
      return {
        wrappedToken: unwrappedAsset,
        amountInWei: toWei(unwrappedAmount, unwrappedAsset.decimals)
      };
    }

    const newAmount = await specialTokenHandler.getWrappedAmountByUnwrapped(unwrappedAmount);

    return {
      wrappedToken: wrappedAsset,
      amountInWei: getInteger(toWei(newAmount, wrappedAsset.decimals))
    };
  }

  public async topUpCompound(
    inputAsset: SmallToken & PermitData,
    inputNetwork: Network,
    inputAmount: string,
    transferData: TransferData | undefined,
    tagHash: string,
    bridgingFeeInUSDC: string,
    onTransactionHash: (hash: string, data: TxData) => void,
    eb: ITransactionStateEventBus
  ): Promise<TransactionReceipt> {
    try {
      const specialTokenHandler = this.specialTokenHandlers.find((h) =>
        h.canHandle(inputAsset.address, inputNetwork)
      );
      if (specialTokenHandler !== undefined) {
        eb.emit({
          type: InternalTransactionType.Confirm,
          state: State.Pending
        });
        const unwrapEstimation = await specialTokenHandler.estimateUnwrap(inputAsset, inputAmount);

        let inputAmountInWei = '0';
        try {
          inputAmountInWei = await specialTokenHandler.unwrap(
            inputAsset,
            inputAmount,
            async () => {
              //
            },
            unwrapEstimation.gasLimit,
            eb
          );
        } catch (error) {
          this.rethrowIfUserRejectedRequest(error, EECode.userRejectTransaction);
          throw error;
        }

        const unwrappedTokenData = specialTokenHandler.getUnwrappedToken();
        const unwrappedTokenPermitData = await this.assetsService.getPermitData(
          unwrappedTokenData.address,
          inputNetwork
        );

        inputAsset = {
          ...unwrappedTokenData,
          ...unwrappedTokenPermitData
        };
        inputAmount = fromWei(inputAmountInWei, inputAsset.decimals);

        if (!sameAddress(inputAsset.address, this.usdcAssetData.address)) {
          transferData = await this.swapService.getTransferData(
            this.usdcAssetData.address,
            inputAsset.address,
            inputAmountInWei,
            true,
            getSlippage(inputAsset.address, this.network),
            getNetworkAddress(this.network, 'TOP_UP_EXCHANGE_PROXY_ADDRESS')
          );
        } else {
          transferData = undefined;
        }
      }
      eb.emit({ type: InternalTransactionType.Confirm, state: State.Pending });
      const bridgeType = getNetworkConstant(this.network, 'BRIDGE_TYPE');
      if (bridgeType === undefined) {
        throw new OnChainServiceError('Failed to top up: bridge type is undefined');
      }

      let bridgeData = Buffer.from([]);
      if (bridgeType !== BridgeType.None) {
        const amountForBridge = sameAddress(inputAsset.address, this.usdcAssetData.address)
          ? toWei(inputAmount, inputAsset.decimals)
          : this.getAmountForBrideFromMinimumReceive(transferData);
        const bridgeDataResp = await this.getBridgeData(bridgeType, amountForBridge);
        bridgeData = bridgeDataResp.BridgeData;

        let usdcSent: string;
        if (transferData === undefined) {
          usdcSent = toWei(inputAmount, this.usdcAssetData.decimals);
        } else {
          usdcSent = transferData.buyAmount;
        }

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
          receiverHash
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
    onTransactionHash: (hash: string, data: TxData) => void,
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
        receiverHash
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
        receiverHash
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
    receiverHash: Buffer
  ): Promise<string> {
    if (this.useMockEstimation) {
      return '3000000';
    }

    if (this.topUpProxyContract === undefined) {
      throw new NetworkFeatureNotSupportedError('Card Top Up', this.network);
    }

    if (
      !sameAddress(inputAsset.address, this.usdcAssetData.address) &&
      transferData === undefined
    ) {
      throw new OnChainServiceError('Failed to estimate top up for USDC: missing transferData');
    }

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
    onTransactionHash: (hash: string, data: TxData) => void,
    gasLimit: string,
    eb: ITransactionStateEventBus
  ): Promise<TransactionReceipt> {
    if (
      !sameAddress(inputAsset.address, this.usdcAssetData.address) &&
      transferData === undefined
    ) {
      throw new OnChainServiceError('Failed to execute Top Up with proof: missing transferData');
    }

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
          onTransactionHash(hash, {
            amount: inputAmount,
            hash: hash,
            networkFrom: this.network,
            networkTo: Network.ethereum,
            token: inputAsset
          });
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
    receiverHash: Buffer
  ): Promise<string> {
    if (this.useMockEstimation) {
      return '3000000';
    }
    if (this.topUpProxyContract === undefined) {
      throw new NetworkFeatureNotSupportedError('Card Top Up', this.network);
    }

    if (
      !sameAddress(inputAsset.address, this.usdcAssetData.address) &&
      transferData === undefined
    ) {
      throw new OnChainServiceError('Failed to estimate top up for USDC: missing transferData');
    }

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
    onTransactionHash: (hash: string, data: TxData) => void,
    gasLimit: string,
    eb: ITransactionStateEventBus
  ): Promise<TransactionReceipt> {
    if (
      !sameAddress(inputAsset.address, this.usdcAssetData.address) &&
      transferData === undefined
    ) {
      throw new OnChainServiceError('Failed to execute Top Up with trust: missing transferData');
    }

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
          onTransactionHash(hash, {
            amount: inputAmount,
            hash: hash,
            networkFrom: this.network,
            networkTo: Network.ethereum,
            token: inputAsset
          });
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
    receiverHash: Buffer
  ): Promise<string> {
    if (this.useMockEstimation) {
      return '3000000';
    }

    if (this.topUpProxyContract === undefined) {
      throw new NetworkFeatureNotSupportedError('Card Top Up', this.network);
    }

    if (
      !sameAddress(inputAsset.address, this.usdcAssetData.address) &&
      transferData === undefined
    ) {
      throw new OnChainServiceError('Failed to estimate top up for USDC: missing transferData');
    }

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
    onTransactionHash: (hash: string, data: TxData) => void,
    gasLimit: string,
    eb: ITransactionStateEventBus
  ): Promise<TransactionReceipt> {
    if (
      !sameAddress(inputAsset.address, this.usdcAssetData.address) &&
      transferData === undefined
    ) {
      throw new OnChainServiceError('Failed to execute Top Up with permit: missing transferData');
    }

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
          onTransactionHash(hash, {
            amount: inputAmount,
            hash: hash,
            networkFrom: this.network,
            networkTo: Network.ethereum,
            token: inputAsset
          });
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

  protected async getPriceByAddress(tokenAddress: string, tokenNetwork: Network): Promise<string> {
    const walletTokens = this.getWalletTokens();
    const inWalletToken = walletTokens.find(
      (t) => sameAddress(tokenAddress, t.address) && t.network === tokenNetwork
    );
    if (inWalletToken !== undefined && greaterThan(inWalletToken.priceUSD, '0')) {
      return inWalletToken.priceUSD;
    }

    try {
      return await this.getTokenPrice(tokenAddress, this.network);
    } catch (err) {
      addSentryBreadcrumb({
        level: 'error',
        category: `${this.sentryCategoryPrefix}.getPriceByAddress`,
        message: 'Failed to get token price from token price',
        data: {
          tokenAddress
        }
      });
      throw new MoverError('Can not get token price', {
        tokenAddress
      });
    }
  }

  public async estimateTopUpCompoundLegacy(
    inputAsset: SmallToken,
    inputAmount: string,
    transferData: TransferData | undefined
  ): Promise<CompoundEstimateWithUnwrapResponse> {
    if (this.centralTransferProxyContract === undefined) {
      throw new NetworkFeatureNotSupportedError('Card Top Up', this.network);
    }

    const specialTokenHandler = this.specialTokenHandlers.find((h) =>
      h.canHandle(inputAsset.address, this.network)
    );

    if (specialTokenHandler !== undefined) {
      addSentryBreadcrumb({
        level: 'info',
        category: `${this.sentryCategoryPrefix}.estimateTopUpCompoundLegacy`,
        message: 'Special token',
        data: {
          inputAsset: inputAsset,
          unwrapTo: specialTokenHandler.getUnwrappedToken().symbol
        }
      });

      let estimation;
      try {
        estimation = await specialTokenHandler.estimateUnwrap(inputAsset, inputAmount);
      } catch (error) {
        addSentryBreadcrumb({
          level: 'error',
          category: `${this.sentryCategoryPrefix}.estimateTopUpCompoundLegacy`,
          message: 'failed to estimate unwrap',
          data: {
            error
          }
        });

        throw new OnChainServiceError('Failed to estimate top up').wrap(error);
      }

      return {
        actionGasLimit: gasDefaults.basic_move_card_top_up,
        approveGasLimit: gasDefaults.basic_approval,
        unwrapGasLimit: estimation.gasLimit
      };
    }

    if (
      !sameAddress(inputAsset.address, this.usdcAssetData.address) &&
      transferData === undefined
    ) {
      throw new OnChainServiceError('Failed to estimate top up: missing transferData');
    }

    const approveGasLimit = await this.estimateApproveIfNeeded(
      inputAsset,
      inputAmount,
      this.centralTransferProxyAddress
    );

    if (approveGasLimit !== undefined) {
      return {
        actionGasLimit: gasDefaults.basic_move_card_top_up,
        approveGasLimit: approveGasLimit,
        unwrapGasLimit: '0'
      };
    }

    try {
      const gasLimitObj = await this.centralTransferProxyContract.methods
        .cardTopUp(
          this.currentAddress,
          this.substituteAssetAddressIfNeeded(inputAsset.address),
          toWei(inputAmount, inputAsset.decimals),
          this.mapTransferDataToExpectedMinimumAmount(transferData),
          this.mapTransferDataToBytes(transferData)
        )
        .estimateGas({
          from: this.currentAddress,
          value: this.mapTransferDataToValue(transferData)
        });

      if (gasLimitObj) {
        return {
          approveGasLimit: '0',
          unwrapGasLimit: '0',
          actionGasLimit: this.addGasBuffer(gasLimitObj.toString())
        };
      }
    } catch (error) {
      addSentryBreadcrumb({
        level: 'error',
        category: `${this.sentryCategoryPrefix}.estimateTopUpCompoundLegacy`,
        message: 'Failed to estimate top up',
        data: {
          error,
          inputAsset,
          inputAmount,
          transferData
        }
      });

      throw new OnChainServiceError('Failed to estimate top up').wrap(error);
    }

    addSentryBreadcrumb({
      level: 'error',
      category: `${this.sentryCategoryPrefix}.estimateTopUpCompoundLegacy`,
      message: 'Failed to estimate top up: empty gas limit',
      data: {
        inputAsset,
        inputAmount,
        transferData
      }
    });

    throw new OnChainServiceError('Failed to estimate top up: empty gas limit');
  }

  protected async topUpLegacy(
    inputAsset: SmallTokenInfo,
    inputAmount: string,
    transferData: TransferData | undefined,
    changeStepToProcess: () => Promise<void>,
    gasLimit: string
  ): Promise<TransactionReceipt> {
    if (
      !sameAddress(inputAsset.address, this.usdcAssetData.address) &&
      transferData === undefined
    ) {
      throw new OnChainServiceError('Failed to execute Top Up: missing transferData');
    }

    return new Promise<TransactionReceipt>((resolve, reject) => {
      if (this.centralTransferProxyContract === undefined) {
        throw new NetworkFeatureNotSupportedError('Card Top Up', this.network);
      }

      this.wrapWithSendMethodCallbacks(
        this.centralTransferProxyContract.methods
          .cardTopUp(
            this.currentAddress,
            this.substituteAssetAddressIfNeeded(inputAsset.address),
            toWei(inputAmount, inputAsset.decimals),
            this.mapTransferDataToExpectedMinimumAmount(transferData),
            this.mapTransferDataToBytes(transferData)
          )
          .send(
            this.getDefaultTransactionsParams(gasLimit, this.mapTransferDataToValue(transferData))
          ),
        resolve,
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
            toAddress: getNetworkAddress(this.network, 'TRANSFER_PROXY_ADDRESS')
          });
          changeStepToProcess();
        }
      );
    });
  }

  protected async getTokenPrice(address: string, network: Network): Promise<string> {
    const response = await this.assetsService.getTokenPrices([
      { address: address, network: network }
    ]);

    return (
      response.find((t) => sameAddress(t.address, address) && t.network === network)?.price ?? '0'
    );
  }
}

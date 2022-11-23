import { BigNumber } from 'bignumber.js';
import { convertStringToHexWithPrefix } from 'web-app-shared/helpers/addresses';
import { multiply } from 'web-app-shared/helpers/bigmath';
import { addSentryBreadcrumb } from 'web-app-shared/logs/sentry';
import { Network } from 'web-app-shared/references/network';
import { getNetworkAddress } from 'web-app-shared/references/references';
import { AddressMapKey } from 'web-app-shared/references/types';
import { MoverAPISubsidizedService } from 'web-app-shared/services/api/mover/subsidized/MoverAPISubsidizedService';
import { TransferData } from 'web-app-shared/services/api/swap/types';
import { SubsidizedTransactionsOnChainService } from 'web-app-shared/services/onchain/mover/subsidized/SubsidizedTransactionsOnChainService';
import { PreparedAction } from 'web-app-shared/services/onchain/mover/subsidized/types';
import Web3 from 'web3';
import { ContractOptions } from 'web3-eth-contract';
import { AbiItem } from 'web3-utils';

import { OnChainService } from '../OnChainService';
import { CustomContractType } from '../types';

export abstract class MoverOnChainService extends OnChainService {
  protected subsidizedOnChainService: SubsidizedTransactionsOnChainService;

  protected readonly subsidizedAPIService: MoverAPISubsidizedService;
  protected constructor(
    sentryCategoryPrefix: string,
    currentAddress: string,
    network: Network,
    web3Client: Web3
  ) {
    super(sentryCategoryPrefix, currentAddress, network, web3Client);
    this.subsidizedAPIService = new MoverAPISubsidizedService(currentAddress, network);
    this.subsidizedOnChainService = new SubsidizedTransactionsOnChainService(
      sentryCategoryPrefix,
      this.currentAddress,
      this.network,
      this.web3Client
    );
  }

  protected mapTransferDataToBytes(data?: TransferData): number[] {
    return MoverOnChainService.mapTransferDataToBytes(this.web3Client, data);
  }

  protected static mapTransferDataToBytes(web3Client: Web3, data?: TransferData): number[] {
    if (data === undefined) {
      return [];
    }

    return Array.prototype.concat(
      web3Client.utils.hexToBytes(data.to),
      web3Client.utils.hexToBytes(data.allowanceTarget),
      web3Client.utils.hexToBytes(
        web3Client.utils.padLeft(convertStringToHexWithPrefix(data.value), 64)
      ),
      web3Client.utils.hexToBytes(data.data)
    );
  }

  protected mapTransferDataToExpectedMinimumAmount(
    data?: TransferData,
    multiplier = '0.85'
  ): string {
    return MoverOnChainService.mapTransferDataToExpectedMinimumAmount(data, multiplier);
  }

  protected static mapTransferDataToExpectedMinimumAmount(
    data?: TransferData,
    multiplier = '0.85'
  ): string {
    if (data === undefined || data.buyAmount === undefined) {
      return '0';
    }

    return new BigNumber(multiply(data.buyAmount, multiplier)).toFixed(0);
  }

  protected mapTransferDataToValue(data?: TransferData): string {
    return MoverOnChainService.mapTransferDataToValue(this.web3Client, data);
  }

  protected static mapTransferDataToValue(web3Client: Web3, data?: TransferData): string {
    if (data === undefined || data.value === undefined) {
      return '0';
    }

    return web3Client.utils.toHex(data.value);
  }

  protected async prepareSubsidizedAction(actionString: string): Promise<PreparedAction> {
    return this.subsidizedOnChainService.prepareSubsidizedAction(actionString);
  }

  protected createContract<M = void>(
    contractAddressMapKey: AddressMapKey,
    jsonInterface: AbiItem[] | AbiItem,
    options?: ContractOptions
  ): CustomContractType<M> | undefined {
    const contract = this.createArbitraryContract<M>(
      getNetworkAddress(this.network, contractAddressMapKey),
      jsonInterface,
      options
    );

    if (contract !== undefined) {
      return contract;
    }

    addSentryBreadcrumb({
      type: 'warning',
      category: this.sentryCategoryPrefix,
      message: 'Contract is not available in current network',
      data: {
        network: this.network,
        name: contractAddressMapKey
      }
    });
    return undefined;
  }
}

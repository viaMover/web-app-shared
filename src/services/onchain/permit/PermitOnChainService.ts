import {
  Eip2612PermitUtils,
  PermitParams,
  Web3ProviderConnector
} from '@1inch/permit-signed-approvals-utils';
import Web3 from 'web3';
import { AbiItem } from 'web3-utils';

import { addSentryBreadcrumb } from '../../../logs/sentry';
import { ERC20_ABI, ERC2612_PERMIT_ABI } from '../../../references/abi';
import { Network } from '../../../references/network';
import { MoverError } from '../../MoverError';
import { OnChainService } from '../OnChainService';
import { TransactionsParams } from '../types';

/**
 * A class representing basic functions for EIP-2612 Permit
 */
export class PermitOnChainService extends OnChainService {
  constructor(currentAddress: string, network: Network, web3Client: Web3) {
    super('permit.on-chain.service', currentAddress, network, web3Client);
  }

  public async buildPermitData(
    outputType: 'signature' | 'callData',
    permitType: string,
    currentAddress: string,
    tokenAddress: string,
    contractAddress: string,
    chainId: number,
    value: string,
    deadline: number,
    version = '1'
  ): Promise<string> {
    const erc20Name = await this.getErc20Name(currentAddress, tokenAddress);
    addSentryBreadcrumb({
      type: 'info',
      category: this.sentryCategoryPrefix,
      message: 'get erc20 name from token contract',
      data: {
        currentAddress,
        tokenAddress,
        erc20Name
      }
    });

    const connector = new Web3ProviderConnector(this.web3Client as any);
    const eip2612PermitUtils = new Eip2612PermitUtils(connector, {
      enabledCheckSalt: true
    });

    if (permitType === 'erc2612') {
      const domainSeparatorFromContract = await this.getDomainSeparator(
        currentAddress,
        tokenAddress
      );

      const constructedDomainSeparatorWithoutVersion =
        await this.constructDomainSeparatorWithoutVersion(
          erc20Name,
          version,
          chainId,
          tokenAddress
        );

      const constructedDomainSeparatorWithSaltAndWithoutChainId =
        await this.constructDomainSeparatorSaltAndWithoutChainId(
          erc20Name,
          version,
          chainId,
          tokenAddress
        );

      addSentryBreadcrumb({
        type: 'info',
        category: this.sentryCategoryPrefix,
        message: 'domain separators',
        data: {
          domainSeparatorFromContract,
          constructedDomainSeparatorWithoutVersion,
          constructedDomainSeparatorWithSaltAndWithoutChainId
        }
      });

      const nonce = await eip2612PermitUtils.getTokenNonce(tokenAddress, currentAddress);
      addSentryBreadcrumb({
        type: 'info',
        category: this.sentryCategoryPrefix,
        message: 'get nonce from token contract',
        data: {
          currentAddress,
          tokenAddress,
          nonce
        }
      });

      const permitParams: PermitParams = {
        owner: currentAddress,
        spender: contractAddress,
        value: value,
        nonce: nonce,
        deadline: deadline
      };

      if (outputType === 'callData') {
        return eip2612PermitUtils.buildPermitCallData(
          permitParams,
          chainId,
          erc20Name,
          tokenAddress,
          version
        );
      } else {
        return eip2612PermitUtils.buildPermitSignature(
          permitParams,
          chainId,
          erc20Name,
          tokenAddress,
          version
        );
      }
    } else {
      throw new MoverError(`Unsupported permit type: ${permitType}`);
    }
  }

  async constructDomainSeparatorWithoutVersion(
    tokenName: string,
    version: string,
    chainId: number,
    tokenAddress: string
  ): Promise<string> {
    const DOMAIN_SEPARATOR = Web3.utils.keccak256(
      this.web3Client.eth.abi.encodeParameters(
        ['bytes32', 'bytes32', 'bytes32', 'uint256', 'address'],
        [
          Web3.utils.keccak256(
            'EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)'
          ),
          Web3.utils.keccak256(tokenName),
          Web3.utils.keccak256(version),
          chainId,
          tokenAddress
        ]
      )
    );
    return DOMAIN_SEPARATOR;
  }

  async constructDomainSeparatorSaltAndWithoutChainId(
    tokenName: string,
    version: string,
    chainId: number,
    tokenAddress: string
  ): Promise<string> {
    const DOMAIN_SEPARATOR = Web3.utils.keccak256(
      this.web3Client.eth.abi.encodeParameters(
        ['bytes32', 'bytes32', 'bytes32', 'address', 'bytes32'],
        [
          Web3.utils.keccak256(
            'EIP712Domain(string name,string version,address verifyingContract,bytes32 salt)'
          ),
          Web3.utils.keccak256(tokenName),
          Web3.utils.keccak256(version),
          tokenAddress,
          this.web3Client.eth.abi.encodeParameter('uint256', `${chainId}`)
        ]
      )
    );
    return DOMAIN_SEPARATOR;
  }

  protected async getErc20Name(currentAddress: string, tokenAddress: string): Promise<string> {
    const tokenContract = new this.web3Client.eth.Contract(ERC20_ABI as AbiItem[], tokenAddress);

    const transactionParams = {
      from: currentAddress
    } as TransactionsParams;

    const name = await tokenContract.methods.name().call(transactionParams);
    return name.toString();
  }

  protected async getPermitNonce(currentAddress: string, tokenAddress: string): Promise<number> {
    const tokenContract = new this.web3Client.eth.Contract(
      ERC2612_PERMIT_ABI as AbiItem[],
      tokenAddress
    );

    const transactionParams = {
      from: currentAddress
    } as TransactionsParams;

    const nonce = await tokenContract.methods.nonces(currentAddress).call(transactionParams);
    return Number(nonce);
  }

  protected async getDomainSeparator(
    currentAddress: string,
    tokenAddress: string
  ): Promise<number> {
    const tokenContract = new this.web3Client.eth.Contract(
      ERC2612_PERMIT_ABI as AbiItem[],
      tokenAddress
    );

    const transactionParams = {
      from: currentAddress
    } as TransactionsParams;

    const domainSeparator = await tokenContract.methods.DOMAIN_SEPARATOR().call(transactionParams);
    return domainSeparator.toString();
  }

  splitSig(sig: string): { r: string; s: string; v: number } {
    // splits the signature to r, s, and v values.
    const pureSig = sig.replace('0x', '');

    const r = pureSig.substring(0, 64);
    const s = pureSig.substring(64, 128);
    const v = parseInt(pureSig.substring(128, 130), 16);

    return {
      r,
      s,
      v
    };
  }
}

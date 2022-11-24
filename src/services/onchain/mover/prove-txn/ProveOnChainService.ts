import { BlockHeader } from '@ethereumjs/block';
import { Chain, Common, CustomChain, Hardfork } from '@ethereumjs/common';
import { RLP } from '@ethereumjs/rlp';
import {
  AccessListEIP2930Transaction,
  AccessListItem,
  FeeMarketEIP1559Transaction,
  Transaction,
  TypedTransaction
} from '@ethereumjs/tx';
import { Address, bigIntToUnpaddedBuffer } from '@ethereumjs/util';
import { BaseTrie as Trie } from 'merkle-patricia-tree';
import { BranchNode, ExtensionNode, LeafNode } from 'merkle-patricia-tree/dist.browser/trieNode';
import Web3 from 'web3';

import { addSentryBreadcrumb } from '../../../../logs/sentry';
import { Network } from '../../../../references/network';
import { getNetwork } from '../../../../references/references';
import { MoverError } from '../../../MoverError';
import { consumeCommonPrefix, getNibbles } from '../../../utils/mpt';
import { bigIntToDecimalString, bigIntToHexString, uintBufferToHex } from '../../../utils/parsing';
import { MoverOnChainService } from '../MoverOnChainService';
import { RPCTransaction } from './types';

export class ProveOnChainService extends MoverOnChainService {
  constructor(currentAddress: string, network: Network, web3Client: Web3) {
    super('prove.on-chain.service', currentAddress, network, web3Client);
  }

  public async calcTransactionProof(
    network: Network,
    blockNumber: number,
    txIndex: number
  ): Promise<Uint8Array> {
    addSentryBreadcrumb({
      type: 'info',
      category: this.sentryCategoryPrefix,
      message: 'calcTransactionProof started',
      data: {
        network,
        blockNumber,
        txIndex
      }
    });

    let common: Common;
    switch (network) {
      case Network.polygon:
        common = Common.custom(CustomChain.PolygonMainnet);
        break;
      case Network.ethereum:
        common = new Common({
          chain: Chain.Mainnet
        });
        break;
      case Network.optimism:
        common = Common.custom(CustomChain.OptimisticEthereum);
        break;
      default: {
        const networkData = getNetwork(network);
        if (networkData === undefined) {
          throw new MoverError(`Unsupported network in calcTransactionProof: ${network}`);
        }
        common = Common.custom(
          {
            name: networkData.name,
            chainId: networkData.chainId,
            networkId: networkData.chainId
          },
          { hardfork: Hardfork.Berlin }
        );
      }
    }

    const blockData = await this.web3Client.eth.getBlock(blockNumber, true);
    addSentryBreadcrumb({
      type: 'info',
      category: this.sentryCategoryPrefix,
      message: 'Block data from web3',
      data: {
        blockData
      }
    });

    const hasBaseFee = [Network.polygon, Network.ethereum].includes(network);

    const header = BlockHeader.fromHeaderData(
      {
        difficulty: BigInt(blockData.difficulty),
        gasLimit: blockData.gasLimit,
        number: blockData.number,
        timestamp: blockData.timestamp,
        coinbase: blockData.miner,
        parentHash: blockData.parentHash,
        uncleHash: blockData.sha3Uncles,
        stateRoot: blockData.stateRoot,
        transactionsTrie: this.web3Client.utils.hexToBytes((blockData as any).transactionsRoot),
        receiptTrie: this.web3Client.utils.hexToBytes((blockData as any).receiptsRoot),
        logsBloom: blockData.logsBloom,
        gasUsed: blockData.gasUsed,
        extraData: blockData.extraData,
        mixHash: (blockData as any).mixHash,
        nonce: blockData.nonce,
        baseFeePerGas: hasBaseFee ? (blockData as any).baseFeePerGas : undefined
      },
      { common: common, skipConsensusFormatValidation: true }
    );

    const trie = new Trie();
    for (const t of blockData.transactions) {
      const key = RLP.encode(t.transactionIndex);
      const val = this.rlpTransaction(t as RPCTransaction, common);
      const hexVal = uintBufferToHex(val);
      await trie.put(Buffer.from(key), Buffer.from(hexVal, 'hex'));
    }

    const rootHash = trie.root;

    if (Buffer.compare(header.transactionsTrie, rootHash) !== 0) {
      addSentryBreadcrumb({
        type: 'error',
        category: this.sentryCategoryPrefix,
        message: 'Tx trie root hash does not match',
        data: {
          calculated: rootHash.toString('hex'),
          sent: header.transactionsTrie.toString('hex')
        }
      });
      throw new MoverError('Tx trie root hash is wrong');
    } else {
      addSentryBreadcrumb({
        type: 'info',
        category: this.sentryCategoryPrefix,
        message: 'Tx trie root hash is correct',
        data: {
          calculated: rootHash.toString('hex'),
          sent: header.transactionsTrie.toString('hex')
        }
      });
    }

    const stack = await this.getTrieStackForTx(trie, txIndex);
    const proofType = 1;
    const proofBlob = RLP.encode([proofType, header.raw(), txIndex, stack.map((n) => n.raw())]);

    addSentryBreadcrumb({
      type: 'info',
      category: this.sentryCategoryPrefix,
      message: 'Calculated blob proof',
      data: {
        hexProof: uintBufferToHex(proofBlob)
      }
    });

    return proofBlob;
  }

  private async getTrieStackForTx(
    trie: Trie,
    txIndex: number
  ): Promise<Array<BranchNode | ExtensionNode | LeafNode>> {
    const keyNibbles = getNibbles(RLP.encode(txIndex)).flat();

    for (const nibble of keyNibbles) {
      if (nibble < 0 || nibble > 16) {
        throw new MoverError('keyNibbles has wrong elements', { keyNibbles });
      }
    }

    const stackIndexes: number[] = [];
    const stack: Array<BranchNode | ExtensionNode | LeafNode> = [];

    const aux = async (
      nodeHash: Buffer | Buffer[] | null,
      innerKeyNibbles: number[]
    ): Promise<void> => {
      if (nodeHash === null) {
        addSentryBreadcrumb({
          type: 'info',
          category: this.sentryCategoryPrefix,
          message: 'Hit an empty node, returning'
        });
        return;
      }
      const node = await trie.lookupNode(nodeHash);
      if (node === null) {
        addSentryBreadcrumb({
          type: 'info',
          category: this.sentryCategoryPrefix,
          message: 'Hit an empty node, returning'
        });
        return;
      } else if (node instanceof BranchNode) {
        addSentryBreadcrumb({
          type: 'info',
          category: this.sentryCategoryPrefix,
          message: 'Hit a branch node',
          data: {
            innerKeyNibbles
          }
        });
        if (innerKeyNibbles.length > 0) {
          const i = innerKeyNibbles[0];
          stackIndexes.push(i);
          stack.push(node);
          await aux(node.getBranch(i), innerKeyNibbles.slice(1));
        } else {
          const i = 16;
          stackIndexes.push(i);
          stack.push(node);
        }
        return;
      } else if (node instanceof ExtensionNode || node instanceof LeafNode) {
        const key = node.key;

        addSentryBreadcrumb({
          type: 'info',
          category: this.sentryCategoryPrefix,
          message: 'Hit an extension/branch node',
          data: {
            nodeKey: key
          }
        });

        const keyData = consumeCommonPrefix(key, innerKeyNibbles);
        if (keyData.leftReminder.length === 0) {
          addSentryBreadcrumb({
            type: 'info',
            category: this.sentryCategoryPrefix,
            message: 'Non-divergent leaf/extension'
          });
          stackIndexes.push(1);
          stack.push(node);
          if (node instanceof ExtensionNode) {
            await aux(node.value, keyData.rightReminder);
          }
        } else {
          addSentryBreadcrumb({
            type: 'info',
            category: this.sentryCategoryPrefix,
            message: 'Divergent leaf/extension'
          });
          stackIndexes.push(0xff);
          stack.push(node);
        }
        return;
      } else {
        throw new MoverError('Unknown node type', { node });
      }
    };

    await aux(trie.root, keyNibbles);
    addSentryBreadcrumb({
      type: 'info',
      category: this.sentryCategoryPrefix,
      message: 'After aux',
      data: {
        keyNibbles,
        stack,
        stackIndexes
      }
    });

    return stack;
  }

  private rlpTransaction(txData: RPCTransaction, common?: Common): Uint8Array {
    const txType = (txData as any).type;
    addSentryBreadcrumb({
      type: 'info',
      category: this.sentryCategoryPrefix,
      message: 'After aux',
      data: {
        txType,
        txData
      }
    });

    let response: Uint8Array;
    let transaction: TypedTransaction | Transaction;

    if (txType === 1) {
      const accessList = this.parseAssets(txData);

      const t = AccessListEIP2930Transaction.fromTxData(
        {
          nonce: txData.nonce,
          gasPrice: parseInt(txData.gasPrice),
          gasLimit: txData.gas,
          to: txData.to ?? '',
          value: bigIntToHexString(BigInt(txData.value)),
          data: this.web3Client.utils.hexToBytes(txData.input),
          v: bigIntToHexString(BigInt(txData.v)),
          r: bigIntToHexString(BigInt(txData.r)),
          s: bigIntToHexString(BigInt(txData.s)),
          accessList: accessList
        },
        { common: common }
      );
      transaction = t;

      response = RLP.encode([
        bigIntToUnpaddedBuffer(t.chainId),
        bigIntToUnpaddedBuffer(t.nonce),
        bigIntToUnpaddedBuffer(t.gasPrice),
        bigIntToUnpaddedBuffer(t.gasLimit),
        t.to !== undefined ? t.to.buf : Buffer.from([]),
        bigIntToUnpaddedBuffer(t.value),
        t.data,
        t.accessList,
        t.v !== undefined ? bigIntToUnpaddedBuffer(t.v) : Buffer.from([]),
        t.r !== undefined ? bigIntToUnpaddedBuffer(t.r) : Buffer.from([]),
        t.s !== undefined ? bigIntToUnpaddedBuffer(t.s) : Buffer.from([])
      ]);
      response = new Uint8Array([1, ...response]);
    } else if (txType === 2) {
      const accessList = this.parseAssets(txData);

      const t = FeeMarketEIP1559Transaction.fromTxData(
        {
          nonce: txData.nonce,
          maxPriorityFeePerGas: parseInt((txData as any).maxPriorityFeePerGas),
          maxFeePerGas: parseInt((txData as any).maxFeePerGas),
          gasLimit: txData.gas,
          to: txData.to ?? '',
          value: bigIntToHexString(BigInt(txData.value)),
          data: this.web3Client.utils.hexToBytes(txData.input),
          v: bigIntToHexString(BigInt(txData.v)),
          r: bigIntToHexString(BigInt(txData.r)),
          s: bigIntToHexString(BigInt(txData.s)),
          accessList: accessList
        },
        { common: common }
      );
      transaction = t;

      response = RLP.encode([
        bigIntToUnpaddedBuffer(t.chainId),
        bigIntToUnpaddedBuffer(t.nonce),
        bigIntToUnpaddedBuffer(t.maxPriorityFeePerGas),
        bigIntToUnpaddedBuffer(t.maxFeePerGas),
        bigIntToUnpaddedBuffer(t.gasLimit),
        t.to !== undefined ? t.to.buf : Buffer.from([]),
        bigIntToUnpaddedBuffer(t.value),
        t.data,
        t.accessList,
        t.v !== undefined ? bigIntToUnpaddedBuffer(t.v) : Buffer.from([]),
        t.r !== undefined ? bigIntToUnpaddedBuffer(t.r) : Buffer.from([]),
        t.s !== undefined ? bigIntToUnpaddedBuffer(t.s) : Buffer.from([])
      ]);
      response = new Uint8Array([2, ...response]);
    } else {
      // Legacy transaction

      const t = Transaction.fromTxData(
        {
          nonce: txData.nonce,
          gasPrice: parseInt(txData.gasPrice),
          gasLimit: txData.gas,
          to: txData.to ?? '',
          value: bigIntToDecimalString(BigInt(txData.value)),
          data: this.web3Client.utils.hexToBytes(txData.input),
          v: bigIntToHexString(BigInt(txData.v)),
          r: bigIntToHexString(BigInt(txData.r)),
          s: bigIntToHexString(BigInt(txData.s))
        },
        { common: common }
      );
      transaction = t;

      response = RLP.encode([
        bigIntToUnpaddedBuffer(t.nonce),
        bigIntToUnpaddedBuffer(t.gasPrice),
        bigIntToUnpaddedBuffer(t.gasLimit),
        t.to !== undefined ? t.to.buf : Buffer.from([]),
        bigIntToUnpaddedBuffer(t.value),
        t.data,
        t.v !== undefined ? bigIntToUnpaddedBuffer(t.v) : Buffer.from([]),
        t.r !== undefined ? bigIntToUnpaddedBuffer(t.r) : Buffer.from([]),
        t.s !== undefined ? bigIntToUnpaddedBuffer(t.s) : Buffer.from([])
      ]);
    }

    const calculatedHash = `0x${transaction.hash().toString('hex')}`;

    if (calculatedHash !== txData.hash) {
      addSentryBreadcrumb({
        type: 'error',
        category: this.sentryCategoryPrefix,
        message: 'Tx hash does not match',
        data: {
          calculated: calculatedHash,
          sent: txData.hash
        }
      });
      throw new MoverError('Tx hash is wrong');
    } else {
      addSentryBreadcrumb({
        type: 'info',
        category: this.sentryCategoryPrefix,
        message: 'Tx hash is correct',
        data: {
          calculated: calculatedHash
        }
      });
    }

    return response;
  }

  private parseAssets(txData: RPCTransaction): AccessListItem[] {
    const accessList: AccessListItem[] = [];
    if ('accessList' in txData && txData.accessList !== undefined) {
      for (const accAccess of txData.accessList) {
        const stKeys: string[] = [];
        for (const stKey of accAccess.storageKeys) {
          stKeys.push(stKey);
          const accItem: AccessListItem = {
            address: Address.fromString(accAccess.address).toString(),
            storageKeys: stKeys
          };
          accessList.push(accItem);
        }
      }
    }
    return accessList;
  }
}

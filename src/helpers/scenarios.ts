import dayjs from 'dayjs';
import Web3 from 'web3';

import { getUSDCAssetData } from '../references/assets';
import { Network } from '../references/network';
import { SmallTokenInfo } from '../references/tokens';
import { DepositExecution, WithdrawExecution } from '../services/api/mover/savings-plus/types';
import { Status, Transaction, TransactionType } from '../services/api/mover/transactions/types';
import { MoverError } from '../services/MoverError';
import { DebitCardOnChainService } from '../services/onchain/mover/debit-card/DebitCardOnChainService';
import { SavingsPlusOnChainService } from '../services/onchain/mover/savings-plus/SavingsPlusOnChainService';
import { SmartTreasuryOnChainService } from '../services/onchain/mover/smart-treasury/SmartTreasuryOnChainService';
import { StakingUbtOnChainService } from '../services/onchain/mover/staking-ubt/StakingUbtOnChainService';
import {
  InternalTransactionType,
  State,
  TransactionScenario
} from '../services/onchain/transaction-states';

const getFinalTypeByTxType = (txType: TransactionType): InternalTransactionType => {
  switch (txType) {
    case TransactionType.TreasuryDeposit:
    case TransactionType.SavingsPlusDeposit:
    case TransactionType.StakingDeposit:
      return InternalTransactionType.Deposit;
    case TransactionType.CardTopUp:
      return InternalTransactionType.TopUp;
    case TransactionType.SavingsPlusWithdraw:
    case TransactionType.StakingWithdraw:
    case TransactionType.TreasuryWithdraw:
      return InternalTransactionType.Withdraw;
    default:
      return InternalTransactionType.TopUp;
  }
};

interface ServiceFactory {
  getSmartTreasuryOnChainService: (network: Network) => SmartTreasuryOnChainService;
  getSavingsPlusOnChainService: (network: Network) => SavingsPlusOnChainService;
  getDebitCardOnChainService: (network: Network) => DebitCardOnChainService;
  getStakingOnChainService: (network: Network) => StakingUbtOnChainService;
}
export const getScenarioByTransaction = (
  tx: Transaction,
  factory: ServiceFactory
): Promise<TransactionScenario | undefined> => {
  if (tx.status === Status.Succeeded || tx.status === Status.Failed) {
    return Promise.resolve({
      type: tx.internalType,
      startNetwork:
        tx.internalType === TransactionType.SavingsPlusWithdraw ? Network.polygon : tx.network,
      toNetwork: Network.ethereum,
      steps: [
        {
          index: 0,
          type: getFinalTypeByTxType(tx.internalType),
          state: tx.status === Status.Succeeded ? State.Succeeded : State.Failed,
          estimation: 0,
          network:
            tx.internalType === TransactionType.SavingsPlusDeposit
              ? Network.polygon
              : Network.ethereum,
          token: tx.token,
          timestamp: dayjs().unix(),
          hash: tx.hash
        }
      ]
    });
  }
  switch (tx.internalType) {
    case TransactionType.TreasuryDeposit: {
      return factory
        .getSmartTreasuryOnChainService(tx.network)
        .explainDepositCompound(tx.token, tx.amount);
    }
    case TransactionType.TreasuryWithdraw: {
      return factory.getSmartTreasuryOnChainService(tx.network).explainWithdrawCompound(tx.token);
    }
    case TransactionType.CardTopUp: {
      return factory
        .getDebitCardOnChainService(tx.network)
        .explainTopUpCompound({ ...tx.token, hasPermit: false }); // TODO permit data
    }
    case TransactionType.SavingsPlusDeposit: {
      const depositData =
        tx.network !== Network.polygon ? DepositExecution.Bridged : DepositExecution.Direct;
      return factory
        .getSavingsPlusOnChainService(tx.network)
        .explainDepositCompound(tx.token, getUSDCAssetData(tx.network), tx.amount, depositData);
    }
    case TransactionType.SavingsPlusWithdraw: {
      const withdrawData =
        tx.network !== Network.polygon ? WithdrawExecution.Bridged : WithdrawExecution.Direct;
      return factory
        .getSavingsPlusOnChainService(tx.network)
        .explainWithdrawCompound(tx.token, tx.network, withdrawData);
    }
    case TransactionType.StakingDeposit: {
      return factory
        .getStakingOnChainService(tx.network)
        .explainDepositCompound(tx.token, tx.amount);
    }
    case TransactionType.StakingWithdraw: {
      return factory.getStakingOnChainService(tx.network).explainWithdrawCompound(tx.token);
    }
    default:
      return Promise.resolve(undefined);
  }
};

const mapScenarioDataToPreusoUniqueIdParts = (
  type: TransactionType,
  network: Network,
  token: SmallTokenInfo,
  amount = ''
): string => {
  switch (type) {
    case TransactionType.CardTopUp:
      return [type, token.address, network].join('-');
    case TransactionType.SavingsPlusDeposit:
      return [
        type,
        token.address,
        amount,
        network !== Network.polygon ? DepositExecution.Bridged : DepositExecution.Direct,
        network
      ].join('-');
    case TransactionType.SavingsPlusWithdraw:
      return [
        type,
        token.address,
        network !== Network.polygon ? WithdrawExecution.Bridged : WithdrawExecution.Direct,
        network
      ].join('-');
    case TransactionType.TreasuryDeposit:
      return [type, token.address, network].join('-');
    case TransactionType.TreasuryWithdraw:
      return [type, token.address, network].join('-');
    case TransactionType.StakingDeposit:
      return [type, token.address, amount, network].join('-');
    case TransactionType.StakingWithdraw:
      return [type, token.address, network].join('-');
    default:
      throw new MoverError('Unknown transaction type received. Unable to generate pseudoUniqueID', {
        type,
        network,
        token,
        amount
      });
  }
};

export const mapScenarioDataToPreusoUniqueId = (
  type: TransactionType,
  network: Network,
  token: SmallTokenInfo,
  amount = ''
): string => {
  return Web3.utils.keccak256(mapScenarioDataToPreusoUniqueIdParts(type, network, token, amount));
};

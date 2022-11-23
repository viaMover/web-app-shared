import dayjs from 'dayjs';
import { getUSDCAssetData } from 'web-app-shared/references/assets';
import { Network } from 'web-app-shared/references/network';
import { SmallTokenInfo } from 'web-app-shared/references/tokens';
import { MoverAPIApprovalService } from 'web-app-shared/services/api/mover/approval/MoverAPIApprovalService';
import { MoverAssetsService } from 'web-app-shared/services/api/mover/assets/MoverAPIAssetsService';
import {
  DepositExecution,
  WithdrawExecution
} from 'web-app-shared/services/api/mover/savings-plus/types';
import {
  Status,
  Transaction,
  TransactionType
} from 'web-app-shared/services/api/mover/transactions/types';
import { MoverError } from 'web-app-shared/services/MoverError';
import { DebitCardOnChainService } from 'web-app-shared/services/onchain/mover/debit-card/DebitCardOnChainService';
import { ProveOnChainService } from 'web-app-shared/services/onchain/mover/prove-txn/ProveOnChainService';
import { SavingsPlusOnChainService } from 'web-app-shared/services/onchain/mover/savings-plus/SavingsPlusOnChainService';
import { SmartTreasuryOnChainService } from 'web-app-shared/services/onchain/mover/smart-treasury/SmartTreasuryOnChainService';
import { StakingUbtOnChainService } from 'web-app-shared/services/onchain/mover/staking-ubt/StakingUbtOnChainService';
import { PermitOnChainService } from 'web-app-shared/services/onchain/permit/PermitOnChainService';
import {
  InternalTransactionType,
  State,
  TransactionScenario
} from 'web-app-shared/services/onchain/transaction-states';
import Web3 from 'web3';

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

const debitCardOnChainServicesMap = new Map<Network, DebitCardOnChainService>();
export const getScenarioByTransaction = (
  tx: Transaction,
  accountAddress: string,
  web3Client: Web3
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
      return new SmartTreasuryOnChainService(
        accountAddress,
        tx.network,
        web3Client
      ).explainDepositCompound(tx.token, tx.amount);
    }
    case TransactionType.TreasuryWithdraw: {
      return new SmartTreasuryOnChainService(
        accountAddress,
        tx.network,
        web3Client
      ).explainWithdrawCompound(tx.token);
    }
    case TransactionType.CardTopUp: {
      const savedService = debitCardOnChainServicesMap.get(tx.network);
      if (savedService === undefined) {
        const service = new DebitCardOnChainService(
          accountAddress,
          tx.network,
          web3Client,
          () => [],
          new MoverAssetsService(),
          new PermitOnChainService(accountAddress, tx.network, web3Client),
          new MoverAPIApprovalService(),
          new ProveOnChainService(accountAddress, tx.network, web3Client)
        );
        debitCardOnChainServicesMap.set(tx.network, service);
        return service.explainTopUpCompound({ ...tx.token, hasPermit: false }); // TODO permit data
      }

      return savedService.explainTopUpCompound({ ...tx.token, hasPermit: false }); // TODO permit data
    }
    case TransactionType.SavingsPlusDeposit: {
      const depositData =
        tx.network !== Network.polygon ? DepositExecution.Bridged : DepositExecution.Direct;
      return new SavingsPlusOnChainService(
        accountAddress,
        tx.network,
        web3Client
      ).explainDepositCompound(tx.token, getUSDCAssetData(tx.network), tx.amount, depositData);
    }
    case TransactionType.SavingsPlusWithdraw: {
      const withdrawData =
        tx.network !== Network.polygon ? WithdrawExecution.Bridged : WithdrawExecution.Direct;
      return new SavingsPlusOnChainService(
        accountAddress,
        tx.network,
        web3Client
      ).explainWithdrawCompound(tx.token, tx.network, withdrawData);
    }
    case TransactionType.StakingDeposit: {
      return new StakingUbtOnChainService(
        accountAddress,
        tx.network,
        web3Client
      ).explainDepositCompound(tx.token, tx.amount);
    }
    case TransactionType.StakingWithdraw: {
      return new StakingUbtOnChainService(
        accountAddress,
        tx.network,
        web3Client
      ).explainWithdrawCompound(tx.token);
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

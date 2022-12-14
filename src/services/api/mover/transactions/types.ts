import { Network } from '../../../../references/network';
import { Token } from '../../../../references/tokens';
import { Rates } from '../rates/types';

export enum Status {
  Pending = 'pending',
  Succeeded = 'success',
  Failed = 'fail',
  Bridging = 'bridging',
  Mempooling = 'mempooling'
}

export enum TransactionType {
  SavingsDeposit = 'savings_deposit',
  SavingsWithdraw = 'savings_withdraw',
  TreasuryDeposit = 'treasury_deposit',
  TreasuryWithdraw = 'treasury_withdraw',
  CardTopUp = 'card_topup',
  SavingsPlusDeposit = 'savingsplus_deposit',
  SavingsPlusWithdraw = 'savingsplus_withdraw',
  StakingDeposit = 'ubtstaking_deposit',
  StakingWithdraw = 'ubtstaking_withdraw'
}

export type ApiTransactionsResponse = {
  chains: Array<{
    chainID: number;
    txs: Array<ApiTransaction>;
  }>;
};

export type ApiTransaction = {
  type: TransactionType;
  direction: TransactionDirection;
  hash: string;
  to: string;
  amount: string;
  amount2: string;
  status: Status;
  beneficiary: string;
  token: string;
  blockNumber: number;
  fee: string;
  timestamp: number;
  tag?: string;
};

export type GetTransactionListReturnItem = ApiTransaction & {
  network: Network;
};

export enum TransactionDirection {
  In = 'in',
  Out = 'out'
}

export type Transaction = {
  token: Token;
  network: Network;
  amount: string;
  nativeAmount: string;
  conversionRates: Rates;
  fee: string;
  // type: 'earn' | 'card'; // may be expanded later
  timestamp: number;
  internalType: TransactionType;
  direction: TransactionDirection;
  hash: string;
  toAddress: string; // receiver
  status: Status;
  meta: {
    fromTag?: string; // may be used later
    toTag?: string; // may be used later
  };
};

export type TransactionExtended = Transaction & { localizedType: string };

export type TransactionInMemPool = Transaction & {
  nonce: number;
  removeAfterTs: number | undefined;
};

export type TransactionInMemPoolTemplate = Pick<
  TransactionInMemPool,
  'internalType' | 'token' | 'network' | 'amount' | 'timestamp' | 'direction' | 'hash' | 'toAddress'
> & {
  nonce?: number;
};

export type TransactionsDayInfo = {
  nativeAmount: string;
  transactions: Array<TransactionExtended>;
};

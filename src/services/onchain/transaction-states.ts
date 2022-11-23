import { Network } from '@/references/network';
import { SmallTokenInfo } from '@/references/tokens';
import { TransactionType } from '@/services/api/mover/transactions/types';

export enum State {
  Pending = 'pending',
  Succeeded = 'succeeded',
  Failed = 'failed',
  Queued = 'queued'
}

export enum InternalTransactionType {
  Approve = 'approve',
  Swap = 'swap',
  Bridge = 'bridge',
  Deposit = 'deposit',
  Withdraw = 'withdraw',
  TopUp = 'top_up',
  Unwrap = 'unwrap',
  Confirm = 'confirm'
}

export type TransactionStateItem = {
  index: number;
  type: InternalTransactionType;
  state: State;
  estimation: number;
  network: Network;
  token: SmallTokenInfo;
  timestamp: number;
  hash?: string;
};

export type TransactionScenario = {
  type: TransactionType;
  startNetwork: Network;
  toNetwork: Network;
  steps: Array<TransactionStateItem>;
};

type EmitterPayload = {
  type: InternalTransactionType;
  state: State;
  hash?: string;
};

export interface ITransactionStateEventBus {
  getActiveStep: () => TransactionStateItem;
  emit: (payload: EmitterPayload) => void;
  succeed: (hash?: string) => void;
  fail: (error?: unknown) => void;
}

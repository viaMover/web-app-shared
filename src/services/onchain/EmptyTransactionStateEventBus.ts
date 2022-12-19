import { getUSDCAssetData } from '../../references/assets';
import { Network } from '../../references/network';
import {
  EmitterPayload,
  InternalTransactionType,
  ITransactionStateEventBus,
  State,
  TransactionStateItem
} from './transaction-states';

export class EmptyTransactionStateEventBus implements ITransactionStateEventBus {
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  emit(payload: EmitterPayload): void {}

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  fail(error: unknown | undefined): void {}

  getActiveStep(): TransactionStateItem {
    return {
      estimation: 0,
      index: 0,
      network: Network.ethereum,
      state: State.Succeeded,
      timestamp: 0,
      token: getUSDCAssetData(Network.ethereum),
      type: InternalTransactionType.TopUp
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  succeed(hash: string | undefined): void {}
}

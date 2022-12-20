import { Network } from '../../../../references/network';
import { SmallTokenInfo } from '../../../../references/tokens';
import { TransactionType } from '../transactions/types';

export type TxData = {
  networkFrom: Network;
  networkTo: Network;
  amount: string;
  token: SmallTokenInfo;
  hash: string;
};

export type TxDataDto = {
  chainIdFrom: number;
  chainIdTo: number;
  amount: string;
  token: Omit<SmallTokenInfo, 'network'>;
  hash: string;
  type: TransactionType;
};

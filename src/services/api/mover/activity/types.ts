import { Network } from '../../../../references/network';
import { SmallTokenInfo } from '../../../../references/tokens';

export type TxDataDto = {
  networkFrom: Network;
  networkTo: Network;
  amount: string;
  token: SmallTokenInfo;
  hash: string;
};

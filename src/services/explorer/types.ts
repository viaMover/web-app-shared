import { NFT } from '../../references/nfts';
import { TokenWithBalance } from '../../references/tokens';

export type WalletTokens = {
  tokens: Array<TokenWithBalance>;
  nfts: Array<NFT>;
};

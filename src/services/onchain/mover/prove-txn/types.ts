export type RPCTransaction = {
  hash: string;
  nonce: number;
  blockHash: string | null;
  blockNumber: number | null;
  transactionIndex: number | null;
  from: string;
  to: string | null;
  value: string;
  gasPrice: string;
  gas: number;
  input: string;
  v: string;
  r: string;
  s: string;
  accessList?: Array<{
    address: string;
    storageKeys: string;
  }>;
};

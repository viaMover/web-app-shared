export type GetApprovalReturn = {
  approval: 'ok' | 'wrong';
  amount: string;
  data: string;
  timestamp: number;
};

export type GetApprovalAPIResponse = {
  token: string;
  amount: string;
  timestamp: number;
  sig: string;
};

export type StakingUbtMonthBalanceItem = {
  balance: number;
  earned: number;
  snapshotTimestamp: number;
  year: number;
  month: number;
};

export type StakingUbtActionHistoryItem = {
  type: 'deposit' | 'withdraw';
  amount: number;
  txId: string;
  block: number;
  timestamp: number;
};

export type StakingUbtInfo = {
  currentBalance: number;
  currentPoolBalance: number;
  earnedTotal: number;
  earnedThisMonth: number;
  last12MonthsBalances: Array<StakingUbtMonthBalanceItem>;
  actionHistory: Array<StakingUbtActionHistoryItem>;
  avg30DaysAPY: number;
};

export type StakingUbtHourlyBalancesItem = {
  balance: number;
  snapshotTimestamp: number;
  year: number;
  month: number;
  day: number;
  hour: number;
};

export type StakingUbtReceipt = {
  endOfMonthBalance: number;
  earnedThisMonth: number;
  hourlyBalances: Array<StakingUbtHourlyBalancesItem>;
  monthActionHistory: Array<StakingUbtActionHistoryItem>;
  totalDeposits: number;
  totalWithdrawals: number;
  avgDailyEarnings: number;
  paidToTreasury: number;
  savedFees: number;
};

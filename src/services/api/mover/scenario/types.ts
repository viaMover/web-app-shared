import { TransactionScenario } from '@/services/onchain/transaction-states';

export type SetScenarioDataByUniqIdPayload = {
  transactionUID: string;
  updateTimestamp: number;
  data: ScenarioPayloadData;
};

export type SetScenarioHashByUniqIdPayload = {
  transactionUID: string;
  updateTimestamp: number;
  transactionHash: string;
};

export type GetScenarioDataByHashPayload = {
  transactionUID: string;
  data: ScenarioPayloadData;
};

export type ScenarioPayloadData = {
  scenario: TransactionScenario;
};

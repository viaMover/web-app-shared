import axios, { AxiosInstance } from 'axios';
import { mapScenarioDataToPreusoUniqueId } from 'web-app-shared/helpers/scenarios';
import { addSentryBreadcrumb } from 'web-app-shared/logs/sentry';
import { getEndpoint } from 'web-app-shared/references/endpoints';
import { MoverAPIService } from 'web-app-shared/services/api/mover/MoverAPIService';
import {
  GetScenarioDataByHashPayload,
  ScenarioPayloadData,
  SetScenarioDataByUniqIdPayload,
  SetScenarioHashByUniqIdPayload
} from 'web-app-shared/services/api/mover/scenario/types';
import { MoverAPISuccessfulResponse } from 'web-app-shared/services/api/mover/types';

export class MoverAPIScenarioService extends MoverAPIService {
  protected baseURL: string;

  protected readonly client: AxiosInstance;

  constructor(private readonly address: string, private readonly signature: string) {
    super('tag.api.scenario');
    this.baseURL = this.lookupBaseURL();
    this.client = this.applyAxiosInterceptors(
      axios.create({
        baseURL: this.baseURL
      })
    );
  }

  public async getScenarioDataByHash(hash: string): Promise<GetScenarioDataByHashPayload> {
    return (
      await this.client.get<MoverAPISuccessfulResponse<GetScenarioDataByHashPayload>>(
        `/private/transaction/${hash}`,
        {
          headers: this.getAuthHeaders(this.address, this.signature)
        }
      )
    ).data.payload;
  }

  public async enrichScenarioDataWithHash(
    uniqId: string | undefined,
    hash: string,
    timestamp: number
  ): Promise<void> {
    if (uniqId === undefined) {
      addSentryBreadcrumb({
        type: 'warning',
        category: this.sentryCategoryPrefix,
        message: 'Received uniqID of undefined'
      });
      return;
    }

    await this.client.post<MoverAPISuccessfulResponse<void>>(
      `/private/transaction/update/hash`,
      {
        transactionUID: uniqId,
        transactionHash: hash,
        updateTimestamp: timestamp
      } as SetScenarioHashByUniqIdPayload,
      {
        headers: this.getAuthHeaders(this.address, this.signature)
      }
    );
  }

  public async enrichScenarioDataWithData(
    uniqId: string | undefined,
    data: ScenarioPayloadData,
    timestamp: number
  ): Promise<void> {
    if (uniqId === undefined) {
      addSentryBreadcrumb({
        type: 'warning',
        category: this.sentryCategoryPrefix,
        message: 'Received uniqID of undefined'
      });
      return;
    }

    await this.client.post<MoverAPISuccessfulResponse<void>>(
      `/private/transaction/update/data`,
      {
        transactionUID: uniqId,
        updateTimestamp: timestamp,
        data: data
      } as SetScenarioDataByUniqIdPayload,
      {
        headers: this.getAuthHeaders(this.address, this.signature)
      }
    );
  }

  public async createScenarioData(data: ScenarioPayloadData): Promise<string> {
    try {
      return (
        await this.client.post<MoverAPISuccessfulResponse<{ transactionUID: string }>>(
          `/private/transaction/create`,
          data,
          {
            headers: this.getAuthHeaders(this.address, this.signature)
          }
        )
      ).data.payload.transactionUID;
    } catch (error) {
      addSentryBreadcrumb({
        type: 'warning',
        category: this.sentryCategoryPrefix,
        message: 'Failed to create scenario data',
        data: {
          error,
          data
        }
      });
      return mapScenarioDataToPreusoUniqueId(
        data.scenario.type,
        data.scenario.startNetwork,
        data.scenario.steps[0].token,
        'Fallback-scenario-amount'
      );
    }
  }

  protected lookupBaseURL(): string {
    return getEndpoint('API_ASSETS_SERVICE_URL');
  }
}

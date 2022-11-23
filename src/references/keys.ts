export type APIKeys = {
  INFURA_PROJECT_ID: string;
  MORALIS_API_KEY: string;
  ANKR_API_KEY: string;
  ALCHEMY_API_KEY: string;
};
export type PossibleAPIKey = keyof APIKeys;

let apiKeys: APIKeys | undefined = undefined;
const OverrideKeys: Partial<APIKeys> = {};

export const setAPIKeys = (value: APIKeys): void => {
  apiKeys = value;
};

export const getAPIKey = (key: PossibleAPIKey): string => {
  const overrideValue = OverrideKeys[key];
  if (overrideValue === undefined) {
    if (apiKeys === undefined) {
      throw new Error(`missing API key: ${key}`);
    }

    return apiKeys[key];
  }
  return overrideValue;
};

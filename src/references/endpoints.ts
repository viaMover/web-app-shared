export type Endpoints = {
  API_ASSETS_SERVICE_URL: string;
  API_TAG_SERVICE_URL: string;
  API_VIEW_SERVICE_URL: string;
  API_SERVICE_URL: string;
};
export type PossibleEndpoint = keyof Endpoints;

let endpoints: Endpoints | undefined = undefined;

export const setEndpoints = (value: Endpoints): void => {
  endpoints = value;
};

export const getEndpoint = (key: PossibleEndpoint): string => {
  if (endpoints === undefined) {
    throw new Error(`missing endpoint: ${key}`);
  }

  return endpoints[key];
};

export type FeatureFlags = {
  IS_CONSOLE_ENABLED: boolean;
};
export type PossibleFeatureFlag = keyof FeatureFlags;

let featureFlags: FeatureFlags | undefined = undefined;

export const setFeatureFlags = (value: FeatureFlags): void => {
  featureFlags = value;
};

export const getFeatureFlag = (key: PossibleFeatureFlag): boolean => {
  if (featureFlags === undefined) {
    throw new Error(`missing feature flag: ${key}`);
  }

  return featureFlags[key];
};

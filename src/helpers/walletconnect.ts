const chainIdRegExp = /"chainId":"(\d+)"/;

const wcWebProviderDataKey = 'walletconnect';
export const repairWalletConnectLocalStorageData = (): void => {
  const wcData = localStorage.getItem(wcWebProviderDataKey);
  if (wcData === undefined || wcData === null) {
    return;
  }

  const match = wcData.match(chainIdRegExp);

  if (match === undefined || match === null || match.length != 2) {
    return;
  }

  const newChainId = parseInt(match[1], 10);

  const newWcData = wcData.replace(chainIdRegExp, `"chainId":${newChainId}`);
  localStorage.setItem(wcWebProviderDataKey, newWcData);
};

export const getLocalWCChainId = (): number | undefined => {
  const wcData = localStorage.getItem(wcWebProviderDataKey);
  if (wcData === undefined || wcData === null) {
    return;
  }

  const match = wcData.match(chainIdRegExp);

  if (match === undefined || match === null || match.length != 2) {
    return;
  }

  const newChainId = parseInt(match[1], 10);

  if (isNaN(newChainId)) {
    return;
  }

  return newChainId;
};

export type isChainNotValidExpectedResponse =
  | {
      isExpectedError: true;
      chainId: number;
    }
  | {
      isExpectedError: false;
    };

const invalidChainidRegExp = /Given value "(\d+)" is not a valid hex string./;

export const isChainNotValidExpected = (error: Error): isChainNotValidExpectedResponse => {
  const match = error.message.match(invalidChainidRegExp);
  if (match === undefined || match === null || match.length !== 2) {
    return {
      isExpectedError: false
    };
  }

  const newChainId = parseInt(match[1], 10);

  if (isNaN(newChainId)) {
    return {
      isExpectedError: false
    };
  }

  return {
    isExpectedError: true,
    chainId: newChainId
  };
};

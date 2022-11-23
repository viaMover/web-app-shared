import { isChainNotValidExpected } from 'web-app-shared/helpers/walletconnect';
import Web3 from 'web3';
import { AbstractProvider } from 'web3-core';

export const getChainIdWithFallback = async (web3: Web3): Promise<number> => {
  try {
    return await web3.eth.getChainId();
  } catch (error) {
    if (error instanceof Error) {
      // Some WC wallets like rainbow send chainId as decimal string not a number
      // WC updates it in web3 provider and that makes exceptions during getChainId call
      // we can handle this error and extract the chainId from string
      // TODO: probably this error can bring some more errors into our flow needs check
      const expectedErrorResult = isChainNotValidExpected(error);
      if (expectedErrorResult.isExpectedError) {
        return expectedErrorResult.chainId;
      } else {
        throw error;
      }
    }
    throw error;
  }
};

export const switchEthereumChainWithTimeout = async (
  web3: Web3,
  chainId: number
): Promise<void> => {
  return new Promise((resolve, reject) => {
    let intervalId: ReturnType<typeof setInterval> | undefined = undefined;

    (web3.currentProvider as AbstractProvider)
      ?.request?.({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${chainId.toString(16)}` }]
      })
      .then(() => {
        if (intervalId !== undefined) {
          clearInterval(intervalId);
        }
        resolve();
      })
      .catch((error) => {
        if (intervalId !== undefined) {
          clearInterval(intervalId);
        }
        reject(error);
      });

    intervalId = setInterval(async () => {
      try {
        console.debug('check actual chain id');
        const currentChainId = await getChainIdWithFallback(web3);
        console.debug('currentChainId:', currentChainId);
        if (currentChainId === chainId) {
          console.debug('restore flow');
          if (intervalId !== undefined) {
            clearInterval(intervalId);
          }
          resolve();
        }
      } catch (error) {
        console.debug('check network interval error', error);
        if (intervalId !== undefined) {
          clearInterval(intervalId);
        }
        reject(error);
      }
    }, 5000);
  });
};

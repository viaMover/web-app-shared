import { sameAddress } from '@/helpers/addresses';
import { Network } from '@/references/network';
import { SmallTokenInfo } from '@/references/tokens';

export type ATokenData = {
  name: string;
  poolVersion: 2 | 3;
  wrapToken: SmallTokenInfo;
  commonToken: SmallTokenInfo;
};

type aTokenAddressMap = Readonly<Record<Network, Array<ATokenData>>>;

export const addresses = {
  [Network.polygon]: [
    {
      name: 'Aave Polygon DAI',
      poolVersion: 3,
      wrapToken: {
        symbol: 'aPolDAI',
        address: '0x82E64f49Ed5EC1bC6e43DAD4FC8Af9bb3A2312EE',
        decimals: 18,
        network: Network.polygon
      },
      commonToken: {
        symbol: 'DAI',
        address: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063',
        decimals: 18,
        network: Network.polygon
      }
    },
    {
      name: 'Aave Polygon AGEUR',
      poolVersion: 3,
      wrapToken: {
        symbol: 'aPolAGEUR',
        address: '0x8437d7C167dFB82ED4Cb79CD44B7a32A1dd95c77',
        decimals: 18,
        network: Network.polygon
      },
      commonToken: {
        symbol: 'agEUR',
        address: '0xE0B52e49357Fd4DAf2c15e02058DCE6BC0057db4',
        decimals: 18,
        network: Network.polygon
      }
    },
    {
      name: 'Aave Polygon EURS',
      poolVersion: 3,
      wrapToken: {
        symbol: 'aPolEURS',
        address: '0x38d693cE1dF5AaDF7bC62595A37D667aD57922e5',
        decimals: 2,
        network: Network.polygon
      },
      commonToken: {
        symbol: 'EURS',
        address: '0xE111178A87A3BFf0c8d18DECBa5798827539Ae99',
        decimals: 2,
        network: Network.polygon
      }
    },
    {
      name: 'Aave Polygon JEUR',
      poolVersion: 3,
      wrapToken: {
        symbol: 'aPolJEUR',
        address: '0x6533afac2E7BCCB20dca161449A13A32D391fb00',
        decimals: 18,
        network: Network.polygon
      },
      commonToken: {
        symbol: 'jEUR',
        address: '0x4e3Decbb3645551B8A19f0eA1678079FCB33fB4c',
        decimals: 18,
        network: Network.polygon
      }
    },
    {
      name: 'Aave Polygon USDC',
      poolVersion: 3,
      wrapToken: {
        symbol: 'aPolUSDC',
        address: '0x625E7708f30cA75bfd92586e17077590C60eb4cD',
        decimals: 6,
        network: Network.polygon
      },
      commonToken: {
        symbol: 'USDC',
        address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
        decimals: 6,
        network: Network.polygon
      }
    },
    {
      name: 'Aave Polygon USDT',
      poolVersion: 3,
      wrapToken: {
        symbol: 'aPolUSDT',
        address: '0x6ab707Aca953eDAeFBc4fD23bA73294241490620',
        decimals: 6,
        network: Network.polygon
      },
      commonToken: {
        symbol: 'USDT',
        address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
        decimals: 6,
        network: Network.polygon
      }
    },
    {
      name: 'Aave Polygon AAVE',
      poolVersion: 3,
      wrapToken: {
        symbol: 'aPolAAVE',
        address: '0xf329e36C7bF6E5E86ce2150875a84Ce77f477375',
        decimals: 18,
        network: Network.polygon
      },
      commonToken: {
        symbol: 'AAVE',
        address: '0xD6DF932A45C0f255f85145f286eA0b292B21C90B',
        decimals: 18,
        network: Network.polygon
      }
    },
    {
      name: 'Aave Polygon BAL',
      poolVersion: 3,
      wrapToken: {
        symbol: 'aPolBAL',
        address: '0x8ffDf2DE812095b1D19CB146E4c004587C0A0692',
        decimals: 18,
        network: Network.polygon
      },
      commonToken: {
        symbol: 'BAL',
        address: '0x9a71012B13CA4d3D0Cdc72A177DF3ef03b0E76A3',
        decimals: 18,
        network: Network.polygon
      }
    },
    {
      name: 'Aave Polygon CRV',
      poolVersion: 3,
      wrapToken: {
        symbol: 'aPolCRV',
        address: '0x513c7E3a9c69cA3e22550eF58AC1C0088e918FFf',
        decimals: 18,
        network: Network.polygon
      },
      commonToken: {
        symbol: 'CRV',
        address: '0x172370d5Cd63279eFa6d502DAB29171933a610AF',
        decimals: 18,
        network: Network.polygon
      }
    },
    {
      name: 'Aave Polygon DPI',
      poolVersion: 3,
      wrapToken: {
        symbol: 'aPolDPI',
        address: '0x724dc807b04555b71ed48a6896b6F41593b8C637',
        decimals: 18,
        network: Network.polygon
      },
      commonToken: {
        symbol: 'DPI',
        address: '0x85955046DF4668e1DD369D2DE9f3AEB98DD2A369',
        decimals: 18,
        network: Network.polygon
      }
    },
    {
      name: 'Aave Polygon GHST',
      poolVersion: 3,
      wrapToken: {
        symbol: 'aPolGHST',
        address: '0x8Eb270e296023E9D92081fdF967dDd7878724424',
        decimals: 18,
        network: Network.polygon
      },
      commonToken: {
        symbol: 'GHST',
        address: '0x385Eeac5cB85A38A9a07A70c73e0a3271CfB54A7',
        decimals: 18,
        network: Network.polygon
      }
    },
    {
      name: 'Aave Polygon LINK',
      poolVersion: 3,
      wrapToken: {
        symbol: 'aPolLINK',
        address: '0x191c10Aa4AF7C30e871E70C95dB0E4eb77237530',
        decimals: 18,
        network: Network.polygon
      },
      commonToken: {
        symbol: 'LINK',
        address: '0x53E0bca35eC356BD5ddDFebbD1Fc0fD03FaBad39',
        decimals: 18,
        network: Network.polygon
      }
    },
    {
      name: 'Aave Polygon SUSHI',
      poolVersion: 3,
      wrapToken: {
        symbol: 'aPolSUSHI',
        address: '0xc45A479877e1e9Dfe9FcD4056c699575a1045dAA',
        decimals: 18,
        network: Network.polygon
      },
      commonToken: {
        symbol: 'SUSHI',
        address: '0x0b3F868E0BE5597D5DB7fEB59E1CADBb0fdDa50a',
        decimals: 18,
        network: Network.polygon
      }
    },
    {
      name: 'Aave Polygon WBTC',
      poolVersion: 3,
      wrapToken: {
        symbol: 'aPolWBTC',
        address: '0x078f358208685046a11C85e8ad32895DED33A249',
        decimals: 8,
        network: Network.polygon
      },
      commonToken: {
        symbol: 'WBTC',
        address: '0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6',
        decimals: 8,
        network: Network.polygon
      }
    },
    {
      name: 'Aave Polygon WETH',
      poolVersion: 3,
      wrapToken: {
        symbol: 'aPolWETH',
        address: '0xe50fA9b3c56FfB159cB0FCA61F5c9D750e8128c8',
        decimals: 18,
        network: Network.polygon
      },
      commonToken: {
        symbol: 'WETH',
        address: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
        decimals: 18,
        network: Network.polygon
      }
    },
    {
      name: 'Aave Polygon WMATIC',
      poolVersion: 3,
      wrapToken: {
        symbol: 'aPolWMATIC',
        address: '0x6d80113e533a2C0fe82EaBD35f1875DcEA89Ea97',
        decimals: 18,
        network: Network.polygon
      },
      commonToken: {
        symbol: 'WMATIC',
        address: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
        decimals: 18,
        network: Network.polygon
      }
    },
    {
      name: 'Aave Polygon STMATIC',
      poolVersion: 3,
      wrapToken: {
        symbol: 'aPolSTMATIC',
        address: '0xEA1132120ddcDDA2F119e99Fa7A27a0d036F7Ac9',
        decimals: 18,
        network: Network.polygon
      },
      commonToken: {
        symbol: 'stMATIC',
        address: '0x3A58a54C066FdC0f2D55FC9C89F0415C92eBf3C4',
        decimals: 18,
        network: Network.polygon
      }
    },
    {
      name: 'Aave Matic Market AAVE',
      poolVersion: 2,
      wrapToken: {
        symbol: 'amAAVE',
        address: '0x1d2a0E5EC8E5bBDCA5CB219e649B565d8e5c3360',
        decimals: 18,
        network: Network.polygon
      },
      commonToken: {
        symbol: 'AAVE',
        address: '0xD6DF932A45C0f255f85145f286eA0b292B21C90B',
        decimals: 18,
        network: Network.polygon
      }
    },
    {
      name: 'Aave Matic Market DAI',
      poolVersion: 2,
      wrapToken: {
        symbol: 'amDAI',
        address: '0x27F8D03b3a2196956ED754baDc28D73be8830A6e',
        decimals: 18,
        network: Network.polygon
      },
      commonToken: {
        symbol: 'DAI',
        address: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063',
        decimals: 18,
        network: Network.polygon
      }
    },
    {
      name: 'Aave Matic Market USDC',
      poolVersion: 2,
      wrapToken: {
        symbol: 'amUSDC',
        address: '0x1a13F4Ca1d028320A707D99520AbFefca3998b7F',
        decimals: 6,
        network: Network.polygon
      },
      commonToken: {
        symbol: 'USDC',
        address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
        decimals: 6,
        network: Network.polygon
      }
    },
    {
      name: 'Aave Matic Market USDT',
      poolVersion: 2,
      wrapToken: {
        symbol: 'amUSDT',
        address: '0x60D55F02A771d515e077c9C2403a1ef324885CeC',
        decimals: 6,
        network: Network.polygon
      },
      commonToken: {
        symbol: 'USDT',
        address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
        decimals: 6,
        network: Network.polygon
      }
    },
    {
      name: 'Aave Matic Market WBTC',
      poolVersion: 2,
      wrapToken: {
        symbol: 'amWBTC',
        address: '0x5c2ed810328349100A66B82b78a1791B101C9D61',
        decimals: 8,
        network: Network.polygon
      },
      commonToken: {
        symbol: 'WBTC',
        address: '0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6',
        decimals: 8,
        network: Network.polygon
      }
    },
    {
      name: 'Aave Matic Market WETH',
      poolVersion: 2,
      wrapToken: {
        symbol: 'amWETH',
        address: '0x28424507fefb6f7f8E9D3860F56504E4e5f5f390',
        decimals: 18,
        network: Network.polygon
      },
      commonToken: {
        symbol: 'WETH',
        address: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
        decimals: 18,
        network: Network.polygon
      }
    },
    {
      name: 'Aave Matic Market WMATIC',
      poolVersion: 2,
      wrapToken: {
        symbol: 'amWMATIC',
        address: '0x8dF3aad3a84da6b69A4DA8aeC3eA40d9091B2Ac4',
        decimals: 18,
        network: Network.polygon
      },
      commonToken: {
        symbol: 'WMATIC',
        address: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
        decimals: 18,
        network: Network.polygon
      }
    }
  ]
} as aTokenAddressMap;

export const getATokens = (network: Network): Array<ATokenData> => {
  return addresses[network];
};

export const getATokenByAddress = (address: string, network: Network): ATokenData | undefined => {
  return addresses[network].find((vt) => sameAddress(vt.wrapToken.address, address));
};

export const isAToken = (address: string, network: Network): boolean => {
  return getATokens(network).find((vt) => sameAddress(vt.wrapToken.address, address)) !== undefined;
};

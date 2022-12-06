import { Network } from './network';
import { NetworkInfoMap } from './types';

export const AvailableNetworks: Array<Network> = [
  Network.ethereum,
  Network.arbitrum,
  Network.optimism,
  //Network.fantom,
  //Network.avalanche,
  //Network.binance,
  Network.polygon
];

export const networks: NetworkInfoMap = {
  [Network.ethereum]: {
    chainId: 1,
    name: 'Ethereum Mainnet',
    network: Network.ethereum,
    explorer: 'https://etherscan.io',
    subsidizedUrl: 'https://api.viamover.com/api/v1',
    iconURL:
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFAAAABQCAMAAAC5zwKfAAABIFBMVEUAAABofuNhdORofuNmgOJofuNofuNnfuRnfuNogOhnfeJofuNofuNofuRkgudof+RofuNofuNpfuNofuRnfeNpfuNofeRofuNofORofuRofuNnfuNmf+VogORofuNpfuRofuNofuJofeJpfeNnfuVrfuJkfOBsgOJofuRpfOVofeNofuPS2Oze4vbQ1urEyNlsgeRyhuTd4fZug+R5jeV2iuWSouezvuvP1erK0euotOqNneeDlOZ/kubW2/XZ3vOkseqaqOmXpuiJmubN1OzCyuvHz+y4wura3/XQ1/PK0PK8xe+uue6frejJzuDCxtrV2/C6w/C9xuqFl+bM0uXFzPHAyfHU2u6uuenEzOumseKgq+GSoOCps963vt2zutx6BRWYAAAAK3RSTlMAPQn5DvzlzSwW6NOZiRHHyfbv6dG0p6VxZ2VaSBz928GWhYF3TyEauie9Q8v46gAABGNJREFUWMO9mWdT4mAQxxMITSB0lWYvd/cQLtTQhVAExLOdnte//7e4rDEEkV0S58b/K0dnfrObbc+uHCmHmOW3A4l4zMWYKxZPBLb5U9HBvVGC9zgYirIluUPBtFd8Ay6b2vdE2EpFwoG01ybOe7AXZYQ2wocnNnCOoNvJ1si5e2T1YwoZN7Mkd0qwYh2/5WQW5dzi11opJP07zLKcnuQaI32bG8yWNjZ9JC/kYjbl+vQR5/F+9gb5eYyX8TBUssxQeTKIfQSPVZuMIK600Uf5W5neViivP67gfWCEZsValxEKv4q1sEnFtzmR8sMWFetNYak+klT+FRRJytcaBSofkw7rAZHVjgbM15vWk0cg67cwlQCYv6VM3NladDpF8VijqANrPbKuF7LRQfarsgTKaxqVyW5mfsUjRjl8owNBSokRChq8k11G6HJsAutV0kRj0BxSX7B9L5nA/DnltPPgeSCFqZSBiJjAek9muPayHChN5XRrKs2BoO9UvURTwBMDDFfpRloAghpUXPaFdR5Xx8vAQZ/qY17wOEKkzERaBubPiXqJHMNQp2pEeg2sNahUdHBiiOhanWUgqN5mqEIid+omaqS4ClhTcKejWY7HU7C3YGDxi0kcVfFk5LltvCk8zGln198+f/mq4+h62eYCdI2AznKaPmuqGU6rqIkBLoEWcUe3DnA6EJA6s46amODimIEXOu5bzgSCdM8fMRPjXAz5iwq0s2tgmUATifWxGOdCHJ5Ic+NMoIkcIsno4pCmMINPhwBBtQbiNAKsKAMaePW7ggBdiIm9YZ4A/q2WMJdjaGvtDjHgn59lhgYljjfXu0ZtFfDqRwvMk5G0SayGVcEGWR2tAPYBVeiXkMRGSu9u2isAslt/Cbz6Cb8uqaM7pPTQ5tAbP/QLGrH1qMfb8FbWcE1lUEWbA4+V3kzqzFrgXPV88Az8/UuGaDVGuW4JbV/ZKPYKvpfG0xlkW7k3BOCfXwX4NQQfnSvuU2IE9K+1cp5CM5UrSu7qsgw/NW+1yOOTLyQSQ0rujqHfXACINdsMwI+Q7flLmRhS3HEEbdkXTy2209CQgCuresgVNK0jaRj0+Gv4bqL32Ide4Sk4uScRr5EwDHphn6FSJV2dm2ZbMTKSGFEB8ek9HMUHn2KMqY6By3Vx3kaaA2X3iLfISHqWwRsWGOkx6MBJrTwvgfU+8eA8NE4gbuI91z1bBA4uidfc7vxQEqTWxoviAlChVsijpbWCns+6w21rawWXoZ7tveIc2KSe7KkXqxl1ClGKz0CFPLkIlq8NlXsdSO7gHt7Gelu9BuCwT6+3yAKO9R0kY7AFHE42dO7kzimHP/hsHjH6kxGVMX6f3TOLrKpkQP73Iei9TlVwvLF/TAv53vPcBwdJj9M6bsefFN75ZAoSUlaPuhnB6tn5aHf92dkNQ92yTg7DZHSiewe2b+3pQBg73Xv2U1nOvkRvOhhyv7ItFDz2Ctwb5RBPl//9kRXpT/cPLU5i53rf2LEAAAAASUVORK5CYII=',
    baseAsset: {
      address: 'eth',
      decimals: 18,
      symbol: 'ETH',
      name: 'Ether',
      iconURL:
        'https://github.com/trustwallet/assets/raw/master/blockchains/ethereum/info/logo.png',
      network: Network.ethereum
    },
    rpcUrl: (apiKeys) => [
      `https://mainnet.infura.io/v3/${apiKeys?.INFURA_PROJECT_ID}`,
      'https://api.mycryptoapi.com/eth',
      'https://cloudflare-eth.com'
    ],
    displayedName: 'Ethereum'
  },
  [Network.polygon]: {
    chainId: 137,
    name: 'Polygon Mainnet',
    network: Network.polygon,
    explorer: 'https://polygonscan.com',
    subsidizedUrl: undefined,
    iconURL:
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFAAAABQCAMAAAC5zwKfAAABBVBMVEUAAACCR+WCR+WDR+WGSOaCQeODR+WCR+WCR+WCR+aCR+WCR+WDR+WCR+WCR+WCR+aCR+WCR+WCR+WCRuaCRuODSOaDRuaMVe6CR+OCSOmDR+aCR+WDR+aDSOWDR+WCRuaCR+WESOSDRuSDQ+GGSeOESOeCR+X///+KU+fz7f39/P+FS+aDSOb69/6HT+aVY+n7+f739P7g0vmle+2ideyXZuqRXeju5vzGqvOGTefx6/zq4Pvo3vq6mvGogO2OWOjs4/vWwve/ofKzju+wjO+uie+rhO7l2Prj1fndzvjUvvbDp/Oaaur17/3QufbJr/TayPjNtfWeb+uMVefKsfS4lvC2kvDjENCeAAAAJnRSTlMA7dh2GAv428+5r5n7UejglmRZLyMfVAdKGfTVxL2efnE4JhMPSX7XiQoAAAQiSURBVFjDtZnnetowFEDlwZ6ljOydawLGAbMhFAKBQFht1vs/SltjOViC+OK05xcf4IOlOyRk4oC8J8UDouBVVa8gBuLSnkzck4qEfGFgCIsn6X03Nk8kKMAWosGEZ0fd5ZkfPiPsl64IHvk0Bo5EJfR0Jg4BhS+dweiSAS9gCV44+74JsAMH35xiG4IdCWU+He4x7MxRarvvux9cIJ5v9fnAFbHvm33nMXCJb6MxJYJr/EnelzmCL3DM13YIvkSIy2f4IkyGXxwAT/YlD2gE2zR6gsDR7ffm+kgFLIF1YRpYmsO68ofifRWQeBPEYp/N6Hz5TjEpTGuA41AmFAnszO5zyget9yygOKW+q6h98n6VFDuPZVR0YpebblBrUF3ubmyZ9RkgODND7AcLddijjnFFhe6Sjr241BAVuKqXBHzwTu+uPVwlTHVBlWPnYYcjhjC4liw9Mw6dpnXPlYn5G2XEGmPkzFpIsjfGta+2TNGGc+PdB0S5/O3eEWCFS2Aol5BC+DvmE1aYewYWnQoxTUdkhYVbYHmyCfPq9t5NiBxGCucVMBiNC/U3bVucZbIHKGFusXq3+mSk0d22kF8TCSNcTKpGCtWmOZqok2fYhETiGOGtMWtap6V8UFpUgSdOAs5C2tIeFTs3/eyGNisihc8TOtqW3qMv6wM2OiIROGGuAhy1RYGOtN9VtYHVQnTmywLxckLlZ5PRvUzp5BVfa6rxxekN7egjWMdLgBEaRtt0N9/pxbm1D7KvRcWgbU9zuzDfNm+kkQVKxYrF3Q/btTN9FRp7ZOxDhlGRznzfGLdatZaX9oBtiNqYF3ppUCgV3bqfkZavNYo0FtMscAx4oUBE9mcHdatr6zc0FvcbU+kHLxRJAFi0fkuxM6mogBQGSBx4bulCuj55+RpGGCcSbGL2k8ai8NZdde3HN4xQou2LwmRLsfFiFp6idDDCa9pgeZoPj/WnGRg8FBRHIW2wxAdbsULRUJBCEbMXpsIlIg9P6DKKEbbYXNT0lZBZRlMCUqi0K7biK4+5Wo7u062IAx2zdp6qa5u+gpmmeWYrghlzrc7sZ5t9oyrZ9T9hbucQRqvplDoa5Ed1qusN+e0cOQMEH7vuuW7pSg3NXiYrLmOAQBtSpaX71YV1otZBySmgyHZWE0db2oxb5CnyIeC4XRat/stt5H0ysUh4AYm5JNSHTWAIp8kaAcCSH+nzXr8LHEGP7fRCALzyJQs8Bxf/+u/t//4DTjzH8AWOMoQj6QfXiCnMsQ2e2PmWgyBECeKObSjnIrjAb/l4Ui4Ob46T5BMyux/3eZwOJA9gB4RvxJGLIGDxBpIEQSaNzJ/DBEEiS1FE8p3KBM+V5HfIlbNLshueRDC6NRTBiIe4YD99IvIPF3yhSIq4R75ePf4AQD7++A3znwLnHG42xAAAAABJRU5ErkJggg==',
    baseAsset: {
      address: 'matic',
      decimals: 18,
      symbol: 'MATIC',
      name: 'Matic',
      iconURL: 'https://github.com/trustwallet/assets/raw/master/blockchains/polygon/info/logo.png',
      network: Network.polygon
    },
    rpcUrl: () => [`https://polygon-rpc.com/`],
    displayedName: 'Polygon'
  },
  [Network.binance]: {
    chainId: 56,
    name: 'Binance Smart Chain Mainnet',
    network: Network.binance,
    explorer: 'https://bscscan.com',
    subsidizedUrl: undefined,
    iconURL:
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFAAAABQCAMAAAC5zwKfAAAAxlBMVEUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADwuQtaRQQeFwETDgHlsAp4XQULCAAHBQCScQfrtQsPDAEvJAIaFAGWdAd8YAVvVQXttwvPnwnKnAk6LAIlHQHClQmxiQiObQbptArTowm8kQihewdhSwRRPgNLOgM0KALirgreqwraqAq4jQh0WQXXpQqshAimgAdGNQMqIQI+LwODZQaAYwZpUQWceQeIaQZeSARrnHNdAAAAEHRSTlMA3yAQ74BgUM+/n5CvcECgMlK+dwAABGNJREFUWMPNmWl74iAQx43xSjzKaGLOtfG+a9Wq1bbb9vt/qa0Bggrk6B7P/t85j/yEmWGAMZcgtVzXNUVBXypUNL3YUHPZxWBVBXFS9PL3oI1aAcmklzNProhpUimlfHZcArKYmleKPJc0y1S4vIZSq5Zi3fUCyqBC0iTVKsqoavxyKyizKvkYnoK+ISWfxMtOzM770en8iCNm5Hm7NYB5b2UjyuPR7EOo2YM8Mny9kObL4xwijfzU2VOSOW88hUs9t5BY9RsHiveHERAck3tviPfMtRtrSCC7uWczW7gA1JU2EkhLWrD98hTN6mmA0CD6CPMXEfFyW4syZtcFot5naLA++9EvBKLcYZEuIoGsthkONtte5FJi2rSFfixKU9qycIQnAF2yQ0hSt5wuTDs40jYXF1XiwcG8tyI5+DxAoY6jPvHby/sjCrXqjQbcFEUeHC7gS0+PiMl/PpsOw0vTXJCVBcwrX8X2zSR+d+iXjQ9qejWoySFJ1A2uvNkIgfrVvgWi6YICvQ4ZvXZoxWktooRvXp0xYdVHIuB8cOnUcbjkS9NxTIFcWMoC4LaJo3rq+NgRq9me7I9HB7vSam55ICrjFXNAPMZ4m4LZ8fB4G5smAO7EwNETAKs4xhzw7D472OPZBnYUsR02bZZnU0sAVKgLeaA1Aqreiq47MvU9MRCpuca14dQjQMMEprl/LrQuM5gGAc5u6mOZ28f2zw0PhO7inO4ccN+2uTp7x1fVzpQBmXjg1OFrhJ7TEK+Tlwbo+cIyW0FMrKqkABJ56CbMhWvDw7tByNs44JaWs/fmLRDdps3m1cNTfO1K50dS29q5JG2YeCA7hYZjMe/gk+/2ACRAPrGxXvo8bnSkJQcgA5CqfeNKc2mheKAi23qkdHqOeYFziDGwJMCCFGiYfVLDPhjwjTrPNCTASk6TAgHGfrhqBmyHFXHsghSo5e5igOAueeAnAMiBeq4eB4R7HngfCyzmyn8W2JAWWG8UB3ySRVmVHwGouZcBe0skPwJyVQHwhLfqqykCmjsPFzkBUJcco+ZPPKa14oHHFs7t5VpyjKoF4UFPCgQHJFr1AQRAlVyHeSB0D74c6B+6IALquLlwVbGXZrRx6dVwR0zrN3pvjHDrHbfiL10X7R9OdFxuAkJYnAkdcp0LNkA1GXIxFt2IT+NuNIKucTSiF8ZJhBsPhdd2FhamB+pyJzJFMXKi+4TNv/jYFPnjPgL6BrUafgTc/rTll/acqiBOrQ+TANv9ZZiV9nLWJkB3InjsKkkvPX9MgAD44eMCAR78pIcPd3+gd38CBHfxTPPQ6R3FLZc0j0fL5xN7aKV5PJI6y4sDylRK/QBHAQMGGdo3qrxF8DDDuH5T3iLI1sSw2muAdeDFNDH+dpuFEf+H1hLm/eVmGlP2dp+a1C/N1pCsp2iZ1tLztPy/beoyFVMgC8UsDfd8SUnGZVT5Tk6rNb7558KdIvBctfxb/1g0irpWKYQkRdPribBfoLdgpJRYxOQAAAAASUVORK5CYII=',
    baseAsset: {
      address: 'bsc',
      decimals: 18,
      symbol: 'BNB',
      name: 'Binance Chain Native Token',
      iconURL:
        'https://github.com/trustwallet/assets/raw/master/blockchains/smartchain/info/logo.png',
      network: Network.binance
    },
    rpcUrl: () => [
      'https://bsc-dataseed1.binance.org',
      'https://bsc-dataseed2.binance.org',
      'https://bsc-dataseed3.binance.org',
      'https://bsc-dataseed4.binance.org',
      'https://bsc-dataseed1.defibit.io',
      'https://bsc-dataseed2.defibit.io',
      'https://bsc-dataseed3.defibit.io',
      'https://bsc-dataseed4.defibit.io',
      'https://bsc-dataseed1.ninicoin.io',
      'https://bsc-dataseed2.ninicoin.io',
      'https://bsc-dataseed3.ninicoin.io',
      'https://bsc-dataseed4.ninicoin.io',
      'wss://bsc-ws-node.nariox.org'
    ],
    displayedName: 'Binance'
  },
  [Network.avalanche]: {
    chainId: 43114,
    name: 'Avalanche C-Chain',
    network: Network.avalanche,
    explorer: 'https://snowtrace.io',
    subsidizedUrl: undefined,
    iconURL:
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFAAAABQCAMAAAC5zwKfAAABC1BMVEUAAADoQULpQkPoQULoQULoQULoQULwTU3pQULpQULpQULoQULoQULpQUHoQETqQkjySUnpQkPpQULoQkPoQUHUNjbpQULpQULpQULpQULpQULoQULoQUHoQULoQULpQULoQELoQkLpQkLoQUHpQUPoQkLoQUPnQkPnQEPqQ0fnPj7oRkboQUL////0qKj++PjpQkPsXl/pSUrvdnfqTE3+8vP85ub72Nj4xsb3wcL0pKXxiYrwhYXqUVL//v797Oz86Oj84uL74OD3vb32uLj2sLHykJHucXLtaWrrWVr/+vr60dHxjI3vfn/tbG3rVlf1q6vzmZrylJTvfH3pRUb97u75zc3zn6DsY2TWHQgoAAAALHRSTlMA4B7v6dhzBt77uq2XRyQQDkvx+U0J49XNxL62lZORjX94bGtiXFZVLBoUC0M2P2IAAAOHSURBVFjDpZjpVuJAEEYLEiDsqxs7qKzVA4qKICIu4Dai4/7+TzI4MElIutIJ3N8596S7v1RXCgREK95sQJGSiP6EEsiXUnVYnWiqoPjRyFYo3ljF5gsHJSSQg2GnupjXg5Z4vD4Huo3iJgqRy027vqqMtnDt29K502ibTETs25XQAdKe6Gxz6JBQzHK5O+iYbbeFj8zK5LLbIc+mRvkiLiQYMMaO70gjcTQ10nc0YjNO6fy4ueslffjF/tGhvxuOMbaNFPetufCqjRQ75g8xhCQ3bMEESXJG3x6STIdswccRkuwaDlhCivYjUxnTQml5GzNIcsY0ZtEhSet9+0hydMJ0XCNNVfM1XUjyypaYIom8oQrLSPLcWhZ220hSVEuMLIyMxm8k2YwthF4k+R4ahReHSOJdCD1I8shMvCGJZ76LYSQZMDNjpJnfrkGkODzhCHtIE4QZDdkiMg6FUnQmjCPF+TFP+IIWpCzLzA3j0bESFmbCLSQ4aPF8V2iFAlBHilPG48lS6I/SW/jE6COhqUCJiswlz/dwIBB6IU+WQR59FJCFgJPInDyLhAEgSuGY8XhFEQokHEVGiAR+B5G5FQuTgDw6qoO6UCa9F/6dyn3DNjcyrXtU6f/0Om2uMGk7Mn90W/xA3QZJkDiZvhBF5pP9MOIsOgGK3cicocobm/PF6ewgYDMyj7ot/l/Ih+ecYGfRyDXjcbd0IjP4PWgevPYic6NrF4+1WmFKZgkqxsh0eb6PZ34h7xqFcYj6HUZmOrRqJOoAip3IaAF5X17BaPlctgCggHp+ier+gH73GaGZMGXozzl86tpF4wpa58tbCBCVhJHR1f0Xy5IhNwytyB3XNyZCb45OUG2WrCJzoVtUj/6GtGbJ59E2nMeECL05Oh5Dw9keceu+rsO85ApH74aGM7YYWdyqjxB/Et+MWV0Nsg8WFOleodVBjSlT4TW1ZW2sIhPNwrB3ILq7tJ9KVxNUqovP6qz/S0d/cm/qkdUHNAaLTV4auqRxbTKgx51Y1ydFDOOadYWmAU5uPV8IjPh21vFtx+ihjXPoscjKvho1CFrRFwGC2kpGj9Xwa9u5b8cNFsRCTn05H1izJznRJXZBSCRj35d2gx32bZ6NXAWbNMuyWLdZ3HAyZxcPxmPgkHCQfE0pGPbBCjTioS2TzK8UUlFYnXq8lA+4En7EpKQEst6KSPYX0mFsmY8rTUwAAAAASUVORK5CYII=',
    baseAsset: {
      address: 'avax',
      decimals: 18,
      symbol: 'AVAX',
      name: 'Avalanche',
      iconURL:
        'https://github.com/trustwallet/assets/raw/master/blockchains/avalanchec/info/logo.png',
      network: Network.avalanche
    },
    rpcUrl: () => ['https://api.avax.network/ext/bc/C/rpc'],
    displayedName: 'Avalanche'
  },
  [Network.arbitrum]: {
    chainId: 42161,
    name: 'Arbitrum One',
    network: Network.arbitrum,
    explorer: 'https://arbiscan.io',
    subsidizedUrl: undefined,
    iconURL:
      'data:image/png;base64,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',
    baseAsset: {
      address: 'areth',
      decimals: 18,
      symbol: 'ETH',
      name: 'Ether',
      iconURL:
        'https://github.com/trustwallet/assets/raw/master/blockchains/arbitrum/info/logo.png',
      network: Network.arbitrum
    },
    rpcUrl: () => ['https://arb1.arbitrum.io/rpc'],
    displayedName: 'Arbitrum'
  },
  [Network.fantom]: {
    chainId: 250,
    name: 'Fantom Opera',
    network: Network.fantom,
    explorer: 'https://ftmscan.com',
    subsidizedUrl: undefined,
    iconURL:
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFAAAABQCAMAAAC5zwKfAAABBVBMVEUAAAATte0Tte0StuwTtewTtewTte0UtewYuPUXsu4fq+0TtewTtuwTtewTtewTtuwSte0Ttu0Us+sbteQTtuwStewTtu0Tte0TtewTtewTtewTtewTtesTtewTtu0Stu0TtuwStu0TtusUtesRtO0TuPETtu0TtOoTtez////3/f75/f+U3vfl9/0buO0Vtu3i9v1gzvMtve7e9f191/VNx/Egue3x+/7H7vuL2/Zv0vRq0PPN8Pu/6/qq5Pg6wfAywO8wvu/8/v/D7fqj4vid4PeG2fUmu+7v+v7a9Py46fllz/NSyfFAw/Dy+/7o+P3T8vyy5/mJ2vWR3fZazPJ21PRFxfBOomx8AAAAKHRSTlMA7+Ae6dhz3hIOBrqXlGxWS0ckCvn7rePVzcS+tpGNf3hiXE4sGvGtwGqu3QAAA/VJREFUWMOtmGlT4kAQhieA3KeA932+AQOCoHKJqIh4H7v7/3/KZrpYYDHTQ5Cn/GCliqcyPT2dnhYaggl/LBIwMkD2yBPZ3EkeitkJ7W8FsphkJZoMzmILp5YMKPAdp1y/nH8BLAv+sAtdensZWnzx9LS+hA9T4dmbSuddx9RsLOp9cQMuMHZ1vhhcEg2xy12Da1a9jG8BM+A5UPkWPZgJj2JrDjgfb/Q6rjeAmVlwMIZW8QPWvh/EKDjarY82OGKTvl0w9Lo3pml2y2CIT2wwcz7OKxcm8VYpMGfm/zBuQEWx9G67cl81+ZJnJShZH/ftQcXLpWlz2wauW4P/VCRGvrQqAztdeq8GiKdTqbxThdKXHlUYRfDuZfAuvs6HD04e7AcPlR4c2R5+PnyOwWtYps3HH4xx/SifndXhxPK/wuOHE5f001+Y4OmMQgkn/AOhc43J2b9rdhwCIY155xMYJl8KSqF52ihOZpFlKoVIkXBJJSQuqxijageCER5Ts+FTCktydTdXwzwpX0lZ/1kpNGRPkYRSCFRknuTuKXEKNfnSr/b5UwqxT2WGEaJzR6Gso/DLotftAYxwyxauMELJS1Mqm7ejgDLCgBCH0AgpwwnrN6ARZoMiyQuJE5O4L2iFSIgdrfDZMgf0S1qhX2xqhGWqWhfyz+ajrRHGRIQV9j5pk0v2ok+oeuW656wwIjycsC4deTt2Umgn4qvcmgYnDIgjRngrda0OQEJZveiovDNCQ2QYoU3zGRISSqp9+yEjzAhwQqtSxEhIFOtvnBC88K3+XVixWKFuyf3qxJKbuiUbjPDdtLm6HgnLrbys/+ymBBgh6BS/1v6lzX2eKg+fNnxiF7o56XiSwhJ9lms9TWLHNEev/TF+9FplzdHbFH5OSJT65gDrWVscdkRCK0ThN+34wyegFSZFMMsKR1+nuw6mEB4KEdAJiRdarVa4IoTY0guJqYRRW7g/T2FStv/G/IS+ILUi8xMea5qlnqIR1TRLYWU7Z9XhQP1N2c6xDWf3VRbsP45dfP6TbThDy3CCPiCUzyPK1Oo8XjtvyfB+tg1nqJpateLoCvRADY72MpX2wUbRuI8abboCWQ0o8KTFkARUFGoXgzW2H6lVLEDFf0MXZrRCHeJN7Stn6x7LzMhFjOM1AO56RrSqUGNMzAni4Hg6pYsjx67Lgc0nd7WlMvONNfyA1RAztJnfWMQzs+9g/oOgeY6CFrjh1ypcs+YVDKEoXBILC55ddwPJuNCyuIGpWfeKadibcm98CTEl6bgPWpa3027m7PrBeEi4JLWkfE1jKRUWMxBMRlcwSTawtR8Us3OY3NmMBI4yQMYIRGL+hE72FyrvI6030sOmAAAAAElFTkSuQmCC',
    baseAsset: {
      address: 'ftm',
      decimals: 18,
      symbol: 'FTM',
      name: 'Fantom',
      iconURL: 'https://github.com/trustwallet/assets/raw/master/blockchains/fantom/info/logo.png',
      network: Network.fantom
    },
    rpcUrl: () => ['https://rpc.ftm.tools/'],
    displayedName: 'Fantom'
  },
  [Network.optimism]: {
    chainId: 10,
    name: 'Optimism',
    network: Network.optimism,
    explorer: 'https://optimistic.etherscan.io',
    subsidizedUrl: undefined,
    iconURL:
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFAAAABQCAMAAAC5zwKfAAABEVBMVEUAAAD/AyD/AyD/BiD/BB//ACf/BCD/AyD/AyD/BCD/BCD/BCD/BCD/AyD/AyD/AyD/ByH/BB//Ayf/Ax//BSL/BCD/BCD/BCH/AyD/BB//BB//BB//AyD/AyD/BCD/BCD/BCD/BCD/Ax//Ax//BCD/Bh//AyD/BBv/ADP/AyD/BCD/////sbn/FS//6+3/ipf/DCf/+/v/vcT/KED/JDz/HDX/8PL/4eT/yM7/cYH/anr/Qlf/9/j/9fb/0tf/zNL/wsn/rbb/mqb/jZn/YHL/VWn/N07/Lkf/5un/19z/pa//naf/kZ3/h5X/hJL/ZXb/W23/Umb/TGD/SV3/297/t7//k5//eYj/O1H/uMD/eYk1DI+TAAAAKnRSTlMA8N8f+gm7devh2tewl5JXIxANTh29eHJM7ePNxJqQgGtlX1BILRYTBeBjqtYqAAADY0lEQVRYw63Z53qiQBQG4AGJurHFbnpvn8HEHjXVxJhNL5uye/8XsnAsQRlBYN5fwzzwZeDAPJOR2diNBSJ+WVIARdpPr2RyKeZefDMqKxgXWk7uuEmb2QpLmGA+nHM8uOwsLM0GZpyMbnUBtoLZxLR5sSCmIm9MFedLY2r+Ofu8NQkOSOs2cXtROBSxfJKpJTi26LN4fCG4IG9Pypv7BVd+TSjNNuW5SvRx71eGayHOlJFYhAdLe6bACDyJjuetw6O1sQJL8EgaLYwfnqWNeRsQIGaosAwBgj9TbhZCrA4n6CCEWIj3AzMQJNAPnIUgs72nmIMwWxQYhjBhPW9nHsJIelmSEGhTC1zGJK2n89tarV5qVtDXOOi7fHi+mTTphMB3c5EfKDyCqMW8wd8uTGTGUuC7Hrm4TX3v+REF8yCV3UmP8C0/6hWaf2OdZ0ecGYL/mVQKdMXx4UvjnFolaC71Vv1Qc9kbf5nzsayA54rOv9dHoFJiUW/SX7mD7pBOeMe4CH9qVet0RyBtulYFqtS4ps4mtVsY52f74Hg3XIoHOjgCnqnRNYywyimzNPGOiyrIgX5QG/TWDM/4GCYSU8BxbDz9fFCUEvWWNc06DfAZJgoDx9GJfvohSPVUP3jSeqlh8Bsc3MBW79UzHrwAN2N5fyrg4N5ygy74BvmigwoV1uiCm6dwi0J1LRyBlAZ3d0c5J5rT27PHFrgkJsPsg+4IpELfxOegUiVYk7kvdolGqALDcX3/FMean7vquqcQfc5S273nZSiOtRUW4E1d/dfi46JGjdPu8GMrw1qGxXjv4Vl+RGM41dzCRpLtKjAr1w1xRcoDdR3ARopxy4xqu9CPqx10qUeloyashRhjUXBV374+768anepwDu90Oq8qrC1rgZsQKKkFxiUIM78jfCmi24IwOQqcEbecY8T8sXhdcMYXYOJt1b4KIbJM7KpdTrChGATYYAZpeOZnRj7v/zzOjW3XwCPTBk4UnkTMW0BL8GAxwd20cU3mb4u432bZFr8RxLctw4WQ1ebXIhxbSjELiQgciu4xa+vONiTXmK05P6aW9rFpbExZm2CMTSmRDcLWwqqjneyM7cZ4nDmUC89PLEV4a4a5sJNcNn/fihzdjDP3UsnMSrr/84fsjwRiu8zafytbQlgTbIKaAAAAAElFTkSuQmCC',
    baseAsset: {
      address: 'oeth',
      decimals: 18,
      symbol: 'ETH',
      name: 'Ether',
      iconURL:
        'https://github.com/trustwallet/assets/raw/master/blockchains/optimism/info/logo.png',
      network: Network.optimism
    },
    rpcUrl: () => ['https://rpc.ankr.com/optimism'],
    displayedName: 'Optimism'
  }
};

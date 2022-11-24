import { getAPIKey } from './keys';
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
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAMAAABg3Am1AAAACXBIWXMAACE4AAAhOAFFljFgAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAALHUExURQAAAP///4CA/0lt21WO42qA1WCA33GA42F522F552iA3GqA32yA62SA22SA5GaA3WN73miA52mA4WeD42V512aA32yA5Wh64meC5GaE5Wd+4Wl+42mB42eB5GaA4md85Gl+5Gd+4mp+4ml942d94Gh+5Gh94mh94mh+5Gd94ml95Gh84mh942h+5Gh+4mh+5Gd94Gl+42Z94mZ/4md942Z/42h+42l/42l/42Z+4md/4ml/5Gd94mh/42d/4md/42d+4mh94mh+4md94mh/5Gd942h95Gh/5Gh+4mh+5Gd94Wh/42d+42h/42h+4md+4md+42d+4md+42h+4mh+42h+4mh+42h+42l/42h+42d+42l+42h+4mh/42h+4mh+42h94mh+42d+42h942l+42h942h94mh+42h+42h+42h+42h94mh+4mh942h/5Gh+42d+42h+42l+42l/42qA42uA42yB422B422C5G6C43CE5HCF5HGG5HKG43KG5XOG5HOH5HOI5HSI5HaJ4niL5XmM5HmN5XqO5XuN5XyO43yO5XyP5X2Q5YCT5YGT5YGT5oeY5YeZ54mZ4ImZ5Yqb54ub5Yuc54yc546d6I+d4I+g5pCg55ak55ak6Zmm4Zmn6pqo6Jqo6pup6J6q4Z6r56Gu66Kv66Ow7KWx6Kez7am16Km16aq26au27K6437C77rG76bO96bW/77XA6rbA77fC77i/27nD6rrD8LrE77vE8LzB3LzF6r/H67/I6cHG38HJ68HK6sHK68PL6cTI2cTM8cXK28XN68bK3MfO68jP8sjQ7MnO4MnR68nR88rP4crS68vS7MzS5M3U8s3U887U587V6s7V68/V6dDW6tDW7NHX7NLY69LY7NPZ7dTa7dXa9NXb79Xb9dbb9djd8dne8tre9dvf9dvg9Nzg9d3h9d3h9t7i9nTrT6AAAABxdFJOUwABAgcJDBASFRUWGBocHB4fICIlJigoLDk8RUlJTVBUVVlZWlxdYGJnaGhpbnFzc3R1en1+f4CBi4yNjY+TlZmcn6Cpqa2xtbq6vL2+v8LDyM3P09PW2Nvb3d7e3+Hm5+jr7e7v8PHz9fb3+Pn6+/3+uTj8XgAAAsFJREFUSMeVlndbE0EQxleJRkXs2BU72HvvvTeMvWAXNQjreWgwCopiwS4q9oZdsaHYa0TsXTmSM2pUNLkP4V4KZOf2jsf5LzPvL3fv7N7OIgSjVP2ug8fNjcGRk0f2DK1cFGlHsSYjFmH/GNOugoa8ZOdZWBHG3hVV5AGNZ2BmGHvoWPpyQ2OwWoQHK/XVpmONWFAb6htGYu1oCfTzQT1pqyZRdTYsX3m0HKZCCvRlp8Jiap7tGAd95DsPGAD15ueS7e06mDX4uhsWBUsnXZJNuBQL0208ev1EWEj6IRHg825Fc8u4gebRsHBDkgHhnhkWerEfkJrnAQSl7+IEqBuldOwFlL5bE6Avw7EXUPoejVBgBMOxD1D6DkLVwabgbkkFgNJ3KGrFcixJzk9uQEgDvrujPizHf76LWdnvBYbv4WgInTjlcstFMctiyX6To/A9Hhmo38kO5y9Z7gZIvMwR9lCCeWiK/0/+5s+vougHEORxPEXQgOm8VQSAJT2RBuhXwtvu0MDtvUvAK1Gm+Y0cf+CdH3A8DifE0abpth68uBKbz+Z6gfQNi01HTvN0W+mF4zIcR3m8OdNKgOs7OLzz4d0EsHA1FlKJ1R+k19s5ft+r+4eW4jWXrblbaI8NUIlpdCblt+S8th6bV2BT2hdRhFujPEL9wWY6Q9bacSKW2/WUOLm6jC6OIt9DPfp8x6Yn8m76mCmvyLO14N9ayCNhAkgmf5MJO9Hb9sNPNFD+qNvCU/vwXy9wjgeVbp4xMgmkuQwP8GAV8wEINYLHAOktAWBHMe7oOyoHwgrprV3RURyuUz+ML7jssKN+hzEZP3Mw7O0L2FFcU3OgbEopbAT958giQyhCcyjWYozdQdGqekMwc7A3m6ky2LvoVO4C+vYMxNivisZtQx82jN68YzsEFXKfQaXrdMq//jStVASW/wEogaFbzyd4UAAAAABJRU5ErkJggg==',
    baseAsset: {
      address: 'eth',
      decimals: 18,
      symbol: 'ETH',
      name: 'Ether',
      iconURL:
        'https://github.com/trustwallet/assets/raw/master/blockchains/ethereum/info/logo.png',
      network: Network.ethereum
    },
    rpcUrl: [
      `https://mainnet.infura.io/v3/${getAPIKey('INFURA_PROJECT_ID')}`,
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
      'data:image/png;base64,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',
    baseAsset: {
      address: 'matic',
      decimals: 18,
      symbol: 'MATIC',
      name: 'Matic',
      iconURL: 'https://github.com/trustwallet/assets/raw/master/blockchains/polygon/info/logo.png',
      network: Network.polygon
    },
    rpcUrl: [`https://polygon-rpc.com/`],
    displayedName: 'Polygon'
  },
  [Network.binance]: {
    chainId: 56,
    name: 'Binance Smart Chain Mainnet',
    network: Network.binance,
    explorer: 'https://bscscan.com',
    subsidizedUrl: undefined,
    iconURL:
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAMAAABg3Am1AAAAAXNSR0IArs4c6QAAAexQTFRFAAAAAAAAAAAAAAAAQEBAMzMzJycnIiIiICAgJiYmJCQkIiIiIiIiISEhICAgHh4eHx8fIyMjICAgIyMjIiIiHx8fIiIiIiIiISEhISEhICAgICAgIiIiIiIiISEhISEhISEhICAgISEhISEhISEhICAgIiIiISEhISEhICAgIiIiISEhICAgIiIiISEhISEhISEhICAgIiIiISEhICAgISEhISEhISEhISEhISEhICAgICAgIiIiISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhIiEhIiIhIyIhIyMhJCMhJSQhJiQhJiUgJyUgJyYgKCYgKyggLCkgLSkgLSogMS0fMi0fMy4fPjYePzceQDgeS0AdTUEcTkIcT0IcUEMcUUQcUkUcU0UcVEYcVUccVkgbt48RwJUQwpYQw5cQxJgQxZkQx5oQyJsQyZwPypwPzJ4PzZ8Pzp8Pz6AP0KEP1KQO1aQO1aUO1qUO16YO2KYO2KcO2acO2qgO26kO3KkO3aoN3asN3qsN4a0N4q4N468N5LAN6bMM6rMM6rQM67QM67UM7LUM7bYM7rcM77cM8LgL8bkL8rkL8roL87oL87sL9LsLZzp8xAAAAFJ0Uk5TAAECAwQFDQ8QFBUlJicoKjEzODs8QUNERUZHSEtMTU5lZmtsbW5ydH1/gYOHiZmco6anqK2wsrS3ucXU1eHi4+Xm5+rr7fHy8/T1+Pn6+/z9/kArqqAAAAKLSURBVEjHhZZnQxQxEIZzp6BYsCv23sWCvWIXUO80BrCLHRXsIiLq2RDFXqh6lPxRs5PZJLOX5ebDbSb7vLcpk5kwFrXEpHXlKa4sfXDz7AKWz+bt58SqlieHw1dzj22N/cz8k9xvpV48sYtAF8jARufyY04Q/tsAUfBZUX4CHcRXKQfOk56llB9H+S9SWf850rfE5Qsp/1lKj2K6IzhG3nRItP6zpL/Q8NtJ/ydpLEsUFSFfTPiP0rHsGffVShRUuZ3tklj2tPtyBPAlblcbgr8f+xQbQVDp9LwP+VP8CTb/uYpEsMWO/w6hP0I5TR7FQiUos+4jRDoFuE9DhSUOK0Ha+cIbALoEus1acN0hkqyArOlbl+f8WcDfcIGpbHLYrMdZ9wB/+SG4LSFfi9R6Voqt17IRnhng64bkA3Cf34THz781GtvLduhGRn27wXz40pBy79uB/JCyTytSbA88X8Hs7oT8ILj3HF4pqqHNDgW/L3EBb0HfxUF09SD5d+31VlvBCySuUEED2X4U6CHpT1zFIaCikQRYLw4JJx1M4pqddKC4ayf9wUwhZZY1o3nxS+Ay6UVq1QvR3meW1WwcjEd048bV4TZIeRsaNWbjSGiILjWUHhsaLXbp0KaQ4BOdMNlu4YaSlPUk+NgG67XicmL4NfvDuygnvPFAmONQa4EFwRGt8B+5prgjymZw36H2HukyT5ppy59m2Hgem5govyJMfdviUh9NfEdsMj7qT67ZuGQcTfcd3uQ9zS0QYz0FIlIeFtESVJxTgiL84miRK0rTIhcpcSWesrszvuxWjvJW6rlxhX1N7NVhlQ/fMnK428acfZHLybJkvvtMYuLa3cfh+nNg08zcP/8PuwLRDbB/SGoAAAAASUVORK5CYII=',
    baseAsset: {
      address: 'bsc',
      decimals: 18,
      symbol: 'BNB',
      name: 'Binance Chain Native Token',
      iconURL:
        'https://github.com/trustwallet/assets/raw/master/blockchains/smartchain/info/logo.png',
      network: Network.binance
    },
    rpcUrl: [
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
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAMAAABg3Am1AAAACXBIWXMAACE4AAAhOAFFljFgAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAI6UExURQAAAP+AgKpVVepAQOpAVdg7O9g7Tt9AQO9AQOM5OeM5R+NHR+lDQ+1AQOVGRudAQOg+Pug+RuhGRuhAQOhARuhGRuM+ROhBROhEROdCQupCQupCRedAQudCQupCQudCQuhBQepBROhBQehBQ+lBQ+dAQOpCQuhAQuhCQudBQ+dDQ+lBQ+dAQulCQulBQelBQ+hBQ+c/QedBQuc/QedBQedBQ+dAQudCQudCROdBQepBQ+dBQedBQ+hBQuhAQehBQehAQuhCQ+lCQ+hAQehBQehBQudBQelBQuhBQulBQuhBQulBQudBQuhBQulBQudBQuhBQedAQedBQudAQuhAQuhBQudBQulBQuhBQulBQuhBQuhBQuhBQudBQuhBQehBQudBQehBQuhAQedAQehBQuhCQ+hDROhERelJSulMTelNTulPUOlQUelRUepSU+pTVOpVVupYWetXWOtYWetZWetZWutaW+tbXOtdXuxfYOxgYe1tbu5wce5zc+5zdO54ee90de94eO95eu99fu9+f/B9fvCAgPCAgfCGh/GIifGKi/KPkPKSk/KTlPKUlfKVlfOenvSgoPSio/Sjo/SkpPWqq/WtrfWur/ays/a0tfa3t/a4ufe2t/e6uve6u/e/v/i9vfjExPjFxfjLy/nHx/nOzvnQ0PrPz/rQ0frU1fvY2PvZ2fze3/zi4vzj4/zk5Pzl5fzn5/zo6P3o6P3r6/3s7P7u7v7w8P7y8v7z8/75+f/9/f/+/v///8B3BMwAAABkdFJOUwACAwwMDQ0QEBISEhccHSAhISEsLCwtT09VVVVgYGBhbW1ubnZ3d3h4fn5+f3+JiZGSkpWVlZeXl5i3uLi5v7/GxsbMzMzN0NHR09PU1NjZ3t/f7u7u7+/w8PP09vf6+vv8/f60A4ADAAACWUlEQVQYGY3BiUMMYRgH4DfXFqt1JzbriigKuY9y5yqKtlWJ9QvlpnEfSY6U+77v3LKrkLz/m5nZ2dnvm9ltex6y6Z+Ws7CwxO/3rcybNSqZ4nCMzYdkvcdJsTmyfbCpnO+i6PpkehFV+aQEimJ4AWLaNIhsUrzoRlUaWUyERPnedhiSqSTJhOwj80vI0kkwBrKrrDoNWQqZhmyDpDrAqlbISoeSoVcxZC2suwjZmr4UkgHZ0V+sa9sD2TTSucohe8KGW5CVOkgzF7JjHNa5F7JsUjkrIGtl013IyhKJyAPZFY54C4vxRLQBkl0BjvgEi3yiZMhaWPAcVkmUCkldOwtOwcpNsyF5zIJnsJlJeRApLOhQYLOAVkH0jgU3YVdIPggaWRDcDbsttBOCAAsaobt0GYId5EdEMws+QHeduRkRftoM05EACxRolN/Mf2phKqMimB6w4BF0T1l1B6YVtBhhShdHBBVoTrKm6zjC8mgGwl6x4AZ031j3GmG55IbhLAuC0DWx4QwMo2kADD9YcB6afUE2fK5GSDLRUuiaWPAGuntsugbdWiIaB83+AEf8U6BR/rKpowYaDxEl+qC6z4KH0L1gwW2oKpykyoaqnSOCh6A5wKLOagDzSOPwAvjCpvd10NX8ZMFXAFtdpMsCcPBcQ8iFEwhT6htM9bUAMiik92r0yMYEMozwogeqBpMpBT3gJkE64ppCkkzEkU4W7u3ohnck2biKEVPBMIoiYXI5ovJm9aPoXHMqYeOb7qDYnJ51kCyb4KA4BqbmLlnu8/tLihblpCWR1X+EWlyWtOoKMQAAAABJRU5ErkJggg==',
    baseAsset: {
      address: 'avax',
      decimals: 18,
      symbol: 'AVAX',
      name: 'Avalanche',
      iconURL:
        'https://github.com/trustwallet/assets/raw/master/blockchains/avalanchec/info/logo.png',
      network: Network.avalanche
    },
    rpcUrl: ['https://api.avax.network/ext/bc/C/rpc'],
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
    rpcUrl: ['https://arb1.arbitrum.io/rpc'],
    displayedName: 'Arbitrum'
  },
  [Network.fantom]: {
    chainId: 250,
    name: 'Fantom Opera',
    network: Network.fantom,
    explorer: 'https://ftmscan.com',
    subsidizedUrl: undefined,
    iconURL:
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAMAAABg3Am1AAAACXBIWXMAACE4AAAhOAFFljFgAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAALrUExURQAAAACA/wCqqhWq6hW/6hSx2BCv3xCv7xC/7w644w648Qux6Ra96RK27RKw7RK55RK57RC35xC37w+y6A+56Bey6BG57he07he57he16BO17BK07RK36hW07RW37RO17BW16hW17BKz7RK16hK17RW17RO07BO37BOz7BO17BO47hO07BO27hO17BW37BK07RK26xK27xS06xK16xSz6xS16xO17BO27BO17BO06hO26hO16hO17BO16xO17BO27BK06xS37RO27BO17BO27BS27BK07RK27RO07BO07RO17BO17RO37BO27BS17RK26xS17RS26xO17RO07BO27BO27RO17BS17BK27RK16hO17BK17BO17BK17BO17BK17BO17BO17RO27BK16xO16xO06xO17BO16xS16xK17BO17BO06xO17BO06xO07BO17BO16xO17BS17BS27BW27Be27Bi37Rq37Bq47Ru37R657R+57SC67SG67SW77ie77Se77im87Sm97Sy97i297i+97jC+7jC+7zG+7zK/7zS/7zTA7zW/7zfA7zrB8DzB8D7C8EDD8EHD8ETF8EXE8EjG8EjG8UvH8E3H8U7H8U/H8VDJ8VbK8lfL8lrM8l7M81/N82DN8mLO8mPP82TO82bP82zQ82zR827S83LS9HXU9HrV9XzW9X/X9YHX9YfZ9ojZ9oja9Yja9ona9Yna9o/c9pDc95Ld95Pd95fe9pjf95nf957h95/h95/h+KPi+KTi+KXj+Kbj+Krl+a/m+bDm+bHn+brq+r/r+sDr+sHs+sPs+sTs+8Tt+sTt+8bu+8ju+8vv/Mzv/NHx+9Lx+9Lx/NPx/NTx/Nn0/Nv0/Nz1/d/1/N/1/eD1/OH2/eL2/eP2/eP3/eT3/uX3/ef3/ej4/ej4/un4/uv5/uz5/u35/u/6/vD7/vH7/vT7/vX8/vj9/vj9//r9//r+//v+//3+//7+//7//////wyY1nsAAABxdFJOUwACAwwMDRAQEBISFxccHR0dICAhISEsLCwtT1VVVVVgYGBhYWFhbW1ubnZ3d3h4fn5+fn9/f4mJkZKSlZWXl5eYt7i5v7/GxsbGzMzMzdDR0dHT1NjY2dne39/u7u/v8PDw8/T09vb39/r6+/z9/f3+bT5rqQAAAthJREFUSMeVlmVAFEEUxwcVELCwxcRWxBZRsRDsBBM8QrHjfICFnolnJ6LYLYot2I0tHoqBhYsYxCEe9vvoXsnO7N4dvC+7897/tzs7szP/IYQNO2d3z2H+0+XB/bw8apUlFsK2YU+gwreBgxm5TfsgEMXEbo4m5MVbBYBkhDSzktJXHgQmw6+SWO8UAGZicm1W3xQsRAta3xIshotQ7wyFCKcCfYVJbHFj0qMVbC6gqlFfzI8pLbr+CxFvRTLpwdYGwJXOzzqTgynbotLwy/G5dKWNXu8YQmV3vcPcU+EAM+OykTtEd8pWB3QR5rY8QLxt6MuyRMQna4VVN62+1HhhKh/zYgpam3/id2E1SPuK+kAD+P6AsbEjFWkAGvOALw2k3kS8oxvSdQ8Rr7ylgV6ElKMHIl8Fq14hXl6suPQNn0VBMg2AHakuAgBiOfycjTl7+FsWqEM8JADY+5WfuN0gAXQg3mJg6V38ywOYuFwMdCcDWCAiPg+To9Xq1c9Rc3YOCwwlwQyQnoFZB0NBrQY4zCHHMcBoMoMBUJOg4K9aAOadYyYOYCqRs8CP8/ONgCJewwJy4s8AHN+PWB0Qtj8TP6QzQBAZzn707NMafLFGrY5WYV5CBPvR/UkP8bAqE7WD+gfvRYqH1Yt0lJq4rWmIKdulJs6DXf96AODosXCQAmoSe2nAGCxQhpDeRQF8+PXQiAZemgXq8UBJ6uf4iI9XFrQ2qDBLWB2nMws3YUrJL7gbS/T3C67+xmsLhdWueteRUW9V3sdPR8IAQk9mYtJ6qjTGYC1tmR1uH4dvNsU8xdc7mUJzw85XYiC7jcZlIOaeYLMj/xtRNRlbU168oBCZSkWB/RRmu6dMyMWynrGg1kUyIJ0JTTEnlzmJbbT8KNP6IVWkjNrKdayJx7ezNnEWcOw8QSwPdLMxc9pwqOtDy/s0sbV0oCldo5N330D5NP8Rnu7O9qLyPyjujUYe0y8uAAAAAElFTkSuQmCC',
    baseAsset: {
      address: 'ftm',
      decimals: 18,
      symbol: 'FTM',
      name: 'Fantom',
      iconURL: 'https://github.com/trustwallet/assets/raw/master/blockchains/fantom/info/logo.png',
      network: Network.fantom
    },
    rpcUrl: ['https://rpc.ftm.tools/'],
    displayedName: 'Fantom'
  },
  [Network.optimism]: {
    chainId: 10,
    name: 'Optimism',
    network: Network.optimism,
    explorer: 'https://optimistic.etherscan.io',
    subsidizedUrl: undefined,
    iconURL:
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAMAAABg3Am1AAAACXBIWXMAACE4AAAhOAFFljFgAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAITUExURQAAAP8AAP8AFP8AJ/8AIP8AHv8AGf8AHf8AGf8AIv8AIP8AHv8AHf8AI/8GHf8DIP8DH/8DIf8DIP8DI/8DIP8DIP8DIP8DH/8CIP8CIP8FIP8EIP8CIP8EIP8EIv8EH/8EIf8EIf8EIP8EIP8EIP8EH/8EH/8DH/8DIf8DIP8DIP8DH/8DIf8DIP8EIP8EIf8EIP8EIP8EIP8EIP8EIf8EH/8EIP8EIP8EIf8DIP8DIP8EIP8DIP8EIP8EIf8DIP8EIP8EIf8DIP8EIP8EIP8DIP8EIP8DIP8EIP8DIP8EIP8EIP8FIf8HIv8IJP8MJ/8OKP8SLP8ULv8VL/8YMf8ZM/8bNf8cNP8cNf8eN/8fN/8gOv8iO/8jPP8kPP8mPv8rQ/8sQ/8tRf8zSv83Tf88Uv89U/9CV/9CWP9DWP9IXP9OYf9QZP9SZv9TZv9Vaf9Xav9Za/9abf9cbf9cbv9fcP9ic/9idP9oef9pev9xgf90g/96iP99i/+Bj/+BkP+Ckf+Jl/+Kl/+Mmv+Nmv+Qnf+Snf+Snv+Sn/+Xo/+Zpf+apf+apv+fqv+jrf+kr/+osf+rtP+vuP+0vP+1vf+1vv+2vv+3wP+6wv+9xP/Ax//FzP/GzP/L0P/L0f/N0//P1f/T2f/Y3P/f4//h5P/h5f/i5f/l6P/m6f/p7P/t7//v8f/x8//3+P/4+f/9/v///06rcaMAAABLdFJOUwACDQ0QERQaHh4gIiwsLFBRVldXX2BhYm9wcHZ3d3l6en1+f4CLjJOTlpebm7m5ub/IztHS19fZ2d/v7/Dw8PHx8fX19vf3+/v9/fwdsL8AAAIvSURBVBgZlcEHQ1JhGAXgF2MkZJmFlFaWOdIsAUsFLMvSlNO0vWzZ3lNbtmzvXbZtp+n5iYHSvRcvyOfziIndXVxeHQyHa/3ekqx0ScE2yYc4lR6HJGctrIFJQ5lTEkubGURCS6ZZJIGMeUgq4BKTzCCG0ZgtQ+QihXyJMwMp5YpBNhRkisbVCAWhsRJjCUBJRZoMyoOiAhngXApFIatElUFZkUQ4GqBsgU1EPBiBHBGpxAj4REYj3tb2zlsXdyHqaFvU8W0wsMsEGDU/5YBHK4BNjLm9HJqJUgqjN4y5Chzgfx3QFIsXBm1k/5UNG5+RPSvRQX5sadnzhXwJzVzxw+Ar+RDASZJr0UU+APCKfA1NlSyGbgfJgwDayT/AT/IMsP0HeQGakIShO032IuIm2YXdJN8+ftJLfmuBJixh6O6R7xHxgbyDU4zpOQJdWELQdZE3AKzrI4/hGtnT3d394vJ6GCySKug+kZ0ALpH9q/COvAsTv8yB7jn5++y+zr/kdYDkCZh4ZRZ0hxnzeTX2ktwJkxJxw+D8d0b03W8G2slfMBsvdsTZf67t0BpEbG5t3QKzdBEfRmC+iORgBDwiYlsIZfUOiSiCstkSZQ1BUZ1TBhRAUZ4MGlUBJQGLxIwJQcEyl2gyocAtBlOQUr7EyUcKU2WI7EYMIzhOTFwBJFWRIQlYptchoWBBmiTmLKuHSU2hVZJzeCoRxzfZJimkZ5V6/bVNTcHq8mK3XYb6B5p3VUTQMTPlAAAAAElFTkSuQmCC',
    baseAsset: {
      address: 'oeth',
      decimals: 18,
      symbol: 'ETH',
      name: 'Ether',
      iconURL:
        'https://github.com/trustwallet/assets/raw/master/blockchains/optimism/info/logo.png',
      network: Network.optimism
    },
    rpcUrl: ['https://rpc.ankr.com/optimism'],
    displayedName: 'Optimism'
  }
};

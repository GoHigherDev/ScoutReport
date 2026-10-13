import { isAddress, zeroAddress, type Address } from 'viem'
import { getChain, isSupportedChainId } from './networks.ts'

export type FanTokenConfig = {
  key: string
  symbol: string
  sport:
    | 'football'
    | 'esports'
    | 'motorsport'
    | 'mma'
    | 'rugby'
    | 'basketball'
    | 'other'
  name: string
  expectedDecimals: number
  addresses: Partial<Record<88888 | 88882, string>>
  sourceUrl?: string
  retrievedAt?: string
}

// Maintainer-verified EIP-55 addresses, code and metadata on Mainnet at block 38370630:
// https://github.com/GoHigherDev/ScoutReport/issues/21#issuecomment-6141845905
// Approved sports and DOJO inclusion:
// https://github.com/GoHigherDev/ScoutReport/pull/22#issuecomment-6142801649
// DOJO's on-chain name is DOJO and symbol is $DOJO; its approved ticker is DOJO.
// Legacy 0-decimal AFC is excluded: it is not on the official V2 list.
export const FAN_TOKENS: readonly FanTokenConfig[] = (
  [
    [
      'NAVI',
      'Natus Vincere',
      'esports',
      '0x02728748392F1875682940681F4C936Fc683A68e',
    ],
    [
      'AFC',
      'Arsenal FC',
      'football',
      '0x76088F3eD5dC655De9295D93868ec1EeC654A615',
    ],
    [
      'ACM',
      'AC Milan',
      'football',
      '0x062F6004FD0BF204D272Ff115E5b84F7A01489D1',
    ],
    [
      'ALA',
      'Alanyaspor',
      'football',
      '0x3B60F483fe311FC063b50A67BF327F96B76696E6',
    ],
    [
      'ALL',
      'Alliance',
      'esports',
      '0x109b738569A04eA31CA06B47aF06CfdDa87ADF48',
    ],
    [
      'AM',
      'Aston Martin Cognizant',
      'motorsport',
      '0xf0D5De46729f4E2F28c27a98E15Ef18dF951Ec44',
    ],
    [
      'APL',
      'Apollon Limassol FC',
      'football',
      '0x0B00E360BEE5557D0D9A548030AA8f7182daF56f',
    ],
    [
      'ARG',
      'Argentina',
      'football',
      '0x4394886B1eec08Fe88681462914702dC99D97Eb7',
    ],
    [
      'ASM',
      'AS Monaco',
      'football',
      '0x57F3D2382025cF5d6c3B126dcE0360D9Cf3AfF49',
    ],
    [
      'ASR',
      'AS Roma',
      'football',
      '0x0Ac7bf9783CA1dcd86A39B5a2607160D29256EB0',
    ],
    [
      'ATLAS',
      'Atlas FC',
      'football',
      '0xc1A2b6950786383114828FCF816199b6d5f4960A',
    ],
    [
      'ATM',
      'Atlético de Madrid',
      'football',
      '0x7da0eB973D982FFcA095E80437F5e37459a95C67',
    ],
    [
      'AVL',
      'Aston Villa',
      'football',
      '0x4F3a607bB2717683108865fc785BadFa90094431',
    ],
    [
      'BAHIA',
      'EC Bahia',
      'football',
      '0xc75037B67Ade9364F451D49bfAE776619a292181',
    ],
    [
      'BAR',
      'FC Barcelona',
      'football',
      '0x1589248b4B61ed472cc21CA1F2114d93ab6910D5',
    ],
    [
      'BELG',
      'Belgium',
      'football',
      '0x6c4C9DFE8C940b51B68d00C6D76dE756B252f328',
    ],
    [
      'BENFICA',
      'SL Benfica',
      'football',
      '0xF4c653b74929953B29B966aBA99b681Fb5ab69cF',
    ],
    [
      'BFC',
      'Bologna FC',
      'football',
      '0xD77de9fcE56F371e347217D57394f1Fa07F02d64',
    ],
    [
      'BUFC',
      'BALI UNITED',
      'football',
      '0xafb78165c62744bd21B4DDef48c11A93D395dAa2',
    ],
    [
      'CAI',
      'Club Atletico Independiente',
      'football',
      '0x99F7b1f8d445b6CBD231017820DE372e2c5f9a27',
    ],
    [
      'CHVS',
      'Chivas',
      'football',
      '0x3624BA092480fb0bDB5ec50EbaC699BdFa561416',
    ],
    [
      'CITY',
      'Manchester City FC',
      'football',
      '0x7Bd6242D775fAEf1d50B2aA18C2FBF329BDDF295',
    ],
    [
      'CPFC',
      'Crystal Palace',
      'football',
      '0x58613484D9683d52899e13d42BB3fb9eEB0749da',
    ],
    [
      'DAVIS',
      'Davis Cup',
      'other',
      '0x97B79Dd60A1211A9612f98194591F4483FF83cE3',
    ],
    ['DOJO', 'DOJO', 'esports', '0xb66D72efc5fD77A8F9Dc2E7c0f14304828956644'],
    [
      'DZG',
      'Dinamo Zagreb',
      'football',
      '0x03bE2eA82839FBD8b6ab16aDdEba3FE4C88bB43F',
    ],
    [
      'EFC',
      'Everton Football Club',
      'football',
      '0xa84E55C2464563441cb4114372DF8D5aca49Fc83',
    ],
    [
      'ENDCEX',
      'Endpoint CeX',
      'esports',
      '0x4CF8426c1D90a505dcb8D96c4F295494a548f4a2',
    ],
    [
      'FLU',
      'Fluminense FC',
      'football',
      '0x9840dC03032f4F35d7DBdc8dB832aCFAF6Ff3e77',
    ],
    [
      'FOR',
      'Fortuna Sittard',
      'football',
      '0x078B3C0Ad7Ea92EfD14Af146bf4171E80cE41e1C',
    ],
    [
      'GAL',
      'Galatasaray S.K.',
      'football',
      '0x770da1e5dDB22f3Ccc2482493BD9B10A7A8A38Ae',
    ],
    [
      'GALO',
      'Clube Atlético Mineiro',
      'football',
      '0x558Cc7Ac99793B10c1C142a1C7e5AdF6657DeA9c',
    ],
    [
      'GFK',
      'Gaziantep FK',
      'football',
      '0x72b30f41D5163A5082f9461f0B8346789639e063',
    ],
    [
      'GOZ',
      'Goztepe S.K.',
      'football',
      '0x6ba1FB0dAdAEB34ea24EB31d416805abE8921448',
    ],
    [
      'HASHTAG',
      'Hashtag United F.C.',
      'football',
      '0x3c1487C5036105338396055d74EeE505a9F6A2f3',
    ],
    [
      'IBFK',
      'İstanbul Başakşehir FK',
      'football',
      '0x7B69003C404B0579F257c16E2664b4Eb4c7b2acf',
    ],
    [
      'INTER',
      'Inter Milan',
      'football',
      '0x1b3385A26214057bB7e27c173ee2D14201752e73',
    ],
    ['ITA', 'FIGC', 'football', '0x90111A53D94efe28F34562b53F04F471522d57b3'],
    [
      'JDT',
      "Johor Darul Ta'zim F.C",
      'football',
      '0x9aF2bD7003f043124AA13A21a2460996F7Ba9a3B',
    ],
    [
      'JUV',
      'Juventus',
      'football',
      '0xeAf368DAdC22524deF47E8A1C26bFC17AC16E6F5',
    ],
    [
      'LEG',
      'Legia Warsaw',
      'football',
      '0xFd8A11532c5Ca9bec64ec86e4E5ed78089CD443f',
    ],
    [
      'LEV',
      'Levante',
      'football',
      '0x084Ba7f44Cd799dECDe593A4045170f014c29845',
    ],
    [
      'LUFC',
      'Leeds United FC',
      'football',
      '0xE3ECD48f7653e6da693B544d50caB0BCdCd35C13',
    ],
    [
      'MENGO',
      'Flamengo',
      'football',
      '0xBfF8FaBb04f6494fe393EB7416A698869569A310',
    ],
    [
      'MFC',
      'Millonarios',
      'football',
      '0x580edA966a8129C3c01D149871B47feFcC599D28',
    ],
    ['MIBR', 'MIBR', 'esports', '0x8CAf9018Aa56f7Db55bB353005C7aa0FBfb1736b'],
    ['NAP', 'Napoli', 'football', '0x90593E9602b38A0D5b63d9f34AC3560798cEE7d4'],
    ['OG', 'OG', 'esports', '0xb3f2E39Acc68F98229B2587361a8cE30aCDf0442'],
    [
      'PERSIB',
      'PERSIB',
      'football',
      '0xDD15623d107c639aF0C5127AFFA26d3f20327EC8',
    ],
    [
      'PERSIJA',
      'PERSIJA',
      'football',
      '0xdc061856766d4991724307b9b0EA217fF8F3bbEE',
    ],
    [
      'PFL',
      'Professional Fighters League',
      'mma',
      '0x3444F5436A3C02F3a3dB8f2436b02BC1EEa950d6',
    ],
    [
      'POR',
      'Portugal National Team',
      'football',
      '0x013F2407c6eF765F1199f8818B805121F269F5b8',
    ],
    [
      'PSG',
      'Paris Saint-Germain',
      'football',
      '0xFe1d4A935df7A4A52F835f6104C97AF9D72217f2',
    ],
    [
      'QUINS',
      'Harlequins',
      'rugby',
      '0x110A0fC65a0f78840f4b4A04A42e8c285E424553',
    ],
    [
      'RACING',
      'Racing',
      'football',
      '0x02300475d1EdD5b2E88EFdeBD3fFb549110D8Aa6',
    ],
    [
      'ROUSH',
      'Roush Fenway Racing',
      'motorsport',
      '0xAe0E559cfB64191e376317895f1d643df22d8dD7',
    ],
    [
      'RSO',
      'Real Sociedad',
      'football',
      '0x53838837f258f8Ef337C8b4CEb60a89190EcBa8B',
    ],
    [
      'SACI',
      'Internacional',
      'football',
      '0x4c360BE766dD95c973bE30c4130E7b4B762113E0',
    ],
    [
      'SAFA',
      'South Africa',
      'football',
      '0xf81Aa505Df80278Fc4cF2B050086f678D48bDdCE',
    ],
    [
      'SAM',
      'Samsunspor',
      'football',
      '0xf78E9Ce916a7D6b3d4FaCbA95b9e9b8BbA5df609',
    ],
    [
      'SAN',
      'Club Santos Laguna',
      'football',
      '0x3BA1eB0FF58537d8b77E8446273295fC432439A9',
    ],
    [
      'SARRIES',
      'Saracens',
      'rugby',
      '0x72B1FCA1008BE96C4fdE2539379c1778A76c4fCa',
    ],
    [
      'SAUBER',
      'Alfa Romeo Racing ORLEN',
      'motorsport',
      '0xE64c9D1471cFb5e7b03c998AC8137b441c60AF6D',
    ],
    [
      'SCCP',
      'Corinthians',
      'football',
      '0x25fb4ff916faFb88d78918c54C1d14B57586046b',
    ],
    [
      'SEVILLA',
      'Sevilla FC',
      'football',
      '0xA584cca6a5C46ead6FF8EF3beB8FAC76364c36Cb',
    ],
    [
      'SFA',
      'Scotland',
      'football',
      '0xfaB24366503Eb0fa8CB8FB7d1311159FD4283657',
    ],
    [
      'SFP',
      'Stade Français',
      'rugby',
      '0x04aa2d5c46691f05D30b9E65a9E09C8ea383c7B0',
    ],
    ['SHARKS', 'Sharks', 'rugby', '0x0cb13408921F87E3A3D011b03935A81A1542bDFa'],
    [
      'SPAIN',
      'Spain',
      'football',
      '0x7A224b67aAA360e48402AAb4Ff12D89eEF9b4cF8',
    ],
    [
      'SPFC',
      'São Paulo FC',
      'football',
      '0x6345c0ECcA1B9007a9043CB5da8150aE07adD498',
    ],
    [
      'SPURS',
      'Tottenham Hotspur',
      'football',
      '0xd699ACD21011c20381E5138A430bb0d7b6E9BC7F',
    ],
    [
      'STV',
      'Sint-Truidense Voetbalvereniging',
      'football',
      '0x71Bc882c60b9EfDf85D0E1A28Fc86f0BD822132F',
    ],
    [
      'TH',
      'Team Heretics',
      'esports',
      '0x0b5De9e1303F3FB4F67D1ACA1503DDB28Bf59834',
    ],
    ['TIGERS', 'Tigers', 'rugby', '0xc430fFb62961Ff910181eDcAE34aE9Fc418a15cE'],
    [
      'TRA',
      'Trabzonspor',
      'football',
      '0xEff432433Dd57AdFA37004af00DB148F9407e7bD',
    ],
    [
      'UCH',
      'Universidad de Chile',
      'football',
      '0xFe050a08699a2557bCc0A8E6C2805eBA55D61065',
    ],
    ['UFC', 'UFC', 'mma', '0xC9f723625e80a81cBa2CAd3e6871D3bdf2a7ECC7'],
    [
      'VASCO',
      'Vasco da Gama',
      'football',
      '0xD5f1B2454db115967bfAc73bFEa21Da5e2543c8E',
    ],
    [
      'VCF',
      'Valencia CF',
      'football',
      '0x83d7D1df01C698b4379077aF4bCEB2D4AF113BfF',
    ],
    [
      'VERDAO',
      'Palmeiras',
      'football',
      '0xb46357d8Ed050D35D3a24154c39d7236dAE86187',
    ],
    [
      'YBO',
      'BSC Young Boys',
      'football',
      '0x8c4d631A673bE24F244E4f0645BE6928d0083d4e',
    ],
  ] satisfies readonly [string, string, FanTokenConfig['sport'], string][]
).map(([symbol, name, sport, address]) => ({
  key: symbol,
  symbol,
  name,
  sport,
  expectedDecimals: 18,
  addresses: { 88888: address },
  sourceUrl: 'https://docs.chiliz.com/quick-start/token-contract-addresses',
  retrievedAt: '2026-10-13',
}))

export const validateTokenConfig = (
  tokens: readonly FanTokenConfig[] = FAN_TOKENS,
): void => {
  for (const token of tokens) {
    if (
      !token.key ||
      !token.symbol ||
      !token.name ||
      !Number.isInteger(token.expectedDecimals) ||
      token.expectedDecimals < 0 ||
      token.expectedDecimals > 255
    ) {
      throw new Error(`Invalid Fan Token configuration: ${token.key}`)
    }
    if (token.addresses[88888] === undefined) {
      throw new Error(`Missing Mainnet address for ${token.key}`)
    }
    for (const [chainId, address] of Object.entries(token.addresses)) {
      if (
        !isSupportedChainId(Number(chainId)) ||
        !address ||
        !isAddress(address) ||
        address.toLowerCase() === zeroAddress
      ) {
        throw new Error(`Invalid address for ${token.key} on chain ${chainId}`)
      }
    }
  }
}

export const getTokenAddress = (
  token: FanTokenConfig,
  chainId: number,
): Address | undefined => {
  getChain(chainId)
  validateTokenConfig([token])
  return token.addresses[chainId as 88888 | 88882] as Address | undefined
}

import { defineChain, fallback, http } from 'viem'
import { chiliz as viemChiliz, spicy as viemSpicy } from 'viem/chains'

const mainnetRpcUrl =
  typeof process === 'undefined'
    ? 'https://rpc.ankr.com/chiliz'
    : process.env.RPC_URL_MAINNET || 'https://rpc.ankr.com/chiliz'
const mainnetFallbackRpcUrl =
  typeof process === 'undefined'
    ? 'https://chiliz-rpc.publicnode.com'
    : process.env.RPC_URL_MAINNET_FALLBACK ||
      'https://chiliz-rpc.publicnode.com'
const mainnetWsUrl =
  typeof process === 'undefined'
    ? 'wss://chiliz-rpc.publicnode.com'
    : process.env.RPC_WS_URL_MAINNET || 'wss://chiliz-rpc.publicnode.com'
const spicyRpcUrl =
  typeof process === 'undefined'
    ? 'https://spicy-rpc.chiliz.com/'
    : process.env.RPC_URL_SPICY || 'https://spicy-rpc.chiliz.com/'
const spicyWsUrl =
  typeof process === 'undefined'
    ? 'wss://spicy-rpc-ws.chiliz.com/'
    : process.env.RPC_WS_URL_SPICY || 'wss://spicy-rpc-ws.chiliz.com/'

export const chiliz = defineChain({
  ...viemChiliz,
  rpcUrls: {
    default: {
      http: [mainnetRpcUrl, mainnetFallbackRpcUrl],
      webSocket: [mainnetWsUrl],
    },
  },
  blockExplorers: {
    default: {
      name: 'Chiliscan',
      url: 'https://chiliscan.com',
    },
    chilizScan: {
      name: 'Chiliz Scan',
      url: 'https://scan.chiliz.com',
    },
  },
})

export const spicy = defineChain({
  ...viemSpicy,
  contracts: {
    ...viemSpicy.contracts,
    multicall3: {
      address: '0xcA11bde05977b3631167028862bE2a173976CA11',
    },
  },
  rpcUrls: {
    default: {
      http: [spicyRpcUrl],
      webSocket: [spicyWsUrl],
    },
  },
  blockExplorers: {
    default: {
      name: 'Chiliscan Testnet',
      url: 'https://testnet.chiliscan.com',
    },
    spicyExplorer: {
      name: 'Spicy Explorer',
      url: 'https://spicy-explorer.chiliz.com',
    },
  },
})

export const chilizTransport = fallback([
  http(mainnetRpcUrl),
  http(mainnetFallbackRpcUrl),
])

export const spicyTransport = fallback([http(spicyRpcUrl)])

import { defineChain, fallback, http } from 'viem'
import { chiliz as viemChiliz } from 'viem/chains'

const mainnetRpcUrl =
  typeof process === 'undefined'
    ? 'https://rpc.ankr.com/chiliz'
    : process.env.RPC_URL_MAINNET || 'https://rpc.ankr.com/chiliz'
const spicyRpcUrl =
  typeof process === 'undefined'
    ? 'https://spicy-rpc.chiliz.com/'
    : process.env.RPC_URL_SPICY || 'https://spicy-rpc.chiliz.com/'

export const chiliz = defineChain({
  ...viemChiliz,
  rpcUrls: {
    default: {
      http: [mainnetRpcUrl, 'https://chiliz-rpc.publicnode.com'],
      webSocket: ['wss://chiliz-rpc.publicnode.com'],
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
  id: 88882,
  name: 'Chiliz Spicy Testnet',
  nativeCurrency: {
    name: 'CHZ',
    symbol: 'CHZ',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [spicyRpcUrl],
      webSocket: ['wss://spicy-rpc-ws.chiliz.com/'],
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
  http('https://chiliz-rpc.publicnode.com'),
])

export const spicyTransport = fallback([http(spicyRpcUrl)])

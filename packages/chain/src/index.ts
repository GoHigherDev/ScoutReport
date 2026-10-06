import { defineChain } from 'viem'
import { chiliz } from 'viem/chains'

export const appChain = defineChain({
  id: 88882,
  name: 'Chiliz Spicy Testnet',
  nativeCurrency: {
    name: 'Chiliz',
    symbol: 'CHZ',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [],
    },
  },
})
export const dataChain = chiliz

'use client'

import { createAppKit } from '@reown/appkit/react'
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
import { createConfig, type Config } from 'wagmi'
import {
  chiliz,
  chilizTransport,
  getAppChain,
  spicy,
  spicyTransport,
} from '@scoutreport/chain'
import { brandTokens } from '@scoutreport/ui'
import { NAMES } from '../copy/names'

// Socios/Chiliz: "Displaying the Socios.com Wallet option in the WalletConnect modal"
// https://connect.socios.com/interact-with-chiliz-chain/prerequisites (retrieved 13 Oct 2026).
export const featuredWalletIds = [
  '56843177b5e89d4bcb19a27dab7c49e0f33d8d3a6c8c4c7e5274f605e92befd6',
]

export const projectId = process.env.NEXT_PUBLIC_REOWN_PROJECT_ID?.trim()
const networks = [spicy, chiliz] as [typeof spicy, typeof chiliz]
const transports = {
  [spicy.id]: spicyTransport,
  [chiliz.id]: chilizTransport,
}
let adapter: WagmiAdapter | undefined
let config: Config | undefined
let appKit: ReturnType<typeof createAppKit> | undefined

export function getWalletConfig(): Config {
  if (!config) {
    if (projectId) {
      adapter = new WagmiAdapter({ projectId, networks, transports, ssr: true })
      config = adapter.wagmiConfig
    } else {
      config = createConfig({
        chains: networks,
        transports,
        connectors: [],
        ssr: true,
      })
    }
  }
  return config
}

export function initialiseAppKit() {
  if (!projectId) return undefined
  getWalletConfig()
  appKit ??= createAppKit({
    adapters: [adapter!],
    networks,
    defaultNetwork: getAppChain(),
    projectId,
    featuredWalletIds,
    metadata: {
      name: NAMES.product,
      description: NAMES.description,
      url: window.location.origin,
      icons: [
        new URL('/brand/scoutreport-x-avatar.png', window.location.origin).href,
      ],
    },
    features: { analytics: false, email: false, socials: false },
    themeMode: 'dark',
    themeVariables: {
      '--w3m-accent': brandTokens.accent,
      '--w3m-color-mix': brandTokens.bg,
    },
  })
  return appKit
}

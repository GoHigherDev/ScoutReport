'use client'

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider } from 'wagmi'
import { getWalletConfig, initialiseAppKit } from './config'

const WalletContext = createContext<{
  available: boolean
  openConnect: () => Promise<void>
}>({ available: false, openConnect: async () => {} })

export const useWalletModal = () => useContext(WalletContext)

export function WalletProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient())
  const [config] = useState(getWalletConfig)
  const [modal, setModal] = useState<ReturnType<typeof initialiseAppKit>>()

  useEffect(() => {
    setModal(initialiseAppKit())
  }, [])

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <WalletContext.Provider
          value={{
            available: Boolean(modal),
            openConnect: async () => {
              await modal?.open({ view: 'Connect' })
            },
          }}
        >
          {children}
        </WalletContext.Provider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}

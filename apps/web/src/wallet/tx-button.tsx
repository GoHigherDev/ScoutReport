'use client'

import { useRef } from 'react'
import { useConfig } from 'wagmi'
import { getAccount, getWalletClient } from '@wagmi/core'
import type { Address, Hash } from 'viem'
import {
  decodeTxError,
  explorerTxUrl,
  getAppChain,
  getPublicClient,
  useTxGuard,
  type GuardedTxRequest,
} from '@scoutreport/chain'
import { TxButton, type ButtonProps } from '@scoutreport/ui'
import { NAMES } from '../copy/names'
import { InsufficientGasPanel } from './gas-panel'

export type TransactionButtonProps = Pick<
  ButtonProps,
  'disabled' | 'className' | 'variant'
> & {
  request: GuardedTxRequest
  label?: string
}

export function TransactionButton({
  request,
  label,
  ...props
}: TransactionButtonProps) {
  const config = useConfig()
  const chain = getAppChain()
  const guardedAddress = useRef<Address | undefined>(undefined)
  const guard = useTxGuard(request, { getWallet: () => getAccount(config) })

  return (
    <TxButton
      {...props}
      labels={{ ...NAMES.gas, idle: label ?? NAMES.gas.idle }}
      guard={async () => {
        const wallet = getAccount(config)
        const result = await guard()
        guardedAddress.current = result.ok ? wallet.address : undefined
        return result
      }}
      write={async () => {
        const address = guardedAddress.current
        if (!address) throw new Error(NAMES.gas.unknown)
        const wallet = await getWalletClient(config, {
          chainId: chain.id,
          account: address,
        })
        const current = getAccount(config)
        if (current.chainId !== chain.id || current.address !== address) {
          throw new Error(NAMES.gas.wrong_network)
        }
        return wallet.sendTransaction({ ...request, account: address, chain })
      }}
      waitForReceipt={async (hash) => {
        let replaced = false
        const receipt = await getPublicClient(
          chain.id,
        ).waitForTransactionReceipt({
          hash: hash as Hash,
          onReplaced: ({ reason }) => {
            replaced ||= reason !== 'repriced'
          },
        })
        return { ...receipt, status: replaced ? 'reverted' : receipt.status }
      }}
      explorerUrl={(hash) => explorerTxUrl(chain.id, hash)}
      decodeError={(error) =>
        decodeTxError(error, NAMES.gas.errors, NAMES.gas.unknown)
      }
      insufficientGasPanel={<InsufficientGasPanel />}
    />
  )
}

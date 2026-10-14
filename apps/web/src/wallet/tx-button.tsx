'use client'

import { useRef } from 'react'
import { useConfig } from 'wagmi'
import {
  ConnectorChainMismatchError,
  getAccount,
  getWalletClient,
} from '@wagmi/core'
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

class WrongNetworkError extends Error {}

export type TransactionButtonProps = Pick<
  ButtonProps,
  'disabled' | 'className' | 'variant'
> & {
  request: GuardedTxRequest
  label?: string
  onReceipt?: (hash: Hash, status: 'success' | 'reverted') => Promise<void>
  onBusyChange?: (busy: boolean) => void
  onSubmitted?: (hash: Hash) => void
  expectedAccount?: Address
}

export function TransactionButton({
  request,
  label,
  onReceipt,
  onSubmitted,
  expectedAccount,
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
        if (
          expectedAccount &&
          wallet.address?.toLowerCase() !== expectedAccount.toLowerCase()
        ) {
          return { ok: false, reason: 'unknown' }
        }
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
        if (current.chainId !== chain.id) {
          throw new WrongNetworkError()
        }
        if (current.address !== address) {
          throw new Error(NAMES.gas.unknown)
        }
        const hash = await wallet.sendTransaction({
          ...request,
          account: address,
          chain,
        })
        onSubmitted?.(hash)
        return hash
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
        if (!replaced) {
          await onReceipt?.(receipt.transactionHash, receipt.status)
        }
        return { ...receipt, status: replaced ? 'reverted' : receipt.status }
      }}
      explorerUrl={(hash) => explorerTxUrl(chain.id, hash)}
      decodeError={(error) =>
        error instanceof WrongNetworkError ||
        error instanceof ConnectorChainMismatchError
          ? NAMES.gas.wrong_network
          : decodeTxError(error, NAMES.gas.errors, NAMES.gas.unknown)
      }
      insufficientGasPanel={<InsufficientGasPanel />}
    />
  )
}

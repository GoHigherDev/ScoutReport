'use client'

import { useState } from 'react'
import { useConnection, useDisconnect, useConnectorClient } from 'wagmi'
import { createWalletClient, custom } from 'viem'
import { Badge, Banner, Button, Skeleton } from '@scoutreport/ui'
import {
  ChainSwitchRejectedError,
  chiliz,
  ensureChain,
  getAppChain,
  spicy,
} from '@scoutreport/chain'
import { NAMES } from '../copy/names'
import { useWalletModal } from './providers'
import { useHoldings } from './hooks'
import { SignInButton } from './sign-in-button'

export function NetworkBadge() {
  const { chainId, isConnected } = useConnection()
  const id = isConnected ? chainId : getAppChain().id
  return (
    <Badge
      variant={
        id === spicy.id ? 'warning' : id === chiliz.id ? 'accent' : 'danger'
      }
    >
      {id === spicy.id
        ? NAMES.wallet.spicy
        : id === chiliz.id
          ? NAMES.wallet.mainnet
          : NAMES.wallet.unsupportedNetwork}
    </Badge>
  )
}

export function WalletButton() {
  const { address, isConnected } = useConnection()
  const { disconnectAsync, isPending } = useDisconnect()
  const { available, openConnect } = useWalletModal()
  const [error, setError] = useState<string>()
  async function act() {
    setError(undefined)
    try {
      if (isConnected) await disconnectAsync()
      else await openConnect()
    } catch {
      setError(
        isConnected
          ? NAMES.wallet.disconnectError
          : NAMES.wallet.connectionError,
      )
    }
  }
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <NetworkBadge />
        {isConnected && address && (
          <span title={address}>
            {address.slice(0, 6)}…{address.slice(-4)}
          </span>
        )}
        <Button
          type="button"
          disabled={isPending || (!isConnected && !available)}
          aria-disabled={isPending || (!isConnected && !available)}
          onClick={() => void act()}
        >
          {isConnected ? NAMES.wallet.disconnect : NAMES.connectWallet}
        </Button>
      </div>
      {isConnected && address && <SignInButton key={address} />}
      {!available && !isConnected && (
        <p className="mt-2 max-w-xs text-xs text-sr-muted">
          {NAMES.wallet.unavailable}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-sr-danger">
          {error}
        </p>
      )}
    </div>
  )
}

export function WrongNetworkBanner() {
  const { chainId, isConnected } = useConnection()
  // Connector client remains available even when the current chain is unsupported.
  const { data: client } = useConnectorClient({ chainId })
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string>()
  const appChain = getAppChain()
  if (!isConnected || chainId === appChain.id) return null
  async function switchNetwork() {
    if (!client) return
    setPending(true)
    setError(undefined)
    try {
      await ensureChain(
        createWalletClient({ transport: custom(client) }),
        appChain.id,
      )
    } catch (cause) {
      setError(
        cause instanceof ChainSwitchRejectedError
          ? NAMES.wallet.switchRejected
          : NAMES.wallet.switchError,
      )
    } finally {
      setPending(false)
    }
  }
  return (
    <Banner variant="warning">
      <p>{NAMES.wallet.wrongNetwork}</p>
      <Button
        type="button"
        disabled={pending || !client}
        onClick={() => void switchNetwork()}
      >
        {pending
          ? NAMES.wallet.switching
          : appChain.id === spicy.id
            ? NAMES.wallet.switchSpicy
            : NAMES.wallet.switchMainnet}
      </Button>
      {error && <p role="alert">{error}</p>}
    </Banner>
  )
}

export function HoldingsStrip() {
  const { isConnected } = useConnection()
  const holdings = useHoldings()
  if (!isConnected) return null
  return (
    <section
      aria-label={NAMES.wallet.holdings}
      className="border-b border-sr-border px-4 py-4"
    >
      <h2 className="mb-2 font-semibold">{NAMES.wallet.holdings}</h2>
      {holdings.isPending ? (
        <div role="status" aria-label={NAMES.wallet.loading}>
          <span className="sr-only">{NAMES.wallet.loading}</span>
          <Skeleton className="h-20 w-full" />
        </div>
      ) : holdings.isError ? (
        <div role="alert">
          <p>{NAMES.wallet.rpcError}</p>
          <Button type="button" onClick={() => void holdings.refetch()}>
            {NAMES.wallet.retry}
          </Button>
        </div>
      ) : holdings.data?.length === 0 ? (
        <p role="status">{NAMES.wallet.empty}</p>
      ) : (
        <ul className="flex gap-4 overflow-x-auto">
          {holdings.data?.map((token) => (
            <li
              key={token.key}
              className="min-w-48 rounded-lg border border-sr-border bg-sr-surface p-3"
            >
              <h3 className="font-semibold">{token.symbol}</h3>
              {token.status === 'failure' ? (
                <p className="text-sm">{NAMES.optimiserCopy.unavailable}</p>
              ) : (
                <dl className="text-sm">
                  <dt>{NAMES.wallet.held}</dt>
                  <dd>{token.formatted.held}</dd>
                  <dt>{NAMES.wallet.staked}</dt>
                  <dd>{token.formatted.staked}</dd>
                  <dt>{NAMES.scoreLabel}</dt>
                  <dd>{token.formatted.totalScoutRating}</dd>
                </dl>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-xs text-sr-muted">{NAMES.wallet.stakingCaveat}</p>
    </section>
  )
}

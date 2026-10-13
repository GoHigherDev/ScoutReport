'use client'

import { useEffect, useState } from 'react'
import { useConnection } from 'wagmi'
import { Badge, Banner, Button, Skeleton } from '@scoutreport/ui'
import { NAMES } from '../copy/names'
import { useOptimiserPortfolio } from './hooks'

const releaseDate = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/London',
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
})

function OptimiserCaveats() {
  return (
    <Banner variant="warning">
      <ul className="space-y-2 text-sm">
        {NAMES.optimiserCopy.caveats.map((caveat) => (
          <li key={caveat}>{caveat}</li>
        ))}
      </ul>
    </Banner>
  )
}

export function OptimiserPortfolio() {
  const { address, isConnected } = useConnection()
  const portfolio = useOptimiserPortfolio(isConnected ? address : undefined)
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    if (!isConnected) return
    const releases =
      portfolio.data?.flatMap((token) =>
        token.status === 'success' &&
        token.pendingAmount > 0n &&
        token.releaseAt != null
          ? [Number(token.releaseAt) * 1000]
          : [],
      ) ?? []
    const future = releases.filter((release) => release > now)
    if (future.length === 0) return
    const timer = setTimeout(
      () => setNow(Date.now()),
      Math.min(Math.max(0, Math.min(...future) - Date.now()), 2147483647),
    )
    return () => clearTimeout(timer)
  }, [isConnected, portfolio.data, now])
  const copy = NAMES.optimiserCopy
  const headers = [
    copy.token,
    NAMES.wallet.held,
    NAMES.wallet.staked,
    copy.unstaked,
    NAMES.scoreLabel,
    copy.actionHint,
  ]
  return (
    <section aria-label={NAMES.optimiser} className="space-y-4">
      <Badge>{copy.dataNetwork}</Badge>
      <OptimiserCaveats />
      {!isConnected ? (
        <p role="status">{copy.connect}</p>
      ) : portfolio.isPending ? (
        <div role="status" aria-label={NAMES.wallet.loading}>
          <span className="sr-only">{NAMES.wallet.loading}</span>
          <Skeleton className="h-20 w-full" />
        </div>
      ) : portfolio.isError ? (
        <div role="alert">
          <p>{NAMES.wallet.rpcError}</p>
          <Button type="button" onClick={() => void portfolio.refetch()}>
            {NAMES.wallet.retry}
          </Button>
        </div>
      ) : portfolio.data?.length === 0 ? (
        <p role="status">{NAMES.wallet.empty}</p>
      ) : (
        <>
          <p className="text-sm text-sr-muted">
            {copy.captureBlock}: {portfolio.data?.[0].blockNumber.toString()}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">{NAMES.optimiser}</caption>
              <thead>
                <tr>
                  {headers.map((header) => (
                    <th key={header} scope="col" className="px-3 py-2">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {portfolio.data?.map((token) => {
                  const flagged =
                    token.status === 'success' &&
                    token.held > 0n &&
                    token.staked === 0n
                  const cells =
                    token.status === 'failure'
                      ? Array<string>(5).fill(copy.unavailable)
                      : [
                          token.formatted.held,
                          token.formatted.staked,
                          token.formatted.unstaked,
                          token.formatted.totalScoutRating,
                          flagged ? copy.notStaked : copy.noAction,
                        ]
                  return (
                    <tr
                      key={token.key}
                      className={`border-t border-sr-border ${flagged ? 'bg-sr-surface' : ''}`}
                    >
                      <th scope="row" className="px-3 py-3">
                        {token.symbol}
                        {token.status === 'success' && (
                          <div className="mt-2 space-y-2 text-xs font-normal">
                            <p className="text-sr-muted">
                              {copy.defaultUnstakePeriod}:{' '}
                              {token.unstakePeriodSeconds?.toString() ??
                                copy.unavailable}
                              {' · '}
                              {copy.tokenPeriodUnknown}
                            </p>
                            {token.pendingAmount > 0n && (
                              <span className="inline-block rounded-full border border-sr-secondary bg-sr-secondary px-3 py-1 text-sr-text">
                                {token.releaseAt != null &&
                                Number(token.releaseAt) * 1000 <=
                                  Math.max(now, Date.now())
                                  ? copy.readyToClaim
                                  : copy.coolingDown}
                                : {token.formatted.pendingAmount} {token.symbol}
                                {' · '}
                                {token.releaseAt != null
                                  ? `${copy.availableFrom} ${releaseDate.format(new Date(Number(token.releaseAt) * 1000))} ${copy.ukTime}`
                                  : copy.releaseUnavailable}
                                {(token.pendingOperationCount ?? 0) > 1 &&
                                  ` · ${token.pendingOperationCount} ${copy.pendingUnstakes}`}
                              </span>
                            )}
                          </div>
                        )}
                      </th>
                      {cells.map((cell, index) => (
                        <td
                          key={index}
                          className={`px-3 py-3 ${flagged && index === 4 ? 'font-semibold text-sr-warning' : ''}`}
                        >
                          {cell}
                        </td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  )
}

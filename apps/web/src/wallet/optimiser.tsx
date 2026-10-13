'use client'

import { useEffect, useState } from 'react'
import { useConnection } from 'wagmi'
import { Badge, Banner, Button, RpCaveat, Skeleton } from '@scoutreport/ui'
import {
  NAMES,
  OPTIMISER_EARN_ROUTES,
  OPTIMISER_SOURCE_LINKS,
} from '../copy/names'
import { useOptimiserPortfolio, useWalletKind } from './hooks'
import type { PortfolioRow } from './hooks'
import { RpEstimatePanel } from './rp-estimate'

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

export function OptimiserRpCaveat() {
  const { kind, isPending, isError } = useWalletKind()
  const copy = NAMES.optimiserCopy.rpCaveat
  return (
    <RpCaveat
      caveat={copy.externalWalletCaveat}
      sociosWalletLine={copy.sociosWalletLine}
      walletTypeNote={
        kind === undefined || isPending || isError ? undefined : copy[kind]
      }
      links={OPTIMISER_SOURCE_LINKS}
    />
  )
}

function OptimiserCaveats() {
  return (
    <Banner variant="warning">
      <ul className="space-y-2 text-sm">
        {NAMES.optimiserCopy.caveats
          .filter(
            (caveat) =>
              caveat !== NAMES.optimiserCopy.rpCaveat.externalWalletCaveat,
          )
          .map((caveat) => (
            <li key={caveat}>{caveat}</li>
          ))}
      </ul>
    </Banner>
  )
}

export function OptimiserEarnRoutes() {
  const copy = NAMES.optimiserCopy.earnRoutes
  return (
    <section aria-labelledby="optimiser-earn-routes" className="space-y-4">
      <h2 id="optimiser-earn-routes" className="text-xl font-semibold">
        {copy.heading}
      </h2>
      <p className="text-sm text-sr-muted">{copy.description}</p>
      <ul className="space-y-4">
        {OPTIMISER_EARN_ROUTES.map((route) => (
          <li
            key={route.id}
            className="space-y-2 rounded border border-sr-border p-4"
          >
            <h3 className="font-semibold">{route.name}</h3>
            <Badge>{copy[route.status]}</Badge>
            {route.status === 'confirmed' && (
              <p className="text-sm">{route.howTo}</p>
            )}
            <a
              href={route.source.href}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-sm underline"
            >
              {route.source.label}
            </a>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function stakingCoverage(rows: readonly PortfolioRow[]) {
  if (rows.some((row) => row.status === 'failure')) return undefined
  const holdings = rows.filter(
    (row) =>
      row.status === 'success' &&
      row.held + row.staked >= 10n ** BigInt(row.decimals),
  )
  return {
    m: holdings.length,
    n: holdings.filter(
      (row) =>
        row.status === 'success' && row.staked >= 10n ** BigInt(row.decimals),
    ).length,
  }
}

export function OptimiserDashboard({
  rows,
}: {
  rows: readonly PortfolioRow[]
}) {
  const copy = NAMES.optimiserCopy.dashboard
  const coverage = stakingCoverage(rows)
  const liquidOnly = rows.filter(
    (row) =>
      row.status === 'success' &&
      row.held >= 10n ** BigInt(row.decimals) &&
      row.staked === 0n,
  )
  const nextMidnight = new Date(
    (Math.floor(Date.now() / 86400_000) + 1) * 86400_000,
  )
  const ukTime = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(nextMidnight)
  return (
    <section aria-labelledby="staking-coverage-title" className="space-y-3">
      <h2 id="staking-coverage-title" className="text-xl font-semibold">
        {copy.heading}
      </h2>
      <p>
        {coverage
          ? copy.coverage
              .replace('{n}', String(coverage.n))
              .replace('{m}', String(coverage.m))
          : copy.incomplete}
      </p>
      {coverage && coverage.m > 0 && coverage.n === coverage.m && (
        <p>{copy.allStaked}</p>
      )}
      <h3 className="font-semibold">{copy.actions}</h3>
      <p>{copy.noPolls}</p>
      <ol className="space-y-2">
        {liquidOnly.map((row) => (
          <li key={row.key}>{copy.unstaked.replace('{token}', row.symbol)}</li>
        ))}
        <li>{copy.watchPrompt}</li>
      </ol>
      <a href="#fan-token-checklist" className="underline">
        {copy.checklist}
      </a>
      <p className="text-sm">{copy.creditTime.replace('{time}', ukTime)}</p>
    </section>
  )
}

export function OptimiserPortfolio({
  rpEstimateEnabled = false,
}: {
  rpEstimateEnabled?: boolean
}) {
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
      {!(isConnected && address && rpEstimateEnabled) && <OptimiserCaveats />}
      {isConnected && !portfolio.isPending && !portfolio.isError && (
        <OptimiserDashboard rows={portfolio.data ?? []} />
      )}
      {isConnected && address && rpEstimateEnabled && (
        <RpEstimatePanel
          rows={isConnected ? (portfolio.data ?? []) : []}
          unavailable={portfolio.isPending || portfolio.isError}
        />
      )}
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
          <div id="fan-token-checklist" className="overflow-x-auto">
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
                    token.held >= 10n ** BigInt(token.decimals) &&
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

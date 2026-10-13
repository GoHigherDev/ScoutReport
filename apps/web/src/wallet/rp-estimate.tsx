'use client'

import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FAN_TOKENS, chiliz, getTokenAddress } from '@scoutreport/chain'
import { useConnection } from 'wagmi'
import type { Address } from 'viem'
import { NAMES } from '../copy/names'
import type { PortfolioRow } from './hooks'
import {
  estimateRp,
  RP_CALIBRATIONS,
  RP_POLICY,
  totalRp,
  usableCalibration,
  type RpCalibration,
  type RpField,
  type RpResult,
} from './rp-model'
import { getRpSnapshotReader } from './rp-snapshot'

const declarationKey = (address: string) =>
  `scoutreport:rp-declaration:${address.toLowerCase()}`

export function useSociosDeclaration(address?: Address) {
  const [stored, setStored] = useState<{ address: string; declared: boolean }>()
  useEffect(() => {
    if (!address) {
      setStored(undefined)
      return
    }
    let declared = false
    try {
      declared = localStorage.getItem(declarationKey(address)) === 'true'
    } catch {
      /* Storage may be disabled. */
    }
    setStored({ address: address.toLowerCase(), declared })
  }, [address])
  const declared = Boolean(
    address && stored?.address === address.toLowerCase() && stored.declared,
  )
  return {
    declared,
    setDeclared(value: boolean) {
      if (!address) return
      try {
        localStorage.setItem(declarationKey(address), String(value))
      } catch {
        /* Keep an in-memory choice if storage is disabled. */
      }
      setStored({ address: address.toLowerCase(), declared: value })
    },
  }
}

export async function readRpEstimates(
  address: Address,
  rows: readonly PortfolioRow[],
  calibrations: readonly RpCalibration[],
  now: number,
): Promise<RpResult[]> {
  return Promise.all(
    rows.map(async (row): Promise<RpResult> => {
      if (row.status === 'failure') return { state: 'unavailable' }
      const calibration = calibrations.find((item) => item.tokenKey === row.key)
      const input = {
        enabled: true,
        eligibility: 'declared-socios' as const,
        tokenKey: row.key,
        held: row.held,
        staked: row.staked,
        decimals: row.decimals,
        calibration,
        now,
      }
      const initial = estimateRp(input)
      if (
        initial.state !== 'unavailable' ||
        !calibration ||
        !usableCalibration(calibration, now)
      )
        return initial
      const config = FAN_TOKENS.find((token) => token.key === row.key)
      const token = config && getTokenAddress(config, chiliz.id)
      if (!token) return { state: 'unavailable' }
      try {
        const snapshot = await getRpSnapshotReader().read(
          address,
          token,
          calibration,
          now,
        )
        return estimateRp({ ...input, snapshot })
      } catch {
        return { state: 'unavailable' }
      }
    }),
  )
}

const copy = NAMES.optimiserCopy.rpEstimate
export function rpRange(value: RpField) {
  return copy.range
    .replace('{low}', String(value.low))
    .replace('{high}', String(value.high))
    .replace('{central}', String(value.central))
}

function Result({ result }: { result: RpResult }) {
  if (result.state !== 'estimate') {
    return <p>{copy[result.state]}</p>
  }
  return (
    <div className="space-y-2">
      {!result.eligible && <p>{copy.ineligible}</p>}
      <p>
        {copy.perToken}: {rpRange(result.perToken)}
      </p>
      <p>
        {copy.total}: {rpRange(result.total)}
      </p>
      {result.widened && <p>{copy.widened}</p>}
      {result.calibration && (
        <p>
          {copy.footnote
            .replace('{n}', String(result.calibration.reports))
            .replace(
              '{date}',
              new Intl.DateTimeFormat('en-GB', {
                timeZone: 'UTC',
                dateStyle: 'medium',
              }).format(new Date(result.calibration.calibratedAt)),
            )}
        </p>
      )}
    </div>
  )
}

export function RpEstimatePanel({
  rows,
  unavailable = false,
}: {
  rows: readonly PortfolioRow[]
  unavailable?: boolean
}) {
  const { address, isConnected } = useConnection()
  const owner = isConnected ? address : undefined
  const { declared, setDeclared } = useSociosDeclaration(owner)
  const [clock, setClock] = useState(Date.now)
  const now = Math.max(clock, Date.now())
  const current = rows.filter(
    (row) => row.status === 'failure' || row.held + row.staked > 0n,
  )
  const query = useQuery({
    queryKey: [
      'rp-estimate',
      owner,
      rows.map((row) =>
        row.status === 'failure'
          ? [row.key, row.status]
          : [
              row.key,
              row.blockNumber.toString(),
              row.held.toString(),
              row.staked.toString(),
              row.decimals,
            ],
      ),
      RP_CALIBRATIONS.map((calibration) => [
        calibration.tokenKey,
        calibration.calibratedAt,
        calibration.driftAlert,
      ]),
    ],
    queryFn: () => readRpEstimates(owner!, current, RP_CALIBRATIONS, now),
    enabled: Boolean(
      owner &&
      declared &&
      !unavailable &&
      RP_CALIBRATIONS.some((calibration) =>
        usableCalibration(calibration, now),
      ),
    ),
    staleTime: Infinity,
    gcTime: 0,
    retry: false,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
  useEffect(() => {
    if (
      !owner ||
      !declared ||
      !query.data?.some(
        (result) => result.state === 'estimate' && result.eligible,
      )
    )
      return
    const currentTime = Date.now()
    const staleBoundaries = RP_CALIBRATIONS.map(
      (calibration) =>
        Date.parse(calibration.calibratedAt) + RP_POLICY.staleAfterMs,
    ).filter((boundary) => boundary > currentTime)
    const readBoundaries = query.data
      .flatMap((result) =>
        result.state === 'estimate' && result.snapshot
          ? [result.snapshot.readAt + RP_POLICY.staleAfterMs]
          : [],
      )
      .filter((boundary) => boundary > currentTime)
    const next = Math.min(
      (Math.floor(currentTime / 86400_000) + 1) * 86400_000,
      ...staleBoundaries,
      ...readBoundaries,
    )
    // Update presentation only: midnight hides an old snapshot, never polls RPC.
    const timer = setTimeout(() => setClock(Date.now()), next - currentTime)
    return () => clearTimeout(timer)
  }, [owner, declared, query.data, clock])
  // Gating the data as well as the query prevents cached figures leaking on disconnect/undeclare.
  const results =
    owner && declared && !unavailable && !query.isError
      ? query.data?.map((result, index) => {
          const row = current[index]
          if (
            !row ||
            row.status === 'failure' ||
            result.state !== 'estimate' ||
            !result.eligible
          )
            return result
          return estimateRp({
            enabled: true,
            eligibility: 'declared-socios',
            tokenKey: row.key,
            held: row.held,
            staked: row.staked,
            decimals: row.decimals,
            calibration: result.calibration,
            snapshot: result.snapshot,
            now,
          })
        })
      : undefined
  const total = results && totalRp(results)
  if (!owner) return null
  return (
    <section
      aria-labelledby="rp-estimate-title"
      className="space-y-4 rounded border border-sr-border p-4"
    >
      <h2 id="rp-estimate-title" className="text-xl font-semibold">
        {copy.title}
      </h2>
      <p>{copy.subtitle}</p>
      <p>{copy.disclaimer}</p>
      <ul className="space-y-2 text-sm">
        {NAMES.optimiserCopy.caveats.map((caveat) => (
          <li key={caveat}>{caveat}</li>
        ))}
      </ul>
      {owner ? (
        <>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={declared}
              onChange={(event) => setDeclared(event.target.checked)}
            />
            {copy.declaration}
          </label>
          <p className="text-sm">{copy.localOnly}</p>
          {!declared ? (
            <p>{copy.undeclared}</p>
          ) : unavailable ? (
            <p>{copy.unavailable}</p>
          ) : !current.length ? (
            <p>{NAMES.wallet.empty}</p>
          ) : (
            <>
              <p>{copy.basis}</p>
              <ul className="space-y-4">
                {current.map((row, index) => (
                  <li key={row.key}>
                    <h3 className="font-semibold">{row.symbol}</h3>
                    <Result
                      result={
                        results?.[index] ??
                        (row.status === 'failure'
                          ? { state: 'unavailable' }
                          : estimateRp({
                              enabled: true,
                              eligibility: 'declared-socios',
                              tokenKey: row.key,
                              held: row.held,
                              staked: row.staked,
                              decimals: row.decimals,
                              calibration: RP_CALIBRATIONS.find(
                                (item) => item.tokenKey === row.key,
                              ),
                              now,
                            }))
                      }
                    />
                  </li>
                ))}
              </ul>
              {total ? (
                <p>
                  {copy.total}: {rpRange(total)}
                </p>
              ) : (
                <p>{copy.totalUnavailable}</p>
              )}
              {RP_CALIBRATIONS.some((calibration) =>
                usableCalibration(calibration, now),
              ) && (
                <button
                  type="button"
                  className="underline"
                  disabled={query.isFetching}
                  onClick={() => void query.refetch()}
                >
                  {copy.refresh}
                </button>
              )}
            </>
          )}
        </>
      ) : (
        <p>{NAMES.optimiserCopy.connect}</p>
      )}
    </section>
  )
}

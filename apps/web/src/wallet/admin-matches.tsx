'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useAccount } from 'wagmi'
import { useQuery } from '@tanstack/react-query'
import {
  decodeTxError,
  FAN_TOKENS,
  getPredictionsAddress,
  getPublicClient,
  SCOUTREPORT_ABIS,
} from '@scoutreport/chain'
import { Button } from '@scoutreport/ui'
import { encodeFunctionData, type Address, type Hash, type Hex } from 'viem'
import { NAMES } from '../copy/names'
import { matchInputSchema, type AdminMatch } from '../lib/admin-matches'
import { TransactionButton } from './tx-button'

type Action = 'createMatch' | 'settle' | 'voidMatch' | 'creditPoints'
type MatchState = {
  status: number
  result: number
  predictorCount: number
  creditedCursor: number
}
type Audit = { matchId: string; action: Action; txHash: Hash }
const fieldClass =
  'block w-full rounded-md border border-sr-border bg-sr-surface p-2 text-sr-text'

async function api<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(path, {
    method: body ? 'POST' : 'GET',
    credentials: 'same-origin',
    cache: 'no-store',
    ...(body
      ? {
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      : {}),
  })
  if (!response.ok) throw new Error(NAMES.admin.error)
  return response.json()
}

export function AdminMatches({ actorAddress }: { actorAddress: string }) {
  const address = getPredictionsAddress()
  const list = useQuery({
    queryKey: ['admin-matches', actorAddress],
    queryFn: () => api<{ matches: AdminMatch[] }>('/api/admin/matches'),
    retry: false,
    refetchOnWindowFocus: false,
  })
  return (
    <div className="space-y-6">
      {!address && <p role="status">{NAMES.admin.unavailable}</p>}
      <NewMatch onSaved={() => list.refetch()} />
      <Button
        variant="secondary"
        disabled={list.isFetching}
        onClick={() => void list.refetch()}
      >
        {NAMES.admin.refresh}
      </Button>
      {list.isPending && <p role="status">{NAMES.admin.loading}</p>}
      {list.isError && <p role="alert">{NAMES.admin.error}</p>}
      {list.data?.matches.length === 0 && <p>{NAMES.admin.empty}</p>}
      {list.data?.matches.map((match) => (
        <MatchCard
          key={match.id}
          match={match}
          address={address}
          actorAddress={actorAddress}
          authorised={!list.isError && !list.isFetching}
          refreshVersion={list.dataUpdatedAt}
        />
      ))}
    </div>
  )
}

function NewMatch({ onSaved }: { onSaved: () => Promise<unknown> }) {
  const [sport, setSport] = useState<'football' | 'cs2'>('football')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string>()
  const [error, setError] = useState<string>()
  const running = useRef(false)

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (running.current) return
    const form = event.currentTarget
    const data = new FormData(form)
    const parsed = matchInputSchema.safeParse({
      sport,
      sides: [1, 2].map((side) => ({
        name: data.get(`side${side}`),
        tokenKey: data.get(`token${side}`) || null,
      })),
      kickoff: data.get('kickoff'),
      lockTime: data.get('lockTime') || undefined,
      outcomes: String(data.get('outcomes') ?? '')
        .split('\n')
        .map((value) => value.trim()),
      pointsForCorrect: Number(data.get('points')),
    })
    setMessage(undefined)
    setError(undefined)
    if (!parsed.success) {
      setError(NAMES.admin.invalidInput)
      return
    }
    running.current = true
    setSaving(true)
    try {
      await api('/api/admin/matches', parsed.data)
      form.reset()
      setSport('football')
      setMessage(NAMES.admin.saved)
      await onSaved()
    } catch {
      setError(NAMES.admin.error)
    } finally {
      running.current = false
      setSaving(false)
    }
  }

  return (
    <section className="space-y-4 rounded-md border border-sr-border p-4">
      <h2 className="text-xl font-bold">{NAMES.admin.newMatch}</h2>
      <form className="space-y-4" onSubmit={(event) => void save(event)}>
        <fieldset disabled={saving} className="space-y-4">
          <label className="block">
            {NAMES.admin.sport}
            <select
              className={fieldClass}
              value={sport}
              onChange={(event) =>
                setSport(event.target.value as 'football' | 'cs2')
              }
            >
              <option value="football">{NAMES.admin.football}</option>
              <option value="cs2">{NAMES.admin.cs2}</option>
            </select>
          </label>
          {[1, 2].map((side) => (
            <div key={side} className="grid gap-4 sm:grid-cols-2">
              <label>
                {side === 1 ? NAMES.admin.sideOne : NAMES.admin.sideTwo}
                <input
                  className={fieldClass}
                  name={`side${side}`}
                  required
                  maxLength={120}
                />
              </label>
              <label>
                {NAMES.admin.tokenKey}
                <select
                  key={`${sport}-${side}`}
                  className={fieldClass}
                  name={`token${side}`}
                >
                  <option value="">{NAMES.admin.noToken}</option>
                  {FAN_TOKENS.filter(
                    (token) =>
                      token.sport ===
                      (sport === 'football' ? 'football' : 'esports'),
                  ).map((token) => (
                    <option key={token.key} value={token.key}>
                      {token.key}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ))}
          <label className="block">
            {NAMES.admin.kickoff}
            <input
              className={fieldClass}
              name="kickoff"
              type="datetime-local"
              required
              aria-describedby="admin-time-help"
            />
          </label>
          <label className="block">
            {NAMES.admin.lockTime}
            <input
              className={fieldClass}
              name="lockTime"
              type="datetime-local"
              aria-describedby="admin-time-help"
            />
          </label>
          <p id="admin-time-help" className="text-sm text-sr-muted">
            {NAMES.admin.timeHelp}
          </p>
          <label className="block">
            {NAMES.admin.outcomes}
            <textarea
              className={fieldClass}
              name="outcomes"
              rows={3}
              required
              maxLength={362}
            />
          </label>
          <label className="block">
            {NAMES.admin.points}
            <input
              className={fieldClass}
              name="points"
              type="number"
              min={1}
              max={100}
              step={1}
              required
            />
          </label>
          <Button type="submit">{NAMES.admin.save}</Button>
        </fieldset>
        {message && <p role="status">{message}</p>}
        {error && <p role="alert">{error}</p>}
      </form>
    </section>
  )
}

function MatchCard({
  match,
  address,
  actorAddress,
  authorised,
  refreshVersion,
}: {
  match: AdminMatch
  address?: Address
  actorAddress: string
  authorised: boolean
  refreshVersion: number
}) {
  const wallet = useAccount()
  const [result, setResult] = useState(0)
  const [action, setAction] = useState<Action>()
  const [pendingAudit, setPendingAudit] = useState<Audit>()
  const [auditError, setAuditError] = useState(false)
  const [recording, setRecording] = useState(false)
  const [transacting, setTransacting] = useState(false)
  const [recoveryAction, setRecoveryAction] = useState<Action>('createMatch')
  const [recoveryHash, setRecoveryHash] = useState('')
  const dialog = useRef<HTMLDialogElement>(null)
  const state = useQuery({
    queryKey: ['admin-match', match.matchId, address, refreshVersion],
    enabled: Boolean(address) && authorised,
    queryFn: async (): Promise<MatchState | null> => {
      try {
        return (await getPublicClient(88882).readContract({
          address: address!,
          abi: SCOUTREPORT_ABIS[0],
          functionName: 'getMatch',
          args: [match.matchId as Hex],
        })) as MatchState
      } catch (error) {
        if (
          decodeTxError(
            error,
            { UnknownMatch: NAMES.admin.draft },
            NAMES.admin.error,
          ) === NAMES.admin.draft
        )
          return null
        throw error
      }
    },
    retry: false,
    refetchOnWindowFocus: false,
  })
  const walletMatches =
    wallet.address?.toLowerCase() === actorAddress.toLowerCase() &&
    wallet.chainId === 88882
  const ready =
    Boolean(address) &&
    authorised &&
    walletMatches &&
    state.isSuccess &&
    !state.isFetching &&
    !pendingAudit &&
    !recording &&
    !transacting
  const chainState = state.data
  const remaining = chainState
    ? chainState.predictorCount - chainState.creditedCursor
    : 0
  const title = match.sides.map((side) => side.name).join(' / ')
  const actionLabels = {
    createMatch: NAMES.admin.create,
    settle: NAMES.admin.settle,
    voidMatch: NAMES.admin.void,
    creditPoints: NAMES.admin.credit,
  }

  useEffect(() => {
    if (action) dialog.current?.showModal()
  }, [action])

  async function record(audit: Audit) {
    setRecording(true)
    setAuditError(false)
    try {
      await api('/api/admin/matches/audit', audit)
      setPendingAudit(undefined)
      setAction(undefined)
      dialog.current?.close()
      const refreshed = await state.refetch()
      if (
        (audit.action === 'settle' || audit.action === 'creditPoints') &&
        refreshed.data?.status === 2 &&
        refreshed.data.creditedCursor < refreshed.data.predictorCount
      ) {
        setAction('creditPoints')
      }
    } catch {
      setPendingAudit(audit)
      setAuditError(true)
    } finally {
      setRecording(false)
    }
  }

  function requestFor(selected: Action) {
    const args =
      selected === 'createMatch'
        ? [
            match.matchId,
            BigInt(Math.floor(new Date(match.lockTime).getTime() / 1000)),
            match.outcomes.length,
            match.pointsForCorrect,
          ]
        : selected === 'settle'
          ? [match.matchId, result]
          : selected === 'creditPoints'
            ? [match.matchId, BigInt(Math.min(50, remaining))]
            : [match.matchId]
    return {
      to: address!,
      data: encodeFunctionData({
        abi: SCOUTREPORT_ABIS[0],
        functionName: selected,
        args,
      }),
    }
  }

  return (
    <section className="space-y-3 rounded-md border border-sr-border p-4">
      <h2 className="text-xl font-bold">{title}</h2>
      <p className="break-all text-sm text-sr-muted">{match.matchId}</p>
      <p>
        {NAMES.admin.kickoffUtc}: {match.kickoff}
      </p>
      <p>
        {NAMES.admin.lockedUntil}: {match.lockTime}
      </p>
      {address && state.isPending && <p role="status">{NAMES.admin.loading}</p>}
      {state.isError && <p role="alert">{NAMES.admin.error}</p>}
      {!walletMatches && <p>{NAMES.admin.walletMismatch}</p>}
      {state.isSuccess && (
        <p role="status">
          {!chainState
            ? NAMES.admin.draft
            : chainState.status === 1
              ? NAMES.admin.open
              : chainState.status === 2
                ? `${NAMES.admin.settled}: ${match.outcomes[chainState.result]}`
                : NAMES.admin.voided}
        </p>
      )}
      <label className="block">
        {NAMES.admin.result}
        <select
          className={fieldClass}
          value={result}
          disabled={Boolean(action)}
          onChange={(event) => setResult(Number(event.target.value))}
        >
          {match.outcomes.map((outcome, index) => (
            <option key={outcome} value={index}>
              {outcome}
            </option>
          ))}
        </select>
      </label>
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={
            !ready ||
            chainState !== null ||
            new Date(match.lockTime).getTime() <= Date.now()
          }
          onClick={() => setAction('createMatch')}
        >
          {NAMES.admin.create}
        </Button>
        <Button
          disabled={
            !ready ||
            chainState?.status !== 1 ||
            new Date(match.lockTime).getTime() > Date.now()
          }
          onClick={() => setAction('settle')}
        >
          {NAMES.admin.settle}
        </Button>
        <Button
          variant="secondary"
          disabled={!ready || chainState?.status !== 1}
          onClick={() => setAction('voidMatch')}
        >
          {NAMES.admin.void}
        </Button>
        <Button
          disabled={!ready || chainState?.status !== 2 || remaining <= 0}
          onClick={() => setAction('creditPoints')}
        >
          {NAMES.admin.credit}
        </Button>
      </div>
      {chainState?.status === 2 && (
        <p role="status">
          {remaining === 0
            ? NAMES.admin.complete
            : `${NAMES.admin.progress}: ${chainState.creditedCursor} / ${chainState.predictorCount}`}
        </p>
      )}
      <p className="text-sm text-sr-muted">{NAMES.admin.resumeHelp}</p>
      {pendingAudit && (
        <div className="space-y-2">
          {auditError && <p role="alert">{NAMES.admin.auditError}</p>}
          {!auditError && <p role="status">{NAMES.admin.receiptPending}</p>}
          <p className="break-all">{pendingAudit.txHash}</p>
          <Button
            disabled={recording || transacting || !authorised || !walletMatches}
            onClick={() => void record(pendingAudit)}
          >
            {NAMES.admin.retryAudit}
          </Button>
        </div>
      )}
      <details>
        <summary>{NAMES.admin.recoverAudit}</summary>
        <p>{NAMES.admin.recoveryHelp}</p>
        <label className="block">
          {NAMES.admin.action}
          <select
            className={fieldClass}
            value={recoveryAction}
            onChange={(event) =>
              setRecoveryAction(event.target.value as Action)
            }
          >
            {Object.entries(actionLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          {NAMES.admin.recoveryHash}
          <input
            className={fieldClass}
            value={recoveryHash}
            onChange={(event) => setRecoveryHash(event.target.value.trim())}
          />
        </label>
        <Button
          disabled={
            !address ||
            !authorised ||
            !walletMatches ||
            recording ||
            transacting ||
            Boolean(pendingAudit) ||
            !/^0x[0-9a-fA-F]{64}$/.test(recoveryHash)
          }
          onClick={() =>
            void record({
              matchId: match.matchId,
              action: recoveryAction,
              txHash: recoveryHash as Hash,
            })
          }
        >
          {NAMES.admin.recoverAudit}
        </Button>
      </details>
      <dialog
        ref={dialog}
        aria-labelledby={`confirm-${match.id}`}
        className="max-w-lg space-y-4 rounded-md border border-sr-border bg-sr-bg p-6 text-sr-text backdrop:bg-sr-bg/80"
        onCancel={(event) => {
          event.preventDefault()
          if (!transacting && !recording) {
            dialog.current?.close()
            setAction(undefined)
          }
        }}
      >
        <h3 id={`confirm-${match.id}`} className="text-xl font-bold">
          {NAMES.admin.confirmHeading}
        </h3>
        <p>{title}</p>
        <p className="break-all text-sm">{match.matchId}</p>
        {action && <p>{actionLabels[action]}</p>}
        {action === 'settle' && (
          <>
            <p>
              {NAMES.admin.result}: {match.outcomes[result]}
            </p>
            <p>{NAMES.admin.confirmHelp}</p>
          </>
        )}
        {action === 'voidMatch' && <p>{NAMES.admin.voidHelp}</p>}
        {action === 'creditPoints' && <p>{NAMES.admin.creditHelp}</p>}
        {action && address && (
          <TransactionButton
            key={`${action}-${chainState?.creditedCursor ?? 0}`}
            disabled={!ready}
            request={requestFor(action)}
            label={actionLabels[action]}
            expectedAccount={actorAddress as Address}
            onBusyChange={setTransacting}
            onSubmitted={(txHash) => {
              setPendingAudit({ matchId: match.matchId, action, txHash })
              setAuditError(false)
            }}
            onReceipt={async (txHash) => {
              const audit = { matchId: match.matchId, action, txHash }
              setPendingAudit(audit)
              await record(audit)
            }}
          />
        )}
        <Button
          variant="secondary"
          disabled={transacting || recording}
          onClick={() => {
            dialog.current?.close()
            setAction(undefined)
          }}
        >
          {NAMES.admin.cancel}
        </Button>
      </dialog>
    </section>
  )
}

'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FAN_TOKENS } from '@scoutreport/chain'
import { Button } from '@scoutreport/ui'
import { NAMES } from '../copy/names'
import { MAX_POINTS_PER_CORRECT } from '../lib/admin-match-constants'
import { matchInputSchema, type AdminMatch } from '../lib/admin-matches'

const fieldClass =
  'block w-full rounded-md border border-sr-border bg-sr-surface p-2 text-sr-text'

async function api<T>(
  path: string,
  method: 'GET' | 'POST' | 'PATCH' = 'GET',
  body?: unknown,
): Promise<T> {
  const response = await fetch(path, {
    method,
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

export function AdminMatches() {
  const [matchIdInput, setMatchIdInput] = useState('')
  const [lookupId, setLookupId] = useState('')
  const [lookupError, setLookupError] = useState(false)
  const list = useQuery({
    queryKey: ['admin-matches', lookupId],
    queryFn: () =>
      api<{ matches: AdminMatch[] }>(
        `/api/admin/matches${lookupId ? `?id=${encodeURIComponent(lookupId)}` : ''}`,
      ),
    retry: false,
    refetchOnWindowFocus: false,
  })
  return (
    <div className="space-y-6">
      <MatchForm onSaved={() => list.refetch()} />
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault()
          const valid =
            /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
              matchIdInput,
            )
          setLookupError(!valid)
          if (valid) setLookupId(matchIdInput.toLowerCase())
        }}
      >
        <label className="block">
          {NAMES.admin.findMatch}
          <input
            className={fieldClass}
            value={matchIdInput}
            onChange={(event) => setMatchIdInput(event.target.value.trim())}
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={list.isFetching}>
            {NAMES.admin.find}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={list.isFetching}
            onClick={() => {
              setLookupId('')
              setMatchIdInput('')
              setLookupError(false)
            }}
          >
            {NAMES.admin.latest}
          </Button>
        </div>
        {lookupError && <p role="alert">{NAMES.admin.invalidMatchId}</p>}
      </form>
      <Button
        variant="secondary"
        disabled={list.isFetching}
        onClick={() => void list.refetch()}
      >
        {NAMES.admin.refresh}
      </Button>
      {list.isPending && <p role="status">{NAMES.admin.loading}</p>}
      {list.isError && <p role="alert">{NAMES.admin.error}</p>}
      {list.data?.matches.length === 0 && (
        <p>{lookupId ? NAMES.admin.notFound : NAMES.admin.empty}</p>
      )}
      {list.data?.matches.map((match) => (
        <MatchCard
          key={match.id}
          match={match}
          onSaved={() => list.refetch()}
        />
      ))}
    </div>
  )
}

function londonInput(utc: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/London',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(new Date(utc))
      .map(({ type, value }) => [type, value]),
  )
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`
}

function MatchForm({
  match,
  onSaved,
  onCancel,
}: {
  match?: AdminMatch
  onSaved: () => Promise<unknown>
  onCancel?: () => void
}) {
  const [sport, setSport] = useState<'football' | 'cs2'>(
    match?.sport ?? 'football',
  )
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string>()
  const [error, setError] = useState<string>()

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
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
      externalRef: data.get('externalRef') || null,
    })
    setMessage(undefined)
    setError(undefined)
    if (!parsed.success) {
      setError(NAMES.admin.invalidInput)
      return
    }
    setSaving(true)
    try {
      if (match) {
        await api('/api/admin/matches', 'PATCH', {
          action: 'edit',
          id: match.id,
          changes: parsed.data,
        })
      } else {
        await api('/api/admin/matches', 'POST', parsed.data)
      }
      setMessage(NAMES.admin.saved)
      await onSaved()
      if (match) onCancel?.()
      else form.reset()
    } catch {
      setError(NAMES.admin.error)
    } finally {
      setSaving(false)
    }
  }

  const initialSides = match?.sides ?? [
    { name: '', tokenKey: null },
    { name: '', tokenKey: null },
  ]
  return (
    <section className="space-y-4 rounded-md border border-sr-border p-4">
      <h2 className="text-xl font-bold">
        {match ? NAMES.admin.edit : NAMES.admin.newMatch}
      </h2>
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
                  defaultValue={initialSides[side - 1].name}
                />
              </label>
              <label>
                {NAMES.admin.tokenKey}
                <select
                  key={`${sport}-${side}`}
                  className={fieldClass}
                  name={`token${side}`}
                  defaultValue={initialSides[side - 1].tokenKey ?? ''}
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
              defaultValue={match ? londonInput(match.kickoff) : undefined}
              aria-describedby="admin-time-help"
            />
          </label>
          <label className="block">
            {NAMES.admin.lockTime}
            <input
              className={fieldClass}
              name="lockTime"
              type="datetime-local"
              defaultValue={match ? londonInput(match.lockTime) : undefined}
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
              maxLength={602}
              defaultValue={match?.outcomes.join('\n')}
            />
          </label>
          <label className="block">
            {NAMES.admin.points}
            <input
              className={fieldClass}
              name="points"
              type="number"
              min={1}
              max={MAX_POINTS_PER_CORRECT}
              step={1}
              required
              defaultValue={match?.pointsForCorrect}
            />
          </label>
          <label className="block">
            {NAMES.admin.externalRef}
            <input
              className={fieldClass}
              name="externalRef"
              maxLength={500}
              defaultValue={match?.externalRef ?? ''}
            />
          </label>
          <div className="flex gap-2">
            <Button type="submit">
              {match ? NAMES.admin.saveChanges : NAMES.admin.save}
            </Button>
            {match && (
              <Button type="button" variant="secondary" onClick={onCancel}>
                {NAMES.admin.cancel}
              </Button>
            )}
          </div>
        </fieldset>
        {message && <p role="status">{message}</p>}
        {error && <p role="alert">{error}</p>}
      </form>
    </section>
  )
}

function MatchCard({
  match,
  onSaved,
}: {
  match: AdminMatch
  onSaved: () => Promise<unknown>
}) {
  const [action, setAction] = useState<'settle' | 'void' | 'credit'>()
  const [result, setResult] = useState(match.outcomes[0])
  const [reason, setReason] = useState('')
  const [score, setScore] = useState<{
    creditedCount: number
    totalPoints: number
  }>()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(false)
  const dialog = useRef<HTMLDialogElement>(null)
  const title = match.sides.map((side) => side.name).join(' / ')
  const actionLabels = {
    settle: NAMES.admin.settle,
    void: NAMES.admin.void,
    credit: NAMES.admin.credit,
  }

  useEffect(() => {
    if (action) dialog.current?.showModal()
  }, [action])

  async function confirmAction() {
    if (!action || saving) return
    setSaving(true)
    setError(false)
    try {
      const body =
        action === 'settle'
          ? { action, id: match.id, result }
          : action === 'void'
            ? { action, id: match.id, reason }
            : { action, id: match.id }
      const response = await api<{ score?: typeof score }>(
        '/api/admin/matches',
        'PATCH',
        body,
      )
      if (response.score) setScore(response.score)
      setAction(undefined)
      dialog.current?.close()
      await onSaved()
    } catch {
      setError(true)
    } finally {
      setSaving(false)
    }
  }

  if (editing) {
    return (
      <MatchForm
        key={match.id}
        match={match}
        onSaved={onSaved}
        onCancel={() => setEditing(false)}
      />
    )
  }

  return (
    <section className="space-y-3 rounded-md border border-sr-border p-4">
      <h2 className="text-xl font-bold">{title}</h2>
      <p className="break-all text-sm text-sr-muted">{match.id}</p>
      {match.externalRef && <p>{match.externalRef}</p>}
      <p>
        {NAMES.admin.kickoffUtc}: {match.kickoff}
      </p>
      <p>
        {NAMES.admin.lockedUntil}: {match.lockTime}
      </p>
      <p role="status">
        {match.status === 'settled'
          ? `${NAMES.admin.settled}: ${match.result}`
          : match.status === 'voided'
            ? `${NAMES.admin.voided}: ${match.voidReason}`
            : match.locked
              ? `${NAMES.admin.open} — ${NAMES.admin.locked}`
              : NAMES.admin.open}
      </p>
      {match.status === 'open' && (
        <>
          <label className="block">
            {NAMES.admin.result}
            <select
              className={fieldClass}
              value={result}
              onChange={(event) => setResult(event.target.value)}
            >
              {match.outcomes.map((outcome) => (
                <option key={outcome} value={outcome}>
                  {outcome}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={!match.locked}
              onClick={() => setAction('settle')}
            >
              {NAMES.admin.settle}
            </Button>
            <Button variant="secondary" onClick={() => setAction('void')}>
              {NAMES.admin.void}
            </Button>
            <Button
              variant="secondary"
              disabled={match.locked}
              onClick={() => setEditing(true)}
            >
              {NAMES.admin.edit}
            </Button>
          </div>
          {match.locked && <p>{NAMES.admin.lockedEdit}</p>}
        </>
      )}
      {match.status !== 'open' && (
        <Button variant="secondary" onClick={() => setAction('credit')}>
          {NAMES.admin.credit}
        </Button>
      )}
      {score && (
        <p role="status">
          {NAMES.admin.creditedCount}: {score.creditedCount};{' '}
          {NAMES.admin.totalPoints}: {score.totalPoints}
        </p>
      )}
      <dialog
        ref={dialog}
        aria-labelledby={`confirm-${match.id}`}
        className="max-w-lg space-y-4 rounded-md border border-sr-border bg-sr-bg p-6 text-sr-text backdrop:bg-sr-bg/80"
        onCancel={(event) => {
          event.preventDefault()
          if (!saving) {
            dialog.current?.close()
            setAction(undefined)
          }
        }}
      >
        <h3 id={`confirm-${match.id}`} className="text-xl font-bold">
          {NAMES.admin.confirmHeading}
        </h3>
        <p>{title}</p>
        <p>{action && actionLabels[action]}</p>
        {action === 'settle' && (
          <>
            <p>
              {NAMES.admin.result}: {result}
            </p>
            <p>{NAMES.admin.confirmHelp}</p>
          </>
        )}
        {action === 'void' && (
          <>
            <p>{NAMES.admin.voidHelp}</p>
            <label className="block">
              {NAMES.admin.voidReason}
              <textarea
                className={fieldClass}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                maxLength={500}
                required
              />
            </label>
          </>
        )}
        {action === 'credit' && <p>{NAMES.admin.creditHelp}</p>}
        {error && <p role="alert">{NAMES.admin.error}</p>}
        <div className="flex gap-2">
          <Button
            disabled={
              saving || (action === 'void' && reason.trim().length === 0)
            }
            onClick={() => void confirmAction()}
          >
            {action && actionLabels[action]}
          </Button>
          <Button
            variant="secondary"
            disabled={saving}
            onClick={() => {
              dialog.current?.close()
              setAction(undefined)
            }}
          >
            {NAMES.admin.cancel}
          </Button>
        </div>
      </dialog>
    </section>
  )
}

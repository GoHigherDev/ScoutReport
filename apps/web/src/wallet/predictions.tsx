'use client'

import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getAccount, signTypedData } from '@wagmi/core'
import { Button } from '@scoutreport/ui'
import { useConnection } from 'wagmi'
import { NAMES } from '../copy/names'
import {
  pickTypedData,
  type MyPrediction,
  type PredictEligibility,
  type PredictMatch,
  type PredictPage,
} from '../lib/predict'
import { getWalletConfig } from './config'
import { signIn } from './sign-in'

class PredictError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}

async function api<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(path, {
    credentials: 'same-origin',
    cache: 'no-store',
    ...(body !== undefined
      ? {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      : {}),
  })
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}))
    if (response.status === 429) {
      const delay = Number(response.headers.get('Retry-After'))
      throw new PredictError(
        429,
        Number.isInteger(delay) && delay > 0
          ? `${NAMES.predict.rateLimited} ${NAMES.predict.retryAfter}: ${delay}.`
          : NAMES.predict.rateLimited,
      )
    }
    const known = Object.values(NAMES.predict).includes(payload.message)
    throw new PredictError(
      response.status,
      known ? payload.message : NAMES.predict.error,
    )
  }
  return response.json()
}

const london = (value: string) =>
  new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))

function rejected(error: unknown) {
  let value = error
  for (
    let depth = 0;
    value && typeof value === 'object' && depth < 5;
    depth++
  ) {
    if ('code' in value && value.code === 4001) return true
    if ('name' in value && value.name === 'UserRejectedRequestError')
      return true
    value = 'cause' in value ? value.cause : undefined
  }
  return false
}

export function Predictions() {
  const { address, isConnected } = useConnection()
  const wallet = isConnected ? address?.toLowerCase() : undefined
  const identity = useRef({ wallet, epoch: 0 })
  if (identity.current.wallet !== wallet)
    identity.current = { wallet, epoch: identity.current.epoch + 1 }
  const epoch = identity.current.epoch
  const running = useRef<number | undefined>(undefined)
  const [version, setVersion] = useState(0)
  const [tab, setTab] = useState<'matches' | 'mine'>('matches')
  const [pagination, setPagination] = useState<{
    epoch: number
    cursor: string | null
  }>()
  const cursor = pagination?.epoch === epoch ? pagination.cursor : null
  const setCursor = (value: string | null) =>
    setPagination({ epoch, cursor: value })
  const [clock, setClock] = useState(Date.now)
  const [ageSelection, setAge] = useState<{ epoch: number; checked: boolean }>()
  const [termsSelection, setTerms] = useState<{
    epoch: number
    checked: boolean
  }>()
  const age = ageSelection?.epoch === epoch && ageSelection.checked
  const terms = termsSelection?.epoch === epoch && termsSelection.checked
  type ActionState =
    'idle' | 'signingIn' | 'savingEligibility' | 'signing' | 'saving'
  const [operation, setOperation] = useState<{
    epoch: number
    state: ActionState
  }>()
  const state = operation?.epoch === epoch ? operation.state : 'idle'
  const setState = (value: ActionState) => setOperation({ epoch, state: value })
  const [notice, setNotice] = useState<{
    wallet: string
    epoch: number
    text: string
    error: boolean
  }>()
  const eligibility = useQuery({
    queryKey: ['predict-eligibility', wallet, epoch, version],
    enabled: !!wallet,
    queryFn: async () => {
      try {
        return await api<PredictEligibility>('/api/predict/eligibility')
      } catch (error) {
        if (error instanceof PredictError && error.status === 401) return null
        throw error
      }
    },
    retry: false,
    refetchOnWindowFocus: false,
  })
  const session = eligibility.data
  const matched = !!wallet && session?.address.toLowerCase() === wallet
  const list = useQuery({
    queryKey: ['predict-list', wallet, epoch, version, tab, cursor],
    enabled: matched,
    queryFn: () =>
      api<PredictPage<PredictMatch | MyPrediction> & { totalPoints?: number }>(
        `/api/predict/${tab}${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`,
      ),
    retry: false,
    refetchOnWindowFocus: false,
  })
  const busy = state !== 'idle'
  const eligible =
    matched &&
    session.countryAllowed &&
    session.ageConfirmed &&
    session.termsAccepted

  useEffect(() => {
    const deadlines = list.data?.matches
      .filter((match) => match.status === 'upcoming')
      .map((match) => Date.parse(match.lockTime))
      .filter((deadline) => deadline > clock)
    if (!deadlines?.length) return
    const timer = setTimeout(
      () => setClock(Date.now()),
      Math.min(Math.max(0, Math.min(...deadlines) - Date.now()), 2_147_483_647),
    )
    return () => clearTimeout(timer)
  }, [list.data, clock])

  function assertWallet(expected: string) {
    const current = getAccount(getWalletConfig()).address?.toLowerCase()
    if (
      identity.current.wallet !== expected ||
      identity.current.epoch !== epoch ||
      current !== expected
    )
      throw new Error(NAMES.predict.walletMismatch)
  }

  async function act(
    initial: typeof state,
    action: (expected: string) => Promise<void>,
  ) {
    if (!wallet || running.current === epoch) return
    const expected = wallet
    running.current = epoch
    setNotice(undefined)
    setState(initial)
    try {
      assertWallet(expected)
      await action(expected)
      if (
        identity.current.wallet === expected &&
        identity.current.epoch === epoch
      ) {
        setVersion((value) => value + 1)
        if (initial === 'signing')
          setNotice({
            wallet: expected,
            epoch,
            text: NAMES.predict.saved,
            error: false,
          })
      }
    } catch (error) {
      if (
        identity.current.wallet === expected &&
        identity.current.epoch === epoch
      ) {
        setNotice({
          wallet: expected,
          epoch,
          text: rejected(error)
            ? NAMES.predict.rejected
            : error instanceof PredictError ||
                (error instanceof Error &&
                  error.message === NAMES.predict.walletMismatch)
              ? error.message
              : NAMES.predict.error,
          error: true,
        })
        // Re-read eligibility after stale sessions, deadlines or country changes.
        setVersion((value) => value + 1)
      }
    } finally {
      if (running.current === epoch) running.current = undefined
      if (identity.current.epoch === epoch) setState('idle')
    }
  }

  function submit(match: PredictMatch, outcome: string) {
    void act('signing', async (expected) => {
      if (!eligible || !session) throw new Error(NAMES.predict.error)
      const selection = { matchId: match.id, outcome }
      const challenge = await api<{ nonce: string }>(
        '/api/predict/nonce',
        selection,
      )
      assertWallet(expected)
      const signature = await signTypedData(getWalletConfig(), {
        account: expected as `0x${string}`,
        ...pickTypedData(window.location.origin, session.chainId, {
          ...selection,
          nonce: challenge.nonce,
        }),
      })
      assertWallet(expected)
      setState('saving')
      await api('/api/predict/picks', {
        ...selection,
        nonce: challenge.nonce,
        signature,
      })
    })
  }

  return (
    <div className="space-y-5">
      <p>{NAMES.predict.signatureHelp}</p>
      {!wallet ? (
        <p>{NAMES.predict.connect}</p>
      ) : (
        <>
          {eligibility.isPending && (
            <p role="status">{NAMES.predict.loading}</p>
          )}
          {eligibility.isError && <p role="alert">{NAMES.predict.error}</p>}
          {!eligibility.isPending && !matched && (
            <div className="space-y-2">
              <p>
                {session
                  ? NAMES.predict.walletMismatch
                  : NAMES.predict.sessionRequired}
              </p>
              <Button
                disabled={busy}
                onClick={() =>
                  void act('signingIn', async (expected) => {
                    await signIn()
                    assertWallet(expected)
                  })
                }
              >
                {state === 'signingIn'
                  ? NAMES.predict.signingIn
                  : NAMES.predict.signIn}
              </Button>
            </div>
          )}
          {matched && !session.countryAllowed && (
            <p role="alert">{NAMES.predict.countryUnavailable}</p>
          )}
          {matched && session.countryAllowed && !eligible && (
            <form
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault()
                void act('savingEligibility', async (expected) => {
                  if (!session.ageConfirmed) {
                    await api('/api/predict/age-confirmation', {
                      confirmed: true,
                    })
                    assertWallet(expected)
                  }
                  if (!session.termsAccepted) {
                    await api('/api/predict/terms-acceptance', {
                      version: session.termsVersion,
                    })
                    assertWallet(expected)
                  }
                  setAge(undefined)
                  setTerms(undefined)
                })
              }}
            >
              {!session.ageConfirmed && (
                <label className="block">
                  <input
                    type="checkbox"
                    checked={age}
                    onChange={(event) =>
                      setAge({ epoch, checked: event.target.checked })
                    }
                    disabled={busy}
                  />{' '}
                  {NAMES.predict.confirmAge}
                </label>
              )}
              {!session.termsAccepted && (
                <label className="block">
                  <input
                    type="checkbox"
                    checked={terms}
                    onChange={(event) =>
                      setTerms({ epoch, checked: event.target.checked })
                    }
                    disabled={busy}
                  />{' '}
                  {NAMES.predict.acceptTerms}
                </label>
              )}
              <a href="/terms" className="block underline">
                {NAMES.predict.termsLink}
              </a>
              <Button
                type="submit"
                disabled={
                  busy ||
                  (!session.ageConfirmed && !age) ||
                  (!session.termsAccepted && !terms)
                }
              >
                {state === 'savingEligibility'
                  ? NAMES.predict.savingEligibility
                  : NAMES.predict.continue}
              </Button>
            </form>
          )}
          {matched && (
            <>
              <div className="flex flex-wrap gap-2">
                {(['matches', 'mine'] as const).map((value) => (
                  <Button
                    key={value}
                    variant={tab === value ? 'primary' : 'secondary'}
                    disabled={busy}
                    aria-pressed={tab === value}
                    onClick={() => {
                      setTab(value)
                      setCursor(null)
                    }}
                  >
                    {value === 'matches'
                      ? NAMES.predict.matchesTab
                      : NAMES.predict.predictionsTab}
                  </Button>
                ))}
              </div>
              {tab === 'mine' && list.data?.totalPoints !== undefined && (
                <p>
                  {NAMES.predict.totalPoints}: {list.data.totalPoints}
                </p>
              )}
              {list.isPending && <p role="status">{NAMES.predict.loading}</p>}
              {list.isError && <p role="alert">{NAMES.predict.error}</p>}
              {list.data?.matches.length === 0 && (
                <p>
                  {tab === 'mine'
                    ? NAMES.predict.emptyMine
                    : NAMES.predict.empty}
                </p>
              )}
              {list.data?.matches.map((match) => {
                const status =
                  match.status === 'upcoming' &&
                  Date.parse(match.lockTime) <= Math.max(clock, Date.now())
                    ? 'locked'
                    : match.status
                return (
                  <section
                    key={match.id}
                    className="space-y-3 rounded-md border border-sr-border p-4"
                  >
                    <h2 className="text-xl font-semibold">
                      {match.homeLabel} / {match.awayLabel}
                    </h2>
                    <p>{NAMES.predict[status]}</p>
                    <p>
                      {NAMES.predict.kickoff}: {london(match.kickoff)}
                    </p>
                    <p>
                      {NAMES.predict.lockTime}: {london(match.lockTime)}
                    </p>
                    <p>
                      {NAMES.predict.pointsForCorrect}: {match.pointsForCorrect}
                    </p>
                    {match.outcome && (
                      <p>
                        {NAMES.predict.yourPick}: {match.outcome}
                      </p>
                    )}
                    {(match.result || tab === 'mine') && (
                      <p>
                        {NAMES.predict.result}:{' '}
                        {match.result ??
                          (status === 'voided'
                            ? NAMES.predict.voided
                            : NAMES.predict.resultPending)}
                      </p>
                    )}
                    {match.voidReason && (
                      <p>
                        {NAMES.predict.voidReason}: {match.voidReason}
                      </p>
                    )}
                    {'points' in match && (
                      <p>
                        {NAMES.predict.points}: {match.points}
                      </p>
                    )}
                    {status === 'upcoming' && (
                      <div className="flex flex-wrap gap-2">
                        {match.outcomes.map((outcome) => (
                          <Button
                            key={outcome}
                            disabled={
                              busy ||
                              !eligible ||
                              Date.now() >= Date.parse(match.lockTime)
                            }
                            onClick={() => submit(match, outcome)}
                          >
                            {match.outcome
                              ? NAMES.predict.changePick
                              : NAMES.predict.signPick}
                            : {outcome}
                          </Button>
                        ))}
                      </div>
                    )}
                  </section>
                )
              })}
              {list.data?.nextCursor && (
                <Button
                  disabled={busy || list.isFetching}
                  onClick={() => setCursor(list.data!.nextCursor)}
                >
                  {NAMES.predict.more}
                </Button>
              )}
            </>
          )}
          {busy && <p role="status">{NAMES.predict[state]}</p>}
          {notice?.wallet === wallet && notice.epoch === epoch && (
            <p role={notice.error ? 'alert' : 'status'}>{notice.text}</p>
          )}
          <Button
            variant="secondary"
            disabled={busy || eligibility.isFetching || list.isFetching}
            onClick={() => {
              setCursor(null)
              setVersion((value) => value + 1)
            }}
          >
            {NAMES.predict.refresh}
          </Button>
        </>
      )}
    </div>
  )
}

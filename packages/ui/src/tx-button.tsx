'use client'

import { useRef, useState, type ReactNode } from 'react'
import { Button, type ButtonProps } from './button'

export type TxState =
  | 'idle'
  | 'checking'
  | 'awaiting_signature'
  | 'pending'
  | 'confirmed'
  | 'failed'

type GuardResult =
  | { ok: true }
  | {
      ok: false
      reason: 'insufficient_gas' | 'wrong_network' | 'unknown'
      error?: unknown
    }

export type TxButtonProps = Omit<
  ButtonProps,
  'children' | 'onClick' | 'type'
> & {
  labels: Record<TxState, string> & {
    explorer: string
    insufficient_gas: string
    wrong_network: string
    unknown: string
  }
  guard: () => Promise<GuardResult>
  write: () => Promise<string>
  waitForReceipt: (hash: string) => Promise<{
    status: 'success' | 'reverted'
    transactionHash?: string
  }>
  explorerUrl: (hash: string) => string
  decodeError: (error: unknown) => string
  insufficientGasPanel?: ReactNode
}

export function TxButton({
  labels,
  guard,
  write,
  waitForReceipt,
  explorerUrl,
  decodeError,
  insufficientGasPanel,
  disabled,
  ...props
}: TxButtonProps) {
  const [state, setState] = useState<TxState>('idle')
  const [error, setError] = useState<string>()
  const [insufficientGas, setInsufficientGas] = useState(false)
  const [hash, setHash] = useState<string>()
  const running = useRef(false)
  const busy = ['checking', 'awaiting_signature', 'pending'].includes(state)

  async function act() {
    if (running.current || disabled || hash) return
    running.current = true
    setError(undefined)
    setInsufficientGas(false)
    setState('checking')
    try {
      const result = await guard()
      if (!result.ok) {
        setInsufficientGas(result.reason === 'insufficient_gas')
        setError(
          result.error ? decodeError(result.error) : labels[result.reason],
        )
        setState('failed')
        return
      }
      setState('awaiting_signature')
      const sentHash = await write()
      setHash(sentHash)
      setState('pending')
      const receipt = await waitForReceipt(sentHash)
      if (receipt.transactionHash) setHash(receipt.transactionHash)
      if (receipt.status !== 'success') {
        setError(labels.unknown)
        setState('failed')
      } else {
        setState('confirmed')
      }
    } catch (cause) {
      setError(decodeError(cause))
      setState('failed')
    } finally {
      running.current = false
    }
  }

  return (
    <div className="space-y-2">
      <Button
        {...props}
        type="button"
        disabled={disabled || busy || Boolean(hash)}
        aria-busy={busy}
        onClick={() => void act()}
      >
        {labels[state]}
      </Button>
      <p role="status" aria-live="polite" className="text-sm text-sr-muted">
        {state !== 'idle' && labels[state]}
      </p>
      {error && (
        <p role="alert" className="text-sm text-sr-danger">
          {error}
        </p>
      )}
      {insufficientGas && insufficientGasPanel}
      {hash && (
        <a
          href={explorerUrl(hash)}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-sm text-sr-text underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-sr-accent"
        >
          {labels.explorer}
        </a>
      )}
    </div>
  )
}

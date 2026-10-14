'use client'

import { useRef, useState } from 'react'
import { Button } from '@scoutreport/ui'
import { NAMES } from '../copy/names'
import { signIn } from './sign-in'

export function SignInButton() {
  const [state, setState] = useState<'idle' | 'signing' | 'signed'>('idle')
  const [error, setError] = useState<string>()
  const running = useRef(false)

  async function act() {
    if (running.current) return
    running.current = true
    setError(undefined)
    setState('signing')
    try {
      await signIn()
      setState('signed')
    } catch {
      setState('idle')
      setError(NAMES.auth.unexpectedError)
    } finally {
      running.current = false
    }
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        disabled={state !== 'idle'}
        onClick={() => void act()}
      >
        {state === 'signing'
          ? NAMES.gas.signingIn
          : state === 'signed'
            ? NAMES.gas.signedIn
            : NAMES.gas.signIn}
      </Button>
      <p className="text-sm text-sr-muted">{NAMES.auth.statement}</p>
      {error && (
        <p role="alert" className="text-sm text-sr-danger">
          {error}
        </p>
      )}
    </div>
  )
}

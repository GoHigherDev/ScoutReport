import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { NAMES } from '../copy/names'
import { SignInButton } from './sign-in-button'
import { signIn } from './sign-in'

vi.mock('./sign-in', () => ({ signIn: vi.fn() }))
afterEach(() => {
  cleanup()
  vi.resetAllMocks()
})

it('labels the signature with the approved no-gas, no-funds statement before signing', async () => {
  let resolve!: (value: unknown) => void
  vi.mocked(signIn).mockReturnValue(
    new Promise((done) => {
      resolve = done
    }),
  )
  render(<SignInButton />)
  expect(screen.getByText(NAMES.auth.statement)).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: NAMES.gas.signIn }))
  expect(
    screen.getByRole('button', { name: NAMES.gas.signingIn }),
  ).toBeDisabled()
  await act(async () => resolve({}))
  expect(
    screen.getByRole('button', { name: NAMES.gas.signedIn }),
  ).toBeDisabled()
  expect(signIn).toHaveBeenCalledOnce()
})

it('uses safe copy on signing failure and permits retry', async () => {
  vi.mocked(signIn).mockRejectedValue(new Error('raw response'))
  render(<SignInButton />)
  fireEvent.click(screen.getByRole('button'))
  expect(await screen.findByRole('alert')).toHaveTextContent(
    NAMES.auth.unexpectedError,
  )
  expect(screen.getByRole('button')).toBeEnabled()
})

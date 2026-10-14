import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { NAMES, SPICY_FAUCETS } from '../copy/names'
import { InsufficientGasPanel } from './gas-panel'

afterEach(() => {
  cleanup()
  vi.unstubAllEnvs()
})

it('offers exactly the verified faucets on Spicy', () => {
  vi.stubEnv('NEXT_PUBLIC_APP_CHAIN_ID', '88882')
  render(<InsufficientGasPanel />)
  expect(screen.getByText(NAMES.gas.spicyExplanation)).toBeInTheDocument()
  expect(screen.getAllByRole('link')).toHaveLength(2)
  expect(SPICY_FAUCETS.map(({ href }) => href)).toEqual([
    'https://spicy-faucet.chiliz.com/',
    'https://tatum.io/faucets/chiliz',
  ])
  for (const { label, href } of SPICY_FAUCETS) {
    expect(screen.getByRole('link', { name: label })).toHaveAttribute(
      'href',
      href,
    )
  }
})

it('shows neutral Mainnet guidance with no links, regardless of DATA_CHAIN', () => {
  vi.stubEnv('NEXT_PUBLIC_APP_CHAIN_ID', '88888')
  vi.stubEnv('NEXT_PUBLIC_DATA_CHAIN_ID', '88882')
  render(<InsufficientGasPanel />)
  expect(screen.getByText(NAMES.gas.mainnetExplanation)).toBeInTheDocument()
  expect(screen.queryByRole('link')).not.toBeInTheDocument()
  expect(screen.queryByText(NAMES.gas.spicyExplanation)).not.toBeInTheDocument()
})

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TxButton, type TxButtonProps } from './tx-button'

afterEach(cleanup)
const labels: TxButtonProps['labels'] = {
  idle: 'Submit',
  checking: 'Checking',
  awaiting_signature: 'Awaiting signature',
  pending: 'Pending',
  confirmed: 'Confirmed',
  failed: 'Failed',
  explorer: 'Explorer',
  insufficient_gas: 'Insufficient CHZ',
  wrong_network: 'Wrong network',
  unknown: 'Unable to complete',
}
const setup = (): TxButtonProps => ({
  labels,
  guard: vi.fn().mockResolvedValue({ ok: true }),
  write: vi.fn().mockResolvedValue('0x123'),
  waitForReceipt: vi.fn().mockResolvedValue({ status: 'success' }),
  explorerUrl: (hash) => `https://test-explorer.invalid/tx/${hash}`,
  decodeError: vi.fn(() => 'Safe decoded error'),
  insufficientGasPanel: <aside>Gas guidance</aside>,
})
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

describe('TxButton', () => {
  it('runs all success states in order and links the confirmed receipt', async () => {
    const guard = deferred<{ ok: true }>()
    const signature = deferred<string>()
    const receipt = deferred<{ status: 'success'; transactionHash: string }>()
    const props = setup()
    props.guard = vi.fn(() => guard.promise)
    props.write = vi.fn(() => signature.promise)
    props.waitForReceipt = vi.fn(() => receipt.promise)
    render(<TxButton {...props} />)
    expect(screen.getByRole('button', { name: labels.idle })).toBeTruthy()
    expect(screen.queryByRole('link')).toBeNull()
    fireEvent.click(screen.getByRole('button'))
    expect(
      screen
        .getByRole('button', { name: labels.checking })
        .hasAttribute('disabled'),
    ).toBe(true)
    fireEvent.click(screen.getByRole('button'))
    expect(props.guard).toHaveBeenCalledOnce()
    expect(props.write).not.toHaveBeenCalled()
    await act(async () => guard.resolve({ ok: true }))
    expect(
      screen.getByRole('button', { name: labels.awaiting_signature }),
    ).toBeTruthy()
    await act(async () => signature.resolve('0x123'))
    expect(screen.getByRole('button', { name: labels.pending })).toBeTruthy()
    expect(props.waitForReceipt).toHaveBeenCalledWith('0x123')
    expect(screen.getByRole('link').getAttribute('href')).toContain('0x123')
    await act(async () =>
      receipt.resolve({ status: 'success', transactionHash: '0x456' }),
    )
    expect(
      screen
        .getByRole('button', { name: labels.confirmed })
        .hasAttribute('disabled'),
    ).toBe(true)
    expect(screen.getByRole('link').getAttribute('href')).toContain('0x456')
    expect(screen.getByRole('link').getAttribute('rel')).toBe(
      'noopener noreferrer',
    )
    fireEvent.click(screen.getByRole('button'))
    expect(props.write).toHaveBeenCalledOnce()
  })

  it.each(['insufficient_gas', 'wrong_network', 'unknown'] as const)(
    'never writes when the guard returns %s',
    async (reason) => {
      const props = setup()
      props.guard = vi.fn().mockResolvedValue({ ok: false, reason })
      render(<TxButton {...props} />)
      fireEvent.click(screen.getByRole('button'))
      expect(await screen.findByRole('alert')).toHaveProperty(
        'textContent',
        labels[reason],
      )
      expect(screen.getByRole('button', { name: labels.failed })).toBeTruthy()
      expect(props.write).not.toHaveBeenCalled()
      expect(screen.queryByText('Gas guidance') !== null).toBe(
        reason === 'insufficient_gas',
      )
    },
  )

  it('decodes estimation reverts without writing', async () => {
    const props = setup()
    props.guard = vi
      .fn()
      .mockResolvedValue({
        ok: false,
        reason: 'unknown',
        error: { data: '0x123' },
      })
    render(<TxButton {...props} />)
    fireEvent.click(screen.getByRole('button'))
    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'Safe decoded error',
    )
    expect(props.write).not.toHaveBeenCalled()
  })

  it('handles rejection and allows a fresh check before retrying', async () => {
    const props = setup()
    props.write = vi.fn().mockRejectedValue(new Error('raw provider stack'))
    render(<TxButton {...props} />)
    fireEvent.click(screen.getByRole('button'))
    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'Safe decoded error',
    )
    expect(screen.queryByText('raw provider stack')).toBeNull()
    fireEvent.click(screen.getByRole('button'))
    await waitFor(() => expect(props.guard).toHaveBeenCalledTimes(2))
  })

  it.each(['reverted', 'unavailable'] as const)(
    'shows failed receipt state for %s without allowing accidental resubmission',
    async (outcome) => {
      const props = setup()
      props.waitForReceipt =
        outcome === 'reverted'
          ? vi.fn().mockResolvedValue({ status: 'reverted' })
          : vi.fn().mockRejectedValue(new Error('RPC unavailable'))
      render(<TxButton {...props} />)
      fireEvent.click(screen.getByRole('button'))
      await screen.findByRole('alert')
      expect(
        screen
          .getByRole('button', { name: labels.failed })
          .hasAttribute('disabled'),
      ).toBe(true)
      expect(screen.getByRole('link')).toBeTruthy()
      expect(props.write).toHaveBeenCalledOnce()
    },
  )

  it('respects externally disabled actions', () => {
    const props = setup()
    render(<TxButton {...props} disabled />)
    fireEvent.click(screen.getByRole('button'))
    expect(props.guard).not.toHaveBeenCalled()
  })
})

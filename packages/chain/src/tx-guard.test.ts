import { afterEach, describe, expect, it, vi } from 'vitest'
import { BaseError, InsufficientFundsError, type Address } from 'viem'
import { checkTxGuard, type TxGuardOptions } from './tx-guard.ts'

const address = '0x0000000000000000000000000000000000000001' as Address
const request = { to: address, data: '0x' as const }
const setup = () => ({
  getWallet: vi.fn(() => ({ address, chainId: 88882 })),
  client: {
    getBalance: vi.fn().mockResolvedValue(100n),
    estimateGas: vi.fn().mockResolvedValue(10n),
    estimateFeesPerGas: vi.fn().mockResolvedValue({ maxFeePerGas: 2n }),
  },
})
afterEach(() => vi.unstubAllEnvs())

describe('checkTxGuard', () => {
  it('reads balance and estimates gas for the account on APP_CHAIN', async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_CHAIN_ID', '88882')
    const options = setup()
    expect(await checkTxGuard(request, options)).toEqual({ ok: true })
    expect(options.client.getBalance).toHaveBeenCalledWith({ address })
    expect(options.client.estimateGas).toHaveBeenCalledWith({
      ...request,
      account: address,
    })
  })

  it('blocks unsupported and DATA_CHAIN wallets without RPC work', async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_CHAIN_ID', '88882')
    for (const chainId of [88888, 1]) {
      const options = setup()
      options.getWallet.mockReturnValue({ address, chainId })
      expect(await checkTxGuard(request, options)).toEqual({
        ok: false,
        reason: 'wrong_network',
      })
      expect(options.client.getBalance).not.toHaveBeenCalled()
    }
  })

  it('blocks disconnected accounts', async () => {
    const options: TxGuardOptions = { getWallet: () => ({ chainId: 88882 }) }
    expect(await checkTxGuard(request, options)).toEqual({
      ok: false,
      reason: 'unknown',
    })
  })

  it('blocks zero balance before an estimate can fail for insufficient funds', async () => {
    const options = setup()
    options.client.getBalance.mockResolvedValue(0n)
    expect(await checkTxGuard(request, options)).toEqual({
      ok: false,
      reason: 'insufficient_gas',
    })
    expect(options.client.estimateGas).not.toHaveBeenCalled()
  })

  it('includes value and the fee ceiling, allowing the exact required balance', async () => {
    const options = setup()
    options.client.getBalance.mockResolvedValue(29n)
    expect(await checkTxGuard({ ...request, value: 10n }, options)).toEqual({
      ok: false,
      reason: 'insufficient_gas',
    })
    options.client.getBalance.mockResolvedValue(30n)
    expect(await checkTxGuard({ ...request, value: 10n }, options)).toEqual({
      ok: true,
    })
  })

  it('uses explicit gas and fees, including legacy fees', async () => {
    const options = setup()
    expect(
      await checkTxGuard({ ...request, gas: 60n, maxFeePerGas: 2n }, options),
    ).toEqual({ ok: false, reason: 'insufficient_gas' })
    expect(await checkTxGuard({ ...request, gasPrice: 11n }, options)).toEqual({
      ok: false,
      reason: 'insufficient_gas',
    })
    options.client.estimateFeesPerGas.mockResolvedValue({ gasPrice: 11n })
    expect(await checkTxGuard(request, options)).toEqual({
      ok: false,
      reason: 'insufficient_gas',
    })
  })

  it('fails closed on balance, estimate and fee RPC failures', async () => {
    for (const method of [
      'getBalance',
      'estimateGas',
      'estimateFeesPerGas',
    ] as const) {
      const options = setup()
      const error = new Error('RPC unavailable')
      options.client[method].mockRejectedValue(error)
      expect(await checkTxGuard(request, options)).toEqual({
        ok: false,
        reason: 'unknown',
        error,
      })
    }
  })

  it('recognises viem insufficient-funds estimation errors', async () => {
    const options = setup()
    options.client.estimateGas.mockRejectedValue(
      new BaseError('Estimate failed', { cause: new InsufficientFundsError() }),
    )
    expect(await checkTxGuard(request, options)).toEqual({
      ok: false,
      reason: 'insufficient_gas',
    })
  })

  it('blocks account and network changes during the check', async () => {
    for (const changed of [
      { address, chainId: 88888 },
      { address: undefined, chainId: 88882 },
    ]) {
      const options: TxGuardOptions = setup()
      options.getWallet = vi
        .fn()
        .mockReturnValueOnce({ address, chainId: 88882 })
        .mockReturnValue(changed)
      expect((await checkTxGuard(request, options)).ok).toBe(false)
    }
  })
})

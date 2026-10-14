import { ContractFunctionRevertedError, encodeErrorResult } from 'viem'
import { describe, expect, it } from 'vitest'
import { decodeTxError, SCOUTREPORT_ABIS } from './tx-errors.ts'

const messages = { MatchLocked: 'This match is locked.' }
const fallback = 'The transaction could not be completed.'

describe('decodeTxError', () => {
  it('decodes an ABI custom error from raw data or nested viem causes', () => {
    const data = encodeErrorResult({
      abi: SCOUTREPORT_ABIS[0],
      errorName: 'MatchLocked',
    })
    expect(decodeTxError(data, messages, fallback)).toBe(messages.MatchLocked)
    expect(
      decodeTxError({ cause: { cause: { data } } }, messages, fallback),
    ).toBe(messages.MatchLocked)
    const reverted = new ContractFunctionRevertedError({
      abi: SCOUTREPORT_ABIS[0],
      data,
      functionName: 'predict',
    })
    expect(decodeTxError({ cause: reverted }, messages, fallback)).toBe(
      messages.MatchLocked,
    )
  })

  it('does not expose unknown, malformed, unmapped or raw provider errors', () => {
    const data = encodeErrorResult({
      abi: SCOUTREPORT_ABIS[0],
      errorName: 'ZeroAdmin',
    })
    for (const error of [
      data,
      '0xdeadbeef',
      '0xzz',
      new Error('private RPC stack'),
      null,
      { data: { errorName: 'MatchLocked' } },
    ]) {
      expect(decodeTxError(error, messages, fallback)).toBe(fallback)
    }
  })

  it('bounds cyclic provider causes', () => {
    const error: { cause?: unknown } = {}
    error.cause = error
    expect(decodeTxError(error, messages, fallback)).toBe(fallback)
  })
})

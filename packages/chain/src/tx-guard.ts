'use client'

import { useCallback } from 'react'
import {
  BaseError,
  InsufficientFundsError,
  type Address,
  type PublicClient,
  type TransactionRequest,
} from 'viem'
import { getPublicClient } from './clients.ts'
import { getAppChain } from './networks.ts'

export type GuardedTxRequest = Pick<
  TransactionRequest,
  'to' | 'data' | 'value' | 'gas'
> &
  (
    | { gasPrice?: bigint; maxFeePerGas?: never; maxPriorityFeePerGas?: never }
    | { gasPrice?: never; maxFeePerGas?: bigint; maxPriorityFeePerGas?: bigint }
  )

export type TxGuardResult =
  | { ok: true }
  | {
      ok: false
      reason: 'insufficient_gas' | 'wrong_network' | 'unknown'
      error?: unknown
    }

export type TxGuardOptions = {
  getWallet: () => { address?: Address; chainId?: number }
  client?: Pick<
    PublicClient,
    'getBalance' | 'estimateGas' | 'estimateFeesPerGas'
  >
}

export async function checkTxGuard(
  request: GuardedTxRequest,
  { getWallet, client }: TxGuardOptions,
): Promise<TxGuardResult> {
  const chain = getAppChain()
  const wallet = getWallet()
  if (wallet.chainId !== chain.id) return { ok: false, reason: 'wrong_network' }
  if (!wallet.address) return { ok: false, reason: 'unknown' }

  try {
    const rpc = client ?? getPublicClient(chain.id)
    const balance = await rpc.getBalance({ address: wallet.address })
    if (balance <= (request.value ?? 0n)) {
      return { ok: false, reason: 'insufficient_gas' }
    }
    const estimatedGas = await rpc.estimateGas({
      ...request,
      account: wallet.address,
    })
    // Use the supplied gas limit and fee ceiling when they exceed the estimate.
    const gas =
      request.gas && request.gas > estimatedGas ? request.gas : estimatedGas
    let fee = request.maxFeePerGas ?? request.gasPrice
    if (fee === undefined) {
      const fees = await rpc.estimateFeesPerGas()
      fee = fees.maxFeePerGas ?? fees.gasPrice
    }
    if (fee === undefined || fee <= 0n || gas <= 0n) {
      return { ok: false, reason: 'unknown' }
    }
    const current = getWallet()
    if (current.chainId !== chain.id)
      return { ok: false, reason: 'wrong_network' }
    if (current.address !== wallet.address)
      return { ok: false, reason: 'unknown' }
    return balance < gas * fee + (request.value ?? 0n)
      ? { ok: false, reason: 'insufficient_gas' }
      : { ok: true }
  } catch (error) {
    if (
      error instanceof InsufficientFundsError ||
      (error instanceof BaseError &&
        error.walk(
          (cause) => cause instanceof InsufficientFundsError,
        ) instanceof InsufficientFundsError)
    ) {
      return { ok: false, reason: 'insufficient_gas' }
    }
    return { ok: false, reason: 'unknown', error }
  }
}

/** Run immediately before a write, not when the component mounts. */
export function useTxGuard(request: GuardedTxRequest, options: TxGuardOptions) {
  return useCallback(() => checkTxGuard(request, options), [request, options])
}

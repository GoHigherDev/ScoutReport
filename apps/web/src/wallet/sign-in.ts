'use client'

import { getAccount, signMessage } from '@wagmi/core'
import { getDataChain } from '@scoutreport/chain'
import { createSiweMessage } from 'viem/siwe'
import { SIWE_STATEMENT } from '../copy/auth'
import { getWalletConfig } from './config'

export async function signIn() {
  const config = getWalletConfig()
  const { address } = getAccount(config)
  if (!address) throw new Error('A session is required')
  const challenge = await fetch('/api/auth/nonce', {
    credentials: 'same-origin',
    cache: 'no-store',
  })
  if (!challenge.ok) throw new Error('An unexpected error occurred')
  const { nonce, expiresAt } = await challenge.json()
  const message = createSiweMessage({
    domain: window.location.host,
    uri: window.location.origin,
    address,
    version: '1',
    chainId: getDataChain().id,
    nonce,
    issuedAt: new Date(),
    expirationTime: new Date(expiresAt),
    statement: SIWE_STATEMENT,
  })
  const signature = await signMessage(config, { account: address, message })
  const response = await fetch('/api/auth/verify', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, signature }),
  })
  if (!response.ok) throw new Error('A session is required')
  return response.json()
}

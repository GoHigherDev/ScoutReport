import { describe, expect, it } from 'vitest'
import { appChain, dataChain } from './index'

describe('configured chains', () => {
  it('uses Spicy for the app and Mainnet for read-only data', () => {
    expect(appChain.id).toBe(88882)
    expect(dataChain.id).toBe(88888)
  })
})

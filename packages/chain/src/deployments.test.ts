import { afterEach, describe, expect, it, vi } from 'vitest'
import fixture from './fixtures/deployments.json'
import {
  DEPLOYMENT_ADDRESSES,
  getPredictionsAddress,
  readDeploymentAddresses,
  readPredictionsAddress,
} from './deployments'

afterEach(() => vi.unstubAllEnvs())

describe('deployment records', () => {
  it('never exports Mainnet mock contracts', () => {
    expect(DEPLOYMENT_ADDRESSES[88888]).toEqual({})
    expect(
      readDeploymentAddresses({ ...fixture, status: 'PENDING' }, 88882),
    ).toEqual({})
  })

  describe('predictions deployment', () => {
    const address = '0x0000000000000000000000000000000000000001'
    const record = {
      chainId: 88882,
      status: 'DEPLOYED',
      contracts: { ScoutReportPredictions: { address } },
    }

    it('reads only an approved non-zero Spicy predictions address', () => {
      expect(readPredictionsAddress(record)).toBe(address)
      for (const invalid of [
        null,
        {},
        { ...record, chainId: 88888 },
        { ...record, status: 'PENDING' },
        { ...record, contracts: { ScoutReportPredictions: null } },
        {
          ...record,
          contracts: { ScoutReportPredictions: { address: '0x' } },
        },
        {
          ...record,
          contracts: {
            ScoutReportPredictions: { address: `0x${'0'.repeat(40)}` },
          },
        },
      ]) {
        expect(readPredictionsAddress(invalid)).toBeUndefined()
      }
    })

    it('fails closed with the pending record and a Mainnet APP_CHAIN', () => {
      vi.stubEnv('NEXT_PUBLIC_APP_CHAIN_ID', '88882')
      expect(getPredictionsAddress()).toBeUndefined()
      vi.stubEnv('NEXT_PUBLIC_APP_CHAIN_ID', '88888')
      expect(getPredictionsAddress()).toBeUndefined()
    })
  })

  it('exports only valid non-zero addresses for the recorded chain', () => {
    expect(readDeploymentAddresses(fixture, 88882)).toEqual({
      MockSociosStaking: fixture.contracts.MockSociosStaking.address,
    })
    expect(readDeploymentAddresses(fixture, 88888)).toEqual({})
  })

  it('handles pending, null and malformed records without throwing', () => {
    for (const record of [
      null,
      {},
      { ...fixture, status: 'PENDING' },
      { ...fixture, contracts: null },
      { ...fixture, contracts: { MockSociosStaking: { address: 'invalid' } } },
    ]) {
      expect(readDeploymentAddresses(record, 88882)).toEqual({})
    }
  })
})

import { describe, expect, it } from 'vitest'
import fixture from './fixtures/deployments.json'
import { DEPLOYMENT_ADDRESSES, readDeploymentAddresses } from './deployments'

describe('deployment records', () => {
  it('never exports Mainnet mock contracts', () => {
    expect(DEPLOYMENT_ADDRESSES[88888]).toEqual({})
    expect(
      readDeploymentAddresses({ ...fixture, status: 'PENDING' }, 88882),
    ).toEqual({})
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

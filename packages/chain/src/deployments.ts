import type { Address } from 'viem'
import spicyRecord from '../../contracts/deployments/88882.json' with { type: 'json' }
import { getAppChain } from './networks.ts'

export const MOCK_CONTRACT_NAMES = [
  'MockSociosStaking',
  'MockFanToken18',
  'MockFanToken6',
] as const

export type MockContractName = (typeof MOCK_CONTRACT_NAMES)[number]
export type DeploymentAddresses = Partial<Record<MockContractName, Address>>

export function readPredictionsAddress(record: unknown): Address | undefined {
  if (!record || typeof record !== 'object') return undefined
  const data = record as Record<string, unknown>
  if (
    data.chainId !== 88882 ||
    data.status !== 'DEPLOYED' ||
    !data.contracts ||
    typeof data.contracts !== 'object'
  )
    return undefined
  const contract = (data.contracts as Record<string, unknown>)
    .ScoutReportPredictions
  if (!contract || typeof contract !== 'object') return undefined
  const address = (contract as Record<string, unknown>).address
  return typeof address === 'string' &&
    /^0x[0-9a-fA-F]{40}$/.test(address) &&
    !/^0x0{40}$/.test(address)
    ? (address as Address)
    : undefined
}

export function getPredictionsAddress(): Address | undefined {
  return getAppChain().id === 88882
    ? readPredictionsAddress(spicyRecord)
    : undefined
}

export function readDeploymentAddresses(
  record: unknown,
  chainId: number,
): DeploymentAddresses {
  if (!record || typeof record !== 'object') return {}
  const data = record as Record<string, unknown>
  if (
    data.chainId !== chainId ||
    data.status !== 'DEPLOYED' ||
    !data.contracts ||
    typeof data.contracts !== 'object'
  )
    return {}

  const contracts = data.contracts as Record<string, unknown>
  const addresses: DeploymentAddresses = {}
  for (const name of MOCK_CONTRACT_NAMES) {
    const contract = contracts[name]
    if (!contract || typeof contract !== 'object') continue
    const address = (contract as Record<string, unknown>).address
    if (
      typeof address === 'string' &&
      /^0x[0-9a-fA-F]{40}$/.test(address) &&
      !/^0x0{40}$/.test(address)
    )
      addresses[name] = address as Address
  }
  return addresses
}

export const DEPLOYMENT_ADDRESSES: Readonly<
  Record<88882 | 88888, Readonly<DeploymentAddresses>>
> = {
  88882: readDeploymentAddresses(spicyRecord, 88882),
  // Mainnet contracts are outside SR-16; DATA_CHAIN remains read-only.
  88888: {},
}

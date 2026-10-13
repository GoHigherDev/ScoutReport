import type { Address } from 'viem'
import spicyRecord from '../../contracts/deployments/88882.json' with { type: 'json' }

export const MOCK_CONTRACT_NAMES = [
  'MockSociosStaking',
  'MockFanToken18',
  'MockFanToken6',
] as const

export type MockContractName = (typeof MOCK_CONTRACT_NAMES)[number]
export type DeploymentAddresses = Partial<Record<MockContractName, Address>>

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

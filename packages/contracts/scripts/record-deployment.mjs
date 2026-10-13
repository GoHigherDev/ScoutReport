import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const mockSources = {
  MockSociosStaking: 'src/mocks/MockSociosStaking.sol',
  MockFanToken: 'src/mocks/MockFanToken.sol',
}
const addressPattern = /^0x[0-9a-fA-F]{40}$/
const hashPattern = /^0x[0-9a-fA-F]{64}$/

function requireValue(condition, message) {
  if (!condition) throw new Error(message)
}

function quantity(value, label) {
  requireValue(
    (typeof value === 'number' && Number.isSafeInteger(value)) ||
      (typeof value === 'string' && /^(?:0x[0-9a-fA-F]+|[0-9]+)$/.test(value)),
    `Invalid ${label}`,
  )
  const parsed = Number(value)
  requireValue(Number.isSafeInteger(parsed) && parsed >= 0, `Invalid ${label}`)
  return parsed
}

function address(value) {
  requireValue(
    typeof value === 'string' &&
      addressPattern.test(value) &&
      !/^0x0{40}$/i.test(value),
    'Invalid contract address',
  )
  return value.toLowerCase()
}

function transactionHash(value) {
  requireValue(
    typeof value === 'string' &&
      hashPattern.test(value) &&
      !/^0x0{64}$/i.test(value),
    'Invalid transaction hash',
  )
  return value.toLowerCase()
}

function recordName(transaction) {
  requireValue(
    transaction.transactionType === 'CREATE' &&
      (!transaction.additionalContracts ||
        (Array.isArray(transaction.additionalContracts) &&
          transaction.additionalContracts.length === 0)) &&
      Array.isArray(transaction.arguments),
    'Only the allowlisted mock creations may be recorded',
  )
  const args = transaction.arguments
  if (transaction.contractName === 'MockSociosStaking') {
    requireValue(args.length === 1, 'Invalid staking constructor')
    address(args[0])
    return 'MockSociosStaking'
  }
  requireValue(
    transaction.contractName === 'MockFanToken' && args.length === 4,
    'Unexpected deployment contract',
  )
  address(args[0])
  const decimals = quantity(args[3], 'mock decimals')
  requireValue(
    (decimals === 18 || decimals === 6) &&
      args[1] === `[MOCK FAN TOKEN ${decimals}]` &&
      args[2] === `MOCK${decimals}`,
    'Unexpected mock token constructor',
  )
  return `MockFanToken${decimals}`
}

/** Produce a public record, never copying calldata, keys or arbitrary metadata. */
export function buildDeploymentRecord(broadcast, gitSha) {
  requireValue(
    typeof gitSha === 'string' && /^[0-9a-f]{40}$/.test(gitSha),
    'Invalid git commit hash',
  )
  requireValue(
    broadcast && quantity(broadcast.chain, 'broadcast chain') === 88882,
    'Spicy chain 88882 is required',
  )
  requireValue(
    Array.isArray(broadcast.transactions) &&
      broadcast.transactions.length === 3 &&
      Array.isArray(broadcast.receipts) &&
      broadcast.receipts.length === 3 &&
      Array.isArray(broadcast.pending) &&
      broadcast.pending.length === 0,
    'Exactly three confirmed mock deployments are required',
  )
  const receipts = new Map()
  for (const receipt of broadcast.receipts) {
    requireValue(receipt && typeof receipt === 'object', 'Invalid receipt')
    const hash = transactionHash(receipt.transactionHash)
    requireValue(!receipts.has(hash), 'Duplicate receipt')
    requireValue(
      quantity(receipt.status, 'receipt status') === 1,
      'Failed receipt',
    )
    receipts.set(hash, receipt)
  }
  const contracts = {}
  const usedHashes = new Set()
  const usedAddresses = new Set()
  for (const transaction of broadcast.transactions) {
    requireValue(
      transaction && typeof transaction === 'object',
      'Invalid transaction',
    )
    requireValue(
      transaction.transaction &&
        quantity(transaction.transaction.chainId, 'transaction chain') ===
          88882,
      'Spicy transaction chain 88882 is required',
    )
    const name = recordName(transaction)
    requireValue(!Object.hasOwn(contracts, name), 'Duplicate mock deployment')
    const hash = transactionHash(transaction.hash)
    const receipt = receipts.get(hash)
    requireValue(receipt && !usedHashes.has(hash), 'Missing or reused receipt')
    const deployedAddress = address(transaction.contractAddress)
    requireValue(
      address(receipt.contractAddress) === deployedAddress &&
        !usedAddresses.has(deployedAddress),
      'Mismatched or reused deployment address',
    )
    const deployBlock = quantity(receipt.blockNumber, 'deployment block')
    requireValue(deployBlock > 0, 'Unconfirmed deployment block')
    contracts[name] = {
      address: deployedAddress,
      deployBlock,
      transactionHash: hash,
    }
    usedHashes.add(hash)
    usedAddresses.add(deployedAddress)
  }
  requireValue(
    ['MockSociosStaking', 'MockFanToken18', 'MockFanToken6'].every((name) =>
      Object.hasOwn(contracts, name),
    ),
    'Missing allowlisted mock',
  )
  return { chainId: 88882, status: 'DEPLOYED', gitSha, contracts }
}

const abiFields = [
  'type',
  'name',
  'inputs',
  'outputs',
  'stateMutability',
  'anonymous',
]
const parameterFields = [
  'name',
  'type',
  'internalType',
  'components',
  'indexed',
]

function sanitiseAbiEntry(entry, parameter = false) {
  requireValue(entry && typeof entry === 'object', 'Invalid ABI entry')
  requireValue(typeof entry.type === 'string', 'Invalid ABI type')
  const result = {}
  for (const field of parameter ? parameterFields : abiFields) {
    if (!Object.hasOwn(entry, field)) continue
    const value = entry[field]
    if (['inputs', 'outputs', 'components'].includes(field)) {
      requireValue(Array.isArray(value), 'Invalid ABI parameters')
      result[field] = value.map((child) => sanitiseAbiEntry(child, true))
    } else {
      requireValue(
        typeof value ===
          (['anonymous', 'indexed'].includes(field) ? 'boolean' : 'string'),
        'Invalid ABI field',
      )
      result[field] = value
    }
  }
  return result
}

/** Only compiled ABI and flattened allowlisted source become verification evidence. */
export function collectEvidence(gitSha, { readArtifact, flatten }) {
  requireValue(
    typeof gitSha === 'string' && /^[0-9a-f]{40}$/.test(gitSha),
    'Invalid git commit hash',
  )
  const evidence = { 'commit.txt': `${gitSha}\n` }
  for (const [name, source] of Object.entries(mockSources)) {
    const artifact = readArtifact(name)
    requireValue(
      Array.isArray(artifact?.abi) && artifact.abi.length > 0,
      'Missing mock ABI',
    )
    evidence[`${name}.abi.json`] = `${JSON.stringify(
      artifact.abi.map((entry) => sanitiseAbiEntry(entry)),
      null,
      2,
    )}\n`
    const flattened = flatten(source)
    requireValue(
      typeof flattened === 'string' &&
        flattened.includes(`contract ${name}`) &&
        flattened.includes('pragma solidity'),
      'Missing flattened mock source',
    )
    evidence[`${name}.flattened.sol`] = flattened
  }
  return evidence
}

function main() {
  const [broadcastPath, gitSha, ...extra] = process.argv.slice(2)
  requireValue(
    broadcastPath && gitSha && extra.length === 0,
    'Expected broadcast path and git SHA',
  )
  const actualSha = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: root,
    encoding: 'utf8',
  }).trim()
  requireValue(
    actualSha === gitSha,
    'Evidence must match the checked-out commit',
  )
  const record = buildDeploymentRecord(
    JSON.parse(readFileSync(broadcastPath, 'utf8')),
    gitSha,
  )
  const evidence = collectEvidence(gitSha, {
    readArtifact: (name) =>
      JSON.parse(
        readFileSync(
          resolve(root, 'out', `${name}.sol`, `${name}.json`),
          'utf8',
        ),
      ),
    flatten: (source) =>
      execFileSync('forge', ['flatten', source], {
        cwd: root,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      }),
  })
  const deployments = resolve(root, 'deployments')
  const evidenceDirectory = resolve(deployments, 'evidence', '88882')
  mkdirSync(evidenceDirectory, { recursive: true })
  for (const [name, content] of Object.entries(evidence)) {
    writeFileSync(resolve(evidenceDirectory, name), content)
  }
  writeFileSync(
    resolve(deployments, '88882.json'),
    `${JSON.stringify(record, null, 2)}\n`,
  )
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    main()
  } catch {
    // Raw Forge/JSON errors may include sensitive broadcast input.
    console.error(
      'Deployment record refused: check Spicy receipts, mock artifacts and commit.',
    )
    process.exitCode = 1
  }
}

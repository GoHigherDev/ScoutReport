import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const mockSources = {
  MockSociosStaking: 'src/mocks/MockSociosStaking.sol',
  MockFanToken: 'src/mocks/MockFanToken.sol',
}
const predictionSources = {
  ScoutReportPredictions: 'src/ScoutReportPredictions.sol',
}
function deploymentSources(target) {
  requireValue(
    target === 'mocks' || target === 'predictions',
    'Invalid deployment target',
  )
  return target === 'mocks' ? mockSources : predictionSources
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

function constructorString(value) {
  requireValue(typeof value === 'string', 'Invalid constructor string')
  const parsed = value.startsWith('"') ? JSON.parse(value) : value
  requireValue(typeof parsed === 'string', 'Invalid constructor string')
  return parsed
}

function recordName(transaction, target) {
  requireValue(
    transaction.transactionType === 'CREATE' &&
      (!transaction.additionalContracts ||
        (Array.isArray(transaction.additionalContracts) &&
          transaction.additionalContracts.length === 0)) &&
      Array.isArray(transaction.arguments),
    'Only the allowlisted creations may be recorded',
  )
  const args = transaction.arguments
  if (target === 'predictions') {
    requireValue(
      transaction.contractName === 'ScoutReportPredictions' &&
        args.length === 1,
      'Unexpected predictions constructor',
    )
    address(args[0])
    return 'ScoutReportPredictions'
  }
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
      constructorString(args[1]) === `[MOCK FAN TOKEN ${decimals}]` &&
      constructorString(args[2]) === `MOCK${decimals}`,
    'Unexpected mock token constructor',
  )
  return `MockFanToken${decimals}`
}

/** Produce a public record, never copying calldata, keys or arbitrary metadata. */
export function buildDeploymentRecord(broadcast, gitSha, target = 'mocks') {
  deploymentSources(target)
  const expectedNames =
    target === 'mocks'
      ? ['MockSociosStaking', 'MockFanToken18', 'MockFanToken6']
      : ['ScoutReportPredictions']
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
      broadcast.transactions.length === expectedNames.length &&
      Array.isArray(broadcast.receipts) &&
      broadcast.receipts.length === expectedNames.length &&
      Array.isArray(broadcast.pending) &&
      broadcast.pending.length === 0,
    'Exactly the selected confirmed deployments are required',
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
    const name = recordName(transaction, target)
    requireValue(
      !Object.hasOwn(contracts, name),
      'Duplicate contract deployment',
    )
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
    expectedNames.every((name) => Object.hasOwn(contracts, name)),
    'Missing allowlisted contract',
  )
  return { chainId: 88882, status: 'DEPLOYED', gitSha, contracts }
}

/** Preserve other deployments, including their original source commit. */
export function mergeDeploymentRecords(previous, current) {
  requireValue(previous?.chainId === 88882, 'Invalid previous deployment chain')
  const contracts = {}
  for (const name of [
    'MockSociosStaking',
    'MockFanToken18',
    'MockFanToken6',
    'ScoutReportPredictions',
  ]) {
    const entry = previous.contracts?.[name]
    if (entry == null) {
      if (Object.hasOwn(previous.contracts ?? {}, name)) contracts[name] = null
      continue
    }
    const sourceSha = entry.gitSha ?? previous.gitSha
    requireValue(
      typeof sourceSha === 'string' && /^[0-9a-f]{40}$/.test(sourceSha),
      'Invalid previous source commit',
    )
    const deployBlock = quantity(entry.deployBlock, 'previous deployment block')
    requireValue(deployBlock > 0, 'Unconfirmed previous deployment')
    contracts[name] = {
      address: address(entry.address),
      deployBlock,
      transactionHash: transactionHash(entry.transactionHash),
      gitSha: sourceSha,
    }
  }
  for (const [name, entry] of Object.entries(current.contracts)) {
    contracts[name] = { ...entry, gitSha: current.gitSha }
  }
  return { ...current, contracts }
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
export function collectEvidence(
  gitSha,
  { readArtifact, flatten },
  target = 'mocks',
) {
  requireValue(
    typeof gitSha === 'string' && /^[0-9a-f]{40}$/.test(gitSha),
    'Invalid git commit hash',
  )
  const evidence =
    target === 'mocks'
      ? { 'commit.txt': `${gitSha}\n` }
      : { 'ScoutReportPredictions.commit.txt': `${gitSha}\n` }
  for (const [name, source] of Object.entries(deploymentSources(target))) {
    const artifact = readArtifact(name)
    requireValue(
      Array.isArray(artifact?.abi) && artifact.abi.length > 0,
      'Missing contract ABI',
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
      'Missing flattened contract source',
    )
    evidence[`${name}.flattened.sol`] = flattened
  }
  return evidence
}

function main() {
  const [broadcastPath, gitSha, target = 'mocks', ...extra] =
    process.argv.slice(2)
  requireValue(
    broadcastPath && gitSha && extra.length === 0,
    'Expected broadcast path, git SHA and optional deployment target',
  )
  const actualSha = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: root,
    encoding: 'utf8',
  }).trim()
  requireValue(
    actualSha === gitSha,
    'Evidence must match the checked-out commit',
  )
  let record = buildDeploymentRecord(
    JSON.parse(readFileSync(broadcastPath, 'utf8')),
    gitSha,
    target,
  )
  const evidence = collectEvidence(
    gitSha,
    {
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
    },
    target,
  )
  const deployments = resolve(root, 'deployments')
  const recordPath = resolve(deployments, '88882.json')
  if (existsSync(recordPath)) {
    record = mergeDeploymentRecords(
      JSON.parse(readFileSync(recordPath, 'utf8')),
      record,
    )
  }
  const evidenceDirectory = resolve(deployments, 'evidence', '88882')
  mkdirSync(evidenceDirectory, { recursive: true })
  for (const [name, content] of Object.entries(evidence)) {
    writeFileSync(resolve(evidenceDirectory, name), content)
  }
  writeFileSync(recordPath, `${JSON.stringify(record, null, 2)}\n`)
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
      'Deployment record refused: check Spicy receipts, allowlisted artifacts and commit.',
    )
    process.exitCode = 1
  }
}

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { generate, predictionsNetwork, testnetManifest } from './predictions.mjs'

// Synthetic deployment fixture, never a configured contract address.
const address = '0x0000000000000000000000000000000000000001'
const record = (entry, chainId = 88882) => ({
  chainId, contracts: { ScoutReportPredictions: entry },
})

test('pending deployment yields no testnet data source', () => {
  assert.equal(predictionsNetwork(record(null)), null)
})

test('derives the exact address and deployment block', () => {
  const entry = predictionsNetwork(record({ address, deployBlock: 123 }))
  assert.deepEqual(entry, { address, startBlock: 123 })
  const manifest = testnetManifest(
    '    network: chiliz\n    source:\n      abi: ScoutReportPredictions\n',
    entry,
  )
  assert.match(manifest, /network: chiliz-testnet/)
  assert.match(manifest, new RegExp(`address: "${address}"`))
  assert.match(manifest, /startBlock: 123/)
})

test('fails closed for missing, wrong-chain or invalid deployments', () => {
  for (const value of [
    {}, record(undefined), record(null, 88888),
    record({ address: 'invalid', deployBlock: 123 }),
    record({ address: '0x' + '0'.repeat(40), deployBlock: 123 }),
    ...[0, -1, 1.5, '123', Number.MAX_SAFE_INTEGER + 1].map(
      (deployBlock) => record({ address, deployBlock })),
  ]) assert.throws(() => predictionsNetwork(value))
})

test('generates from the sibling deployment record and removes stale pending manifests', () => {
  const temp = mkdtempSync(join(tmpdir(), 'predictions-'))
  try {
    const directory = join(temp, 'subgraph')
    mkdirSync(join(directory, 'predictions'), { recursive: true })
    mkdirSync(join(temp, 'contracts', 'deployments'), { recursive: true })
    const deployment = join(temp, 'contracts', 'deployments', '88882.json')
    const output = join(directory, 'predictions', 'subgraph.testnet.yaml')
    writeFileSync(join(directory, 'predictions', 'subgraph.yaml'),
      '    network: chiliz\n    source:\n      abi: ScoutReportPredictions\n')
    writeFileSync(deployment, JSON.stringify(record({ address, deployBlock: 321 })))
    generate(pathToFileURL(directory + '/'))
    assert.match(readFileSync(output, 'utf8'), /startBlock: 321/)
    writeFileSync(deployment, JSON.stringify(record(null)))
    assert.equal(generate(pathToFileURL(directory + '/')), null)
    assert.equal(existsSync(output), false)
    assert.deepEqual(JSON.parse(readFileSync(join(directory, 'predictions', 'networks.json'))),
      { chiliz: {}, 'chiliz-testnet': {} })
  } finally {
    rmSync(temp, { recursive: true, force: true })
  }
})

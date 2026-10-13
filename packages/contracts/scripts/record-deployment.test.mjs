import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import {
  chmodSync,
  copyFileSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { dirname, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { buildDeploymentRecord, collectEvidence } from './record-deployment.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const gitSha = 'a'.repeat(40)
const owner = `0x${'9'.repeat(40)}`
const names = ['MockSociosStaking', 'MockFanToken18', 'MockFanToken6']
const syntheticAddress = (index) => `0x${String(index + 1).repeat(40)}`
const syntheticHash = (index) => `0x${String(index + 1).repeat(64)}`

// Synthetic receipts exercise the parser; they are not deployment evidence.
function fixture() {
  return {
    chain: 88882,
    pending: [],
    privateKey: 'DO_NOT_PUBLISH',
    transactions: names.map((name, index) => ({
      hash: syntheticHash(index),
      transactionType: 'CREATE',
      contractName: index === 0 ? name : 'MockFanToken',
      contractAddress: syntheticAddress(index),
      arguments:
        index === 0
          ? [owner]
          : [
              owner,
              `[MOCK FAN TOKEN ${index === 1 ? 18 : 6}]`,
              `MOCK${index === 1 ? 18 : 6}`,
              String(index === 1 ? 18 : 6),
            ],
      additionalContracts: [],
      transaction: {
        chainId: '0x15b32',
        input: 'DO_NOT_PUBLISH',
        privateKey: 'DO_NOT_PUBLISH',
      },
    })),
    receipts: names.map((_, index) => ({
      transactionHash: syntheticHash(index),
      contractAddress: syntheticAddress(index),
      blockNumber: `0x${(123 + index).toString(16)}`,
      status: '0x1',
      logs: ['DO_NOT_PUBLISH'],
    })),
  }
}

test('records only confirmed public fields and identifies tokens independently of order', () => {
  const broadcast = fixture()
  broadcast.transactions.reverse()
  broadcast.receipts.reverse()
  const record = buildDeploymentRecord(broadcast, gitSha)
  assert.deepEqual(Object.keys(record), [
    'chainId',
    'status',
    'gitSha',
    'contracts',
  ])
  assert.equal(record.chainId, 88882)
  assert.equal(record.status, 'DEPLOYED')
  assert.equal(record.gitSha, gitSha)
  names.forEach((name, index) => {
    assert.deepEqual(record.contracts[name], {
      address: syntheticAddress(index),
      deployBlock: 123 + index,
      transactionHash: syntheticHash(index),
    })
  })
  assert.ok(!JSON.stringify(record).includes('DO_NOT_PUBLISH'))
})

const invalidCases = {
  'Mainnet broadcast': (b) => {
    b.chain = 88888
  },
  'wrong transaction chain': (b) => {
    b.transactions[0].transaction.chainId = '0x1'
  },
  'missing transaction chain': (b) => {
    delete b.transactions[0].transaction.chainId
  },
  'missing broadcast chain': (b) => {
    delete b.chain
  },
  'failed receipt': (b) => {
    b.receipts[0].status = '0x0'
  },
  'missing receipt status': (b) => {
    delete b.receipts[0].status
  },
  'pending transaction': (b) => {
    b.pending.push(syntheticHash(0))
  },
  'missing pending confirmation': (b) => {
    delete b.pending
  },
  'missing receipt': (b) => {
    b.receipts.pop()
  },
  'extra receipt': (b) => {
    b.receipts.push(b.receipts[0])
  },
  'extra transaction': (b) => {
    b.transactions.push(b.transactions[0])
  },
  'duplicate receipt': (b) => {
    b.receipts[1] = b.receipts[0]
  },
  'missing matching receipt': (b) => {
    b.receipts[0].transactionHash = syntheticHash(3)
  },
  'duplicate mock': (b) => {
    b.transactions[2].arguments = b.transactions[1].arguments
  },
  'unknown contract': (b) => {
    b.transactions[0].contractName = 'Scaffold'
  },
  'wrong token name': (b) => {
    b.transactions[1].arguments[1] = 'Unapproved token'
  },
  'wrong token symbol': (b) => {
    b.transactions[1].arguments[2] = 'OTHER'
  },
  'wrong decimals': (b) => {
    b.transactions[1].arguments[3] = '0'
  },
  'non-creation transaction': (b) => {
    b.transactions[0].transactionType = 'CALL'
  },
  'additional deployment': (b) => {
    b.transactions[0].additionalContracts = [{}]
  },
  'zero address': (b) => {
    b.transactions[0].contractAddress = `0x${'0'.repeat(40)}`
  },
  'malformed address': (b) => {
    b.transactions[0].contractAddress = owner.slice(0, -1)
  },
  'mismatched address': (b) => {
    b.receipts[0].contractAddress = owner
  },
  'reused address': (b) => {
    b.transactions[1].contractAddress = b.transactions[0].contractAddress
    b.receipts[1].contractAddress = b.receipts[0].contractAddress
  },
  'malformed transaction hash': (b) => {
    b.transactions[0].hash = '0x123'
  },
  'zero transaction hash': (b) => {
    b.transactions[0].hash = `0x${'0'.repeat(64)}`
  },
  'zero deployment block': (b) => {
    b.receipts[0].blockNumber = '0x0'
  },
  'unsafe block number': (b) => {
    b.receipts[0].blockNumber = '9007199254740992'
  },
  'fractional block number': (b) => {
    b.receipts[0].blockNumber = 1.5
  },
  'negative block number': (b) => {
    b.receipts[0].blockNumber = -1
  },
}

for (const [name, mutate] of Object.entries(invalidCases)) {
  test(`refuses ${name}`, () => {
    const broadcast = fixture()
    mutate(broadcast)
    assert.throws(() => buildDeploymentRecord(broadcast, gitSha))
  })
}

test('refuses invalid source commit hashes', () => {
  for (const sha of ['', 'main', 'a'.repeat(39), 'g'.repeat(40), null]) {
    assert.throws(() => buildDeploymentRecord(fixture(), sha))
  }
})

test('accepts raw and JSON-quoted constructor strings without changing the record', () => {
  const broadcast = fixture()
  for (const transaction of broadcast.transactions.slice(1)) {
    transaction.arguments[1] = JSON.stringify(transaction.arguments[1])
    transaction.arguments[2] = JSON.stringify(transaction.arguments[2])
  }
  assert.deepEqual(
    buildDeploymentRecord(broadcast, gitSha),
    buildDeploymentRecord(fixture(), gitSha),
  )
})

test('refuses malformed and double-encoded constructor strings', () => {
  for (const value of [
    '"MOCK18',
    JSON.stringify(JSON.stringify('MOCK18')),
    JSON.stringify('OTHER'),
    null,
  ]) {
    const broadcast = fixture()
    broadcast.transactions[1].arguments[2] = value
    assert.throws(() => buildDeploymentRecord(broadcast, gitSha))
  }
})

test('accepts safe decimal receipt quantities and normalises hexadecimal case', () => {
  const broadcast = fixture()
  broadcast.transactions[0].contractAddress = `0x${'A'.repeat(40)}`
  broadcast.receipts[0].contractAddress = `0x${'a'.repeat(40)}`
  broadcast.receipts[0].blockNumber = '123'
  broadcast.receipts[0].status = 1
  assert.equal(
    buildDeploymentRecord(broadcast, gitSha).contracts.MockSociosStaking
      .address,
    `0x${'a'.repeat(40)}`,
  )
})

test('evidence has only allowlisted ABI, flattened source and commit hash', () => {
  const artifactsRead = []
  const sourcesFlattened = []
  const evidence = collectEvidence(gitSha, {
    readArtifact: (name) => {
      artifactsRead.push(name)
      return {
        abi: [
          {
            type: 'function',
            name: 'example',
            stateMutability: 'view',
            inputs: [],
            outputs: [
              {
                type: 'tuple',
                name: '',
                components: [
                  {
                    type: 'uint256',
                    name: 'value',
                    privateKey: 'DO_NOT_PUBLISH',
                  },
                ],
              },
            ],
            privateKey: 'DO_NOT_PUBLISH',
          },
        ],
        bytecode: 'DO_NOT_PUBLISH',
      }
    },
    flatten: (source) => {
      sourcesFlattened.push(source)
      return `pragma solidity 0.8.30;\ncontract ${source.includes('MockSociosStaking') ? 'MockSociosStaking' : 'MockFanToken'} {}\n`
    },
  })
  assert.deepEqual(artifactsRead, ['MockSociosStaking', 'MockFanToken'])
  assert.deepEqual(sourcesFlattened, [
    'src/mocks/MockSociosStaking.sol',
    'src/mocks/MockFanToken.sol',
  ])
  assert.deepEqual(Object.keys(evidence), [
    'commit.txt',
    'MockSociosStaking.abi.json',
    'MockSociosStaking.flattened.sol',
    'MockFanToken.abi.json',
    'MockFanToken.flattened.sol',
  ])
  assert.equal(evidence['commit.txt'], `${gitSha}\n`)
  assert.ok(!JSON.stringify(evidence).includes('DO_NOT_PUBLISH'))
})

test('refuses missing or malformed verification evidence', () => {
  const flatten = () => 'pragma solidity 0.8.30;\ncontract MockSociosStaking {}'
  for (const artifact of [
    {},
    { abi: [] },
    { abi: [null] },
    { abi: [{ type: 'function', inputs: 'bad' }] },
  ]) {
    assert.throws(() =>
      collectEvidence(gitSha, { readArtifact: () => artifact, flatten }),
    )
  }
  assert.throws(() =>
    collectEvidence(gitSha, {
      readArtifact: () => ({ abi: [{ type: 'constructor', inputs: [] }] }),
      flatten: () => '',
    }),
  )
})

test('CLI failure does not print raw broadcast data or create deployment evidence', () => {
  const directory = resolve(root, `.record-deployment-test-${process.pid}`)
  mkdirSync(directory)
  try {
    const broadcast = resolve(directory, 'malformed.json')
    writeFileSync(broadcast, 'DO_NOT_PUBLISH')
    const actualSha = spawnSync('git', ['rev-parse', 'HEAD'], {
      cwd: root,
      encoding: 'utf8',
    }).stdout.trim()
    const result = spawnSync(
      process.execPath,
      [resolve(root, 'scripts/record-deployment.mjs'), broadcast, actualSha],
      {
        cwd: root,
        encoding: 'utf8',
      },
    )
    assert.equal(result.status, 1)
    assert.equal(result.stdout, '')
    assert.match(result.stderr, /Deployment record refused/)
    assert.ok(!result.stderr.includes('DO_NOT_PUBLISH'))
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('CLI writes only the sanitised record and allowlisted evidence', () => {
  const directory = resolve(
    root,
    `.record-deployment-success-test-${process.pid}`,
  )
  mkdirSync(resolve(directory, 'scripts'), { recursive: true })
  mkdirSync(resolve(directory, 'bin'))
  try {
    const script = resolve(directory, 'scripts/record-deployment.mjs')
    copyFileSync(resolve(root, 'scripts/record-deployment.mjs'), script)
    const broadcast = resolve(directory, 'broadcast.json')
    writeFileSync(broadcast, JSON.stringify(fixture()))
    for (const name of ['MockSociosStaking', 'MockFanToken']) {
      const artifactDirectory = resolve(directory, 'out', `${name}.sol`)
      mkdirSync(artifactDirectory, { recursive: true })
      writeFileSync(
        resolve(artifactDirectory, `${name}.json`),
        JSON.stringify({
          abi: [
            { type: 'constructor', inputs: [], stateMutability: 'nonpayable' },
          ],
          privateKey: 'DO_NOT_PUBLISH',
        }),
      )
    }
    const forge = resolve(directory, 'bin/forge')
    writeFileSync(
      forge,
      '#!/bin/sh\ncase "$2" in\n' +
        '  src/mocks/MockSociosStaking.sol) printf "pragma solidity 0.8.30;\\ncontract MockSociosStaking {}\\n" ;;\n' +
        '  src/mocks/MockFanToken.sol) printf "pragma solidity 0.8.30;\\ncontract MockFanToken {}\\n" ;;\n' +
        '  *) exit 1 ;;\nesac\n',
    )
    chmodSync(forge, 0o755)
    const actualSha = spawnSync('git', ['rev-parse', 'HEAD'], {
      cwd: root,
      encoding: 'utf8',
    }).stdout.trim()
    const result = spawnSync(process.execPath, [script, broadcast, actualSha], {
      cwd: directory,
      env: {
        ...process.env,
        PATH: `${resolve(directory, 'bin')}:${process.env.PATH}`,
      },
      encoding: 'utf8',
    })
    assert.equal(result.status, 0, result.stderr)
    assert.equal(result.stdout, '')
    assert.equal(result.stderr, '')
    const deployment = JSON.parse(
      readFileSync(resolve(directory, 'deployments/88882.json'), 'utf8'),
    )
    assert.deepEqual(deployment, buildDeploymentRecord(fixture(), actualSha))
    assert.deepEqual(readdirSync(resolve(directory, 'deployments')).sort(), [
      '88882.json',
      'evidence',
    ])
    const evidenceDirectory = resolve(directory, 'deployments/evidence/88882')
    assert.equal(readdirSync(evidenceDirectory).length, 5)
    assert.equal(
      readFileSync(resolve(evidenceDirectory, 'commit.txt'), 'utf8'),
      `${actualSha}\n`,
    )
    for (const file of readdirSync(evidenceDirectory)) {
      assert.ok(
        !readFileSync(resolve(evidenceDirectory, file), 'utf8').includes(
          'DO_NOT_PUBLISH',
        ),
      )
    }
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('workflow is dispatch-only, reuses pinned actions and stages only public evidence', () => {
  const repo = resolve(root, '../..')
  const workflow = readFileSync(
    resolve(repo, '.github/workflows/deploy-contracts.yml'),
    'utf8',
  )
  const ci = readFileSync(resolve(repo, '.github/workflows/ci.yml'), 'utf8')
  const triggers = workflow.split('\non:\n')[1].split('\npermissions:')[0]
  assert.match(triggers, /^  workflow_dispatch:/)
  assert.doesNotMatch(
    triggers,
    /\n  (?:push|pull_request|schedule|workflow_call):/,
  )
  assert.match(triggers, /options:\n          - spicy\n/)
  for (const [, action] of workflow.matchAll(/uses: ([^\s]+)/g)) {
    assert.match(action, /@[a-f0-9]{40}$/)
    assert.ok(ci.includes(`uses: ${action}`))
  }
  assert.match(workflow, /environment: spicy/)
  assert.match(workflow, /if: github\.ref == 'refs\/heads\/main'/)
  assert.match(workflow, /persist-credentials: false/)
  assert.match(workflow, /pull-requests: write/)
  assert.match(workflow, /contents: write/)
  assert.equal(workflow.match(/GH_TOKEN:/g).length, 1)
  assert.match(workflow, /--title "SR-16:/)
  assert.match(workflow, /> broadcast\/workflow\.log 2>&1/)
  assert.ok(workflow.includes('echo "::add-mask::$SPICY_DEPLOYER_PRIVATE_KEY"'))
  assert.ok(
    workflow.indexOf('echo "::add-mask::$SPICY_DEPLOYER_PRIVATE_KEY"') <
      workflow.indexOf('if ! forge script'),
  )
  const staged = workflow
    .split('git add -- \\\n')[1]
    .split('\n          git config')[0]
  assert.equal(staged.match(/packages\/contracts\/deployments\//g).length, 6)
  assert.doesNotMatch(staged, /broadcast|out\/|git add \./)
})

test('workflow explicitly rejects non-Spicy and non-dispatch execution', () => {
  const workflow = readFileSync(
    resolve(root, '../../.github/workflows/deploy-contracts.yml'),
    'utf8',
  )
  const guard = workflow
    .split('        run: |\n')[1]
    .split('\n      - uses:')[0]
  for (const [event, network, status] of [
    ['workflow_dispatch', 'spicy', 0],
    ['workflow_dispatch', 'mainnet', 1],
    ['workflow_dispatch', '', 1],
    ['push', 'spicy', 1],
  ]) {
    const result = spawnSync('bash', ['-e', '-c', guard], {
      env: {
        ...process.env,
        GITHUB_EVENT_NAME: event,
        REQUESTED_NETWORK: network,
      },
      encoding: 'utf8',
    })
    assert.equal(result.status, status)
  }
})

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { deploy } from './deploy.mjs'

const env = {
  SUBGRAPH_NAME: 'test-index',
  VERSION: 'test-version',
  GOLDSKY_API_KEY: 'synthetic-test-value',
}

test('authenticates and deploys Mainnet build without exposing command output', () => {
  const calls = []
  deploy('chiliz', env, (...args) => {
    calls.push(args)
    return { status: 0 }
  })
  assert.deepEqual(calls, [
    ['goldsky', ['login', '--token', env.GOLDSKY_API_KEY], { stdio: 'ignore' }],
    [
      'goldsky',
      ['subgraph', 'deploy', 'test-index/test-version', '--path', './build'],
      { stdio: 'ignore' },
    ],
  ])
})

test('rejects testnet, invalid identifiers and absent credentials before spawning', () => {
  const spawn = () => assert.fail('Must not invoke provider')
  assert.throws(() => deploy('chiliz-testnet', env, spawn), /Only chiliz/)
  for (const name of [
    '',
    '../path',
    '--flag',
    'name/version',
    'name;command',
  ]) {
    assert.throws(
      () => deploy('chiliz', { ...env, SUBGRAPH_NAME: name }, spawn),
      /identifiers/,
    )
    assert.throws(
      () => deploy('chiliz', { ...env, VERSION: name }, spawn),
      /identifiers/,
    )
  }
  assert.throws(
    () => deploy('chiliz', { ...env, GOLDSKY_API_KEY: '' }, spawn),
    /required/,
  )
})

test('stops on login failure and redacts provider error content', () => {
  let count = 0
  assert.throws(
    () =>
      deploy('chiliz', env, () => {
        count++
        return { status: 1, error: new Error(env.GOLDSKY_API_KEY) }
      }),
    /^Error: Goldsky command failed; inspect the provider privately$/,
  )
  assert.equal(count, 1)
})

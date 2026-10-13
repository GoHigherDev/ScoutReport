import { Address, BigInt, ethereum } from '@graphprotocol/graph-ts'
import {
  assert,
  beforeEach,
  clearStore,
  createMockedFunction,
  dataSourceMock,
  newMockEvent,
  test,
} from 'matchstick-as/assembly/index'
import { Holding } from '../generated/schema'
import { Transfer } from '../generated/templates/FanToken/ERC20'
import { Stake, Unstake } from '../generated/Staking/Staking'
import { AFC, NAVI, STAKING, ZERO } from '../src/holdings'
import { handleTransfer, initialiseToken } from '../src/mapping'
import { handleStake, handleUnstake } from '../src/staking'

// Synthetic wallets are test fixtures, not deployed contracts.
const ALICE = '0x0000000000000000000000000000000000000001'
const BOB = '0x0000000000000000000000000000000000000002'

function mockMetadata(token: string, symbol: string, decimals: i32): void {
  const address = Address.fromString(token)
  createMockedFunction(address, 'symbol', 'symbol():(string)').returns([
    ethereum.Value.fromString(symbol),
  ])
  createMockedFunction(address, 'decimals', 'decimals():(uint8)').returns([
    ethereum.Value.fromI32(decimals),
  ])
}

function transfer(
  token: string,
  from: string,
  to: string,
  amount: string,
  timestamp: i32 = 100,
): void {
  const event = changetype<Transfer>(newMockEvent())
  event.address = Address.fromString(token)
  event.block.timestamp = BigInt.fromI32(timestamp)
  event.parameters = [
    new ethereum.EventParam(
      'from',
      ethereum.Value.fromAddress(Address.fromString(from)),
    ),
    new ethereum.EventParam(
      'to',
      ethereum.Value.fromAddress(Address.fromString(to)),
    ),
    new ethereum.EventParam(
      'value',
      ethereum.Value.fromUnsignedBigInt(BigInt.fromString(amount)),
    ),
  ]
  handleTransfer(event)
}

function stakingEvent(token: string, user: string, amount: string): Stake {
  const event = changetype<Stake>(newMockEvent())
  event.address = Address.fromString(STAKING)
  event.block.timestamp = BigInt.fromI32(200)
  event.parameters = [
    new ethereum.EventParam(
      'staker',
      ethereum.Value.fromAddress(Address.fromString(user)),
    ),
    new ethereum.EventParam(
      'token',
      ethereum.Value.fromAddress(Address.fromString(token)),
    ),
    new ethereum.EventParam(
      'amount',
      ethereum.Value.fromUnsignedBigInt(BigInt.fromString(amount)),
    ),
  ]
  return event
}

function unstake(token: string, user: string, amount: string): void {
  const event = changetype<Unstake>(stakingEvent(token, user, amount))
  event.block.timestamp = BigInt.fromI32(300)
  event.parameters.push(
    new ethereum.EventParam(
      'claimableAt',
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(604800)),
    ),
  )
  handleUnstake(event)
}

function balances(
  token: string,
  user: string,
  liquid: string,
  staked: string,
  rating: string,
): void {
  const id = token + '-' + user
  assert.fieldEquals('Holding', id, 'liquid', liquid)
  assert.fieldEquals('Holding', id, 'staked', staked)
  assert.fieldEquals('Holding', id, 'scoutRating', rating)
}

beforeEach(() => {
  clearStore()
  mockMetadata(NAVI, 'NAVI', 6)
  mockMetadata(AFC, 'AFC', 18)
})

test('creates one FanToken template for each configured source', () => {
  dataSourceMock.setAddressAndNetwork(NAVI, 'chiliz')
  initialiseToken(newMockEvent().block)
  dataSourceMock.setAddressAndNetwork(AFC, 'chiliz')
  initialiseToken(newMockEvent().block)
  assert.dataSourceCount('FanToken', 2)
  assert.dataSourceExists('FanToken', NAVI)
  assert.dataSourceExists('FanToken', AFC)
  dataSourceMock.resetValues()
})

test('mint reads on-chain metadata and preserves BigInt precision', () => {
  transfer(NAVI, ZERO, ALICE, '9007199254740993123456789')
  balances(
    NAVI,
    ALICE,
    '9007199254740993123456789',
    '0',
    '9007199254740993123456789',
  )
  assert.fieldEquals('Token', NAVI, 'symbol', 'NAVI')
  assert.fieldEquals('Token', NAVI, 'decimals', '6')
  assert.fieldEquals('Account', ALICE, 'id', ALICE)
  assert.fieldEquals('Holding', NAVI + '-' + ALICE, 'token', NAVI)
  assert.fieldEquals('Holding', NAVI + '-' + ALICE, 'account', ALICE)
  assert.fieldEquals('Holding', NAVI + '-' + ALICE, 'firstAcquiredAt', '100')
  balances(NAVI, ZERO, '0', '0', '0')
  assert.fieldEquals('Holding', NAVI + '-' + ZERO, 'isExcluded', 'true')
})

test('transfer, self-transfer and burn preserve balances and acquisition time', () => {
  transfer(NAVI, ZERO, ALICE, '100')
  transfer(NAVI, ALICE, BOB, '40', 110)
  transfer(NAVI, ALICE, ALICE, '10', 120)
  transfer(NAVI, BOB, ZERO, '15', 130)
  balances(NAVI, ALICE, '60', '0', '60')
  balances(NAVI, BOB, '25', '0', '25')
  balances(NAVI, ZERO, '0', '0', '0')
  assert.fieldEquals('Holding', NAVI + '-' + ALICE, 'firstAcquiredAt', '100')
  assert.fieldEquals('Holding', NAVI + '-' + ALICE, 'updatedAt', '120')
  assert.fieldEquals('Holding', NAVI + '-' + BOB, 'firstAcquiredAt', '110')
  assert.fieldEquals('Holding', NAVI + '-' + BOB, 'updatedAt', '130')
})

test('zero transfers do not count as first acquisition; reacquisition keeps the first time', () => {
  transfer(NAVI, ALICE, BOB, '0')
  const empty = Holding.load(NAVI + '-' + BOB)!
  assert.assertTrue(empty.firstAcquiredAt === null)
  transfer(NAVI, ZERO, BOB, '10', 150)
  transfer(NAVI, BOB, ZERO, '10', 160)
  transfer(NAVI, ZERO, BOB, '5', 170)
  assert.fieldEquals('Holding', NAVI + '-' + BOB, 'firstAcquiredAt', '150')
})

test('NAVI and AFC holdings remain separate', () => {
  transfer(NAVI, ZERO, ALICE, '10')
  transfer(AFC, ZERO, ALICE, '20')
  balances(NAVI, ALICE, '10', '0', '10')
  balances(AFC, ALICE, '20', '0', '20')
  assert.fieldEquals('Token', AFC, 'decimals', '18')
  assert.entityCount('Token', 2)
  assert.entityCount('Account', 2)
})

test('stake and unstake update rating without double-counting token transfers', () => {
  transfer(AFC, ZERO, ALICE, '100')
  transfer(AFC, ALICE, STAKING, '60', 200)
  handleStake(stakingEvent(AFC, ALICE, '60'))
  balances(AFC, ALICE, '40', '60', '100')
  balances(AFC, STAKING, '60', '0', '60')
  assert.fieldEquals('Holding', AFC + '-' + STAKING, 'isExcluded', 'true')
  assert.fieldEquals('Holding', AFC + '-' + ALICE, 'isExcluded', 'false')
  unstake(AFC, ALICE, '20')
  balances(AFC, ALICE, '40', '40', '80')
  assert.fieldEquals('Holding', AFC + '-' + ALICE, 'updatedAt', '300')
  // Claimable/pending amounts do not count; only the eventual Transfer restores liquid.
  transfer(AFC, STAKING, ALICE, '20', 400)
  balances(AFC, ALICE, '60', '40', '100')
  assert.fieldEquals('Holding', AFC + '-' + ALICE, 'firstAcquiredAt', '100')
})

test('stake can be the first acquisition; other tokens are ignored', () => {
  handleStake(stakingEvent(NAVI, ALICE, '5'))
  assert.fieldEquals('Holding', NAVI + '-' + ALICE, 'firstAcquiredAt', '200')
  handleStake(stakingEvent(BOB, ALICE, '100'))
  unstake(BOB, ALICE, '50')
  assert.entityCount('Token', 1)
  assert.entityCount('Holding', 1)
})

test('exclusion also applies to staking event holdings', () => {
  handleStake(stakingEvent(NAVI, ZERO, '5'))
  handleStake(stakingEvent(NAVI, STAKING, '5'))
  assert.fieldEquals('Holding', NAVI + '-' + ZERO, 'isExcluded', 'true')
  assert.fieldEquals('Holding', NAVI + '-' + STAKING, 'isExcluded', 'true')
})

test(
  'metadata failure stops indexing rather than inventing decimals',
  () => {
    createMockedFunction(
      Address.fromString(NAVI),
      'decimals',
      'decimals():(uint8)',
    ).reverts()
    transfer(NAVI, ZERO, ALICE, '1')
  },
  true,
)

test(
  'missing transfer history fails rather than publishing a negative ranking',
  () => {
    transfer(NAVI, ALICE, BOB, '1')
  },
  true,
)

test(
  'missing stake history fails rather than publishing a negative ranking',
  () => {
    unstake(NAVI, ALICE, '1')
  },
  true,
)

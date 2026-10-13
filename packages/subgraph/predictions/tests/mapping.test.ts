import { Address, BigInt, Bytes, ethereum } from '@graphprotocol/graph-ts'
import {
  assert,
  beforeEach,
  clearStore,
  newMockEvent,
  test,
} from 'matchstick-as/assembly/index'
import {
  MatchCreated,
  MatchSettled,
  MatchVoided,
  PointsCredited,
  Predicted,
} from '../generated/ScoutReportPredictions/ScoutReportPredictions'
import { Match, Prediction } from '../generated/schema'
import { SEASON_ID } from '../src/config'
import {
  handleMatchCreated,
  handleMatchSettled,
  handleMatchVoided,
  handlePointsCredited,
  handlePredicted,
} from '../src/mapping'

// Synthetic IDs and wallets are fixtures, not deployed contract addresses.
const FIRST = '0x' + '11'.repeat(32)
const SECOND = '0x' + '22'.repeat(32)
const ALICE = '0x0000000000000000000000000000000000000001'
const BOB = '0x0000000000000000000000000000000000000002'
const CAROL = '0x0000000000000000000000000000000000000003'
const LOCK = '1711929600'
const WEEK = '1711926000'

function matchParam(id: string): ethereum.EventParam {
  return new ethereum.EventParam(
    'matchId',
    ethereum.Value.fromFixedBytes(Bytes.fromHexString(id)),
  )
}

function create(
  id: string = FIRST,
  points: string = '7',
  lock: string = LOCK,
  outcomes: i32 = 3,
): void {
  const event = changetype<MatchCreated>(newMockEvent())
  event.parameters = [
    matchParam(id),
    new ethereum.EventParam(
      'lockTime',
      ethereum.Value.fromUnsignedBigInt(BigInt.fromString(lock)),
    ),
    new ethereum.EventParam('outcomeCount', ethereum.Value.fromI32(outcomes)),
    new ethereum.EventParam(
      'pointsForCorrect',
      ethereum.Value.fromUnsignedBigInt(BigInt.fromString(points)),
    ),
  ]
  handleMatchCreated(event)
}

function pick(user: string, outcome: i32, id: string = FIRST): void {
  const event = changetype<Predicted>(newMockEvent())
  event.parameters = [
    matchParam(id),
    new ethereum.EventParam(
      'predictor',
      ethereum.Value.fromAddress(Address.fromString(user)),
    ),
    new ethereum.EventParam('outcome', ethereum.Value.fromI32(outcome)),
  ]
  handlePredicted(event)
}

function settle(result: i32 = 0, id: string = FIRST): void {
  const event = changetype<MatchSettled>(newMockEvent())
  event.parameters = [
    matchParam(id),
    new ethereum.EventParam('result', ethereum.Value.fromI32(result)),
  ]
  handleMatchSettled(event)
}

function credit(
  from: string,
  to: string,
  id: string = FIRST,
  timestamp: string = '1800000000',
): void {
  const event = changetype<PointsCredited>(newMockEvent())
  event.block.timestamp = BigInt.fromString(timestamp)
  event.parameters = [
    matchParam(id),
    new ethereum.EventParam(
      'from',
      ethereum.Value.fromUnsignedBigInt(BigInt.fromString(from)),
    ),
    new ethereum.EventParam(
      'to',
      ethereum.Value.fromUnsignedBigInt(BigInt.fromString(to)),
    ),
  ]
  handlePointsCredited(event)
}

function points(user: string, total: string): void {
  assert.fieldEquals('UserPoints', SEASON_ID + '-' + user, 'total', total)
  assert.fieldEquals(
    'UserPoints',
    SEASON_ID + '-' + user,
    'seasonId',
    SEASON_ID,
  )
  assert.fieldEquals('UserPoints', SEASON_ID + '-' + user, 'user', user)
}

function weekly(user: string, week: string, total: string): void {
  const pointsId = SEASON_ID + '-' + user
  const id = pointsId + '-' + week
  assert.fieldEquals('WeeklyPoints', id, 'total', total)
  assert.fieldEquals('WeeklyPoints', id, 'userPoints', pointsId)
  assert.fieldEquals('WeeklyPoints', id, 'weekStart', week)
  assert.fieldEquals('WeeklyPoints', id, 'seasonId', SEASON_ID)
  assert.fieldEquals('WeeklyPoints', id, 'user', user)
}

beforeEach(() => clearStore())

test('creation preserves event configuration and nullable result', () => {
  create()
  const match = Match.load(FIRST)!
  assert.assertTrue(match.result === null)
  assert.fieldEquals('Match', FIRST, 'status', 'Open')
  assert.fieldEquals('Match', FIRST, 'lockTime', LOCK)
  assert.fieldEquals('Match', FIRST, 'outcomeCount', '3')
  assert.fieldEquals('Match', FIRST, 'pointsForCorrect', '7')
  assert.fieldEquals('Match', FIRST, 'predictorCount', '0')
  assert.fieldEquals('Match', FIRST, 'creditedCursor', '0')
})

test('changed and repeated picks preserve first-pick order and unique counts', () => {
  create()
  pick(ALICE, 1)
  pick(BOB, 0)
  pick(ALICE, 2)
  pick(ALICE, 2)
  assert.entityCount('Prediction', 2)
  assert.entityCount('PredictorIndex', 2)
  assert.entityCount('UserPoints', 2)
  assert.fieldEquals('Match', FIRST, 'predictorCount', '2')
  assert.fieldEquals('Prediction', FIRST + '-' + ALICE, 'outcome', '2')
  assert.fieldEquals('Prediction', FIRST + '-' + ALICE, 'predictorIndex', '0')
  assert.fieldEquals(
    'PredictorIndex',
    FIRST + '-0',
    'prediction',
    FIRST + '-' + ALICE,
  )
  assert.fieldEquals(
    'PredictorIndex',
    FIRST + '-1',
    'prediction',
    FIRST + '-' + BOB,
  )
  points(ALICE, '0')
})

test('settlement finalises result without prematurely crediting or marking picks', () => {
  create()
  pick(ALICE, 0)
  settle()
  assert.fieldEquals('Match', FIRST, 'status', 'Settled')
  assert.fieldEquals('Match', FIRST, 'result', '0')
  assert.assertTrue(Prediction.load(FIRST + '-' + ALICE)!.correct === null)
  assert.fieldEquals('Prediction', FIRST + '-' + ALICE, 'credited', 'false')
  points(ALICE, '0')
  assert.entityCount('WeeklyPoints', 0)
})

test('half-open partial batches advance across winners and losers exactly once', () => {
  create()
  pick(ALICE, 0)
  pick(BOB, 1)
  pick(CAROL, 0)
  settle()
  credit('0', '1')
  points(ALICE, '7')
  points(BOB, '0')
  points(CAROL, '0')
  assert.fieldEquals('Match', FIRST, 'creditedCursor', '1')
  assert.fieldEquals('Prediction', FIRST + '-' + ALICE, 'correct', 'true')
  assert.fieldEquals('Prediction', FIRST + '-' + BOB, 'credited', 'false')
  credit('1', '2')
  assert.fieldEquals('Match', FIRST, 'creditedCursor', '2')
  assert.fieldEquals('Prediction', FIRST + '-' + BOB, 'correct', 'false')
  assert.fieldEquals('Prediction', FIRST + '-' + BOB, 'credited', 'true')
  assert.entityCount('WeeklyPoints', 1)
  credit('2', '3')
  points(ALICE, '7')
  points(BOB, '0')
  points(CAROL, '7')
  weekly(ALICE, WEEK, '7')
  weekly(CAROL, WEEK, '7')
  assert.fieldEquals('Match', FIRST, 'creditedCursor', '3')
})

test('zero-sized and exhausted batches change no totals or correctness', () => {
  create()
  pick(ALICE, 0)
  settle()
  credit('0', '0')
  points(ALICE, '0')
  assert.assertTrue(Prediction.load(FIRST + '-' + ALICE)!.correct === null)
  assert.entityCount('WeeklyPoints', 0)
  credit('0', '1')
  credit('1', '1')
  credit('1', '1')
  points(ALICE, '7')
  weekly(ALICE, WEEK, '7')
  assert.fieldEquals('Match', FIRST, 'creditedCursor', '1')
})

test('all wrong outcomes process without weekly points', () => {
  create()
  pick(ALICE, 0)
  pick(BOB, 1)
  settle(2)
  credit('0', '2')
  points(ALICE, '0')
  points(BOB, '0')
  assert.fieldEquals('Prediction', FIRST + '-' + ALICE, 'correct', 'false')
  assert.fieldEquals('Prediction', FIRST + '-' + BOB, 'correct', 'false')
  assert.fieldEquals('Match', FIRST, 'creditedCursor', '2')
  assert.entityCount('WeeklyPoints', 0)
})

test('latest outcome determines credited points, including changing away from winner', () => {
  create()
  pick(ALICE, 1)
  pick(BOB, 0)
  pick(ALICE, 0)
  pick(BOB, 2)
  settle()
  credit('0', '2')
  points(ALICE, '7')
  points(BOB, '0')
  assert.fieldEquals('Match', FIRST, 'predictorCount', '2')
})

test('void retains picks and null correctness without awarding anything', () => {
  create()
  pick(ALICE, 0)
  const event = changetype<MatchVoided>(newMockEvent())
  event.parameters = [matchParam(FIRST)]
  handleMatchVoided(event)
  assert.fieldEquals('Match', FIRST, 'status', 'Voided')
  assert.assertTrue(Match.load(FIRST)!.result === null)
  assert.assertTrue(Prediction.load(FIRST + '-' + ALICE)!.correct === null)
  assert.fieldEquals('Prediction', FIRST + '-' + ALICE, 'credited', 'false')
  points(ALICE, '0')
  assert.entityCount('WeeklyPoints', 0)
})

test('event-specific points and same-week totals are shared across matches', () => {
  create(FIRST, '1', LOCK, 2)
  create(SECOND, '100', LOCK, 3)
  pick(ALICE, 1, FIRST)
  pick(ALICE, 2, SECOND)
  settle(1, FIRST)
  settle(2, SECOND)
  credit('0', '1', FIRST)
  credit('0', '1', SECOND)
  points(ALICE, '101')
  weekly(ALICE, WEEK, '101')
  assert.entityCount('UserPoints', 1)
  assert.entityCount('WeeklyPoints', 1)
  assert.entityCount('PredictorIndex', 2)
})

test('delayed credits use match lock week, not credit or settlement time', () => {
  create(FIRST, '7', '1711925999')
  create(SECOND, '9', '1711926000')
  pick(ALICE, 0, FIRST)
  pick(ALICE, 0, SECOND)
  settle(0, FIRST)
  settle(0, SECOND)
  credit('0', '1', SECOND, '1800000000')
  credit('0', '1', FIRST, '1900000000')
  points(ALICE, '16')
  weekly(ALICE, '1711324800', '7')
  weekly(ALICE, '1711926000', '9')
  assert.entityCount('WeeklyPoints', 2)
})

test('uint32 predictor counts and credit ranges do not overflow signed Int', () => {
  create()
  const match = Match.load(FIRST)!
  match.predictorCount = BigInt.fromString('4294967294')
  match.creditedCursor = BigInt.fromString('4294967294')
  match.save()
  pick(ALICE, 0)
  assert.fieldEquals('Match', FIRST, 'predictorCount', '4294967295')
  assert.fieldEquals(
    'Prediction',
    FIRST + '-' + ALICE,
    'predictorIndex',
    '4294967294',
  )
  settle()
  credit('4294967294', '4294967295')
  points(ALICE, '7')
  assert.fieldEquals('Match', FIRST, 'creditedCursor', '4294967295')
})

test('empty settled matches accept no-op credit events', () => {
  create()
  settle()
  credit('0', '0')
  assert.entityCount('Prediction', 0)
  assert.entityCount('UserPoints', 0)
  assert.entityCount('WeeklyPoints', 0)
})

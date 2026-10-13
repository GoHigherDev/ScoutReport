import { BigInt } from '@graphprotocol/graph-ts'
import {
  MatchCreated,
  MatchSettled,
  MatchVoided,
  PointsCredited,
  Predicted,
} from '../generated/ScoutReportPredictions/ScoutReportPredictions'
import {
  Match,
  Prediction,
  PredictorIndex,
  UserPoints,
  WeeklyPoints,
} from '../generated/schema'
import { SEASON_ID } from './config'
import { londonWeekStart } from './week'

export function handleMatchCreated(event: MatchCreated): void {
  const match = new Match(event.params.matchId.toHexString())
  match.status = 'Open'
  match.lockTime = event.params.lockTime
  match.outcomeCount = event.params.outcomeCount
  match.pointsForCorrect = event.params.pointsForCorrect
  match.predictorCount = BigInt.zero()
  match.creditedCursor = BigInt.zero()
  match.save()
}

export function handlePredicted(event: Predicted): void {
  const matchId = event.params.matchId.toHexString()
  const match = Match.load(matchId)!
  const user = event.params.predictor
  const id = matchId + '-' + user.toHexString()
  let prediction = Prediction.load(id)
  if (prediction === null) {
    prediction = new Prediction(id)
    prediction.match = matchId
    prediction.user = user
    prediction.predictorIndex = match.predictorCount
    prediction.credited = false
    const index = new PredictorIndex(
      matchId + '-' + match.predictorCount.toString(),
    )
    index.match = matchId
    index.index = match.predictorCount
    index.prediction = id
    index.save()
    match.predictorCount = match.predictorCount.plus(BigInt.fromI32(1))
    match.save()
    const pointsId = SEASON_ID + '-' + user.toHexString()
    if (UserPoints.load(pointsId) === null) {
      const points = new UserPoints(pointsId)
      points.seasonId = SEASON_ID
      points.user = user
      points.total = BigInt.zero()
      points.save()
    }
  }
  prediction.outcome = event.params.outcome
  prediction.save()
}

export function handleMatchSettled(event: MatchSettled): void {
  const match = Match.load(event.params.matchId.toHexString())!
  match.status = 'Settled'
  match.result = event.params.result
  match.save()
}

export function handleMatchVoided(event: MatchVoided): void {
  const match = Match.load(event.params.matchId.toHexString())!
  match.status = 'Voided'
  match.save()
}

export function handlePointsCredited(event: PointsCredited): void {
  const matchId = event.params.matchId.toHexString()
  const match = Match.load(matchId)!
  const weekStart = londonWeekStart(match.lockTime)
  for (
    let i = event.params.from;
    i.lt(event.params.to);
    i = i.plus(BigInt.fromI32(1))
  ) {
    const index = PredictorIndex.load(matchId + '-' + i.toString())!
    const prediction = Prediction.load(index.prediction)!
    if (prediction.credited) continue
    prediction.correct = prediction.outcome == match.result
    prediction.credited = true
    prediction.save()
    if (!prediction.correct) continue
    const pointsId = SEASON_ID + '-' + prediction.user.toHexString()
    const points = UserPoints.load(pointsId)!
    points.total = points.total.plus(match.pointsForCorrect)
    points.save()
    const weeklyId = pointsId + '-' + weekStart.toString()
    let weekly = WeeklyPoints.load(weeklyId)
    if (weekly === null) {
      weekly = new WeeklyPoints(weeklyId)
      weekly.userPoints = pointsId
      weekly.user = prediction.user
      weekly.seasonId = SEASON_ID
      weekly.weekStart = weekStart
      weekly.total = BigInt.zero()
    }
    weekly.total = weekly.total.plus(match.pointsForCorrect)
    weekly.save()
  }
  match.creditedCursor = event.params.to
  match.save()
}

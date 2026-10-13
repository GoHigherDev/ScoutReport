import { Stake, Unstake } from '../generated/Staking/Staking'
import { getHolding, isConfiguredToken, saveHolding } from './holdings'

export function handleStake(event: Stake): void {
  if (!isConfiguredToken(event.params.token)) return
  const holding = getHolding(event.params.token, event.params.staker)
  holding.staked = holding.staked.plus(event.params.amount)
  saveHolding(holding, event.block.timestamp)
}

export function handleUnstake(event: Unstake): void {
  if (!isConfiguredToken(event.params.token)) return
  const holding = getHolding(event.params.token, event.params.staker)
  holding.staked = holding.staked.minus(event.params.amount)
  saveHolding(holding, event.block.timestamp)
}

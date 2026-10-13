import { dataSource, ethereum } from '@graphprotocol/graph-ts'
import { Transfer } from '../generated/templates/FanToken/ERC20'
import { FanToken } from '../generated/templates'
import { ZERO, getHolding, saveHolding } from './holdings'

export function initialiseToken(_block: ethereum.Block): void {
  FanToken.create(dataSource.address())
}

export function handleTransfer(event: Transfer): void {
  const from = getHolding(event.address, event.params.from)
  if (event.params.from.toHexString() != ZERO) {
    from.liquid = from.liquid.minus(event.params.value)
  }
  saveHolding(from, event.block.timestamp)

  const to = getHolding(event.address, event.params.to)
  if (event.params.to.toHexString() != ZERO) {
    to.liquid = to.liquid.plus(event.params.value)
  }
  saveHolding(to, event.block.timestamp)
}

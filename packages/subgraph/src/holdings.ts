import { Address, BigInt } from '@graphprotocol/graph-ts'
import { Account, Holding, Token } from '../generated/schema'
import { ERC20 } from '../generated/templates/FanToken/ERC20'

export const ZERO = '0x0000000000000000000000000000000000000000'
export const STAKING = '0x5ff7f9724fd477d9a07dcdb894d0ca7f8fae1501'
export const NAVI = '0x02728748392f1875682940681f4c936fc683a68e'
export const AFC = '0x76088f3ed5dc655de9295d93868ec1eec654a615'

export function isConfiguredToken(address: Address): boolean {
  const id = address.toHexString()
  return id == NAVI || id == AFC
}

export function getHolding(tokenAddress: Address, wallet: Address): Holding {
  const tokenId = tokenAddress.toHexString()
  let token = Token.load(tokenId)
  if (token == null) {
    const contract = ERC20.bind(tokenAddress)
    token = new Token(tokenId)
    token.symbol = contract.symbol()
    token.decimals = contract.decimals()
    token.save()
  }

  const accountId = wallet.toHexString()
  let account = Account.load(accountId)
  if (account == null) {
    account = new Account(accountId)
    account.save()
  }

  const id = tokenId + '-' + accountId
  let holding = Holding.load(id)
  if (holding == null) {
    holding = new Holding(id)
    holding.token = tokenId
    holding.account = accountId
    holding.liquid = BigInt.zero()
    holding.staked = BigInt.zero()
    holding.scoutRating = BigInt.zero()
    holding.updatedAt = BigInt.zero()
    holding.isExcluded = accountId == ZERO || accountId == STAKING
  }
  return holding
}

export function saveHolding(holding: Holding, timestamp: BigInt): void {
  assert(holding.liquid.ge(BigInt.zero()), 'Incomplete liquid balance history')
  assert(holding.staked.ge(BigInt.zero()), 'Incomplete staking history')
  holding.scoutRating = holding.liquid.plus(holding.staked)
  if (
    holding.firstAcquiredAt === null &&
    holding.scoutRating.gt(BigInt.zero()) &&
    !holding.isExcluded
  ) {
    holding.firstAcquiredAt = timestamp
  }
  holding.updatedAt = timestamp
  holding.save()
}

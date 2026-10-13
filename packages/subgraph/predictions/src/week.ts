import { BigInt } from '@graphprotocol/graph-ts'

const DAY: i64 = 86400

function daysFromCivil(year: i64, month: i64, day: i64): i64 {
  const y = year - (month <= 2 ? 1 : 0)
  const era = y / 400
  const yearOfEra = y - era * 400
  const dayOfYear = (153 * (month + (month > 2 ? -3 : 9)) + 2) / 5 + day - 1
  return (
    era * 146097 +
    yearOfEra * 365 +
    yearOfEra / 4 -
    yearOfEra / 100 +
    dayOfYear -
    719468
  )
}

function yearFromDays(days: i64): i64 {
  const z = days + 719468
  const era = z / 146097
  const dayOfEra = z - era * 146097
  const yearOfEra =
    (dayOfEra - dayOfEra / 1460 + dayOfEra / 36524 - dayOfEra / 146096) / 365
  const dayOfYear =
    dayOfEra - (365 * yearOfEra + yearOfEra / 4 - yearOfEra / 100)
  const month = (5 * dayOfYear + 2) / 153
  return yearOfEra + era * 400 + (month >= 10 ? 1 : 0)
}

function lastSunday(year: i64, month: i64): i64 {
  const lastDay = daysFromCivil(year, month, 31)
  return lastDay - ((lastDay + 4) % 7)
}

function bstOffset(days: i64, seconds: i64): i64 {
  const year = yearFromDays(days)
  const start = lastSunday(year, 3)
  const end = lastSunday(year, 10)
  const afterStart = days > start || (days == start && seconds >= 3600)
  const beforeEnd = days < end || (days == end && seconds < 3600)
  return afterStart && beforeEnd ? 3600 : 0
}

/** UTC timestamp of Monday 00:00 Europe/London for the match lock time.
 * Applies the modern UK rule: last Sundays of March/October at 01:00 UTC.
 */
export function londonWeekStart(lockTime: BigInt): BigInt {
  // Divide before conversion so the contract's uint64 timestamp remains safe.
  const days = lockTime.div(BigInt.fromI64(DAY)).toI64()
  const seconds = lockTime.mod(BigInt.fromI64(DAY)).toI64()
  const localDays = days + (seconds + bstOffset(days, seconds)) / DAY
  const mondayDays = localDays - ((localDays + 3) % 7)
  // Use Monday's offset, not Sunday's: changeover weeks cross a DST boundary.
  return BigInt.fromI64(mondayDays)
    .times(BigInt.fromI64(DAY))
    .minus(BigInt.fromI64(bstOffset(mondayDays, 0)))
}

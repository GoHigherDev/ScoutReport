import { BigInt } from '@graphprotocol/graph-ts'
import { assert, test } from 'matchstick-as/assembly/index'
import { londonWeekStart } from '../src/week'

function week(timestamp: string, expected: string): void {
  assert.bigIntEquals(
    londonWeekStart(BigInt.fromString(timestamp)),
    BigInt.fromString(expected),
  )
}

test('winter Sunday to Monday boundary is UTC midnight', () => {
  week('1711324799', '1710720000')
  week('1711324800', '1711324800')
})

test('spring clock change keeps Sunday in the week whose Monday was GMT', () => {
  week('1711846799', '1711324800') // 2024-03-31 00:59:59 UTC
  week('1711846800', '1711324800') // BST begins at 01:00 UTC
  week('1711925999', '1711324800')
})

test('Monday after spring change begins Sunday at 23:00 UTC', () => {
  week('1711926000', '1711926000')
  week('1711929600', '1711926000')
})

test('autumn clock change keeps both occurrences of Sunday 01:00 in one BST-Monday week', () => {
  week('1729990799', '1729465200')
  week('1729990800', '1729465200') // 2024-10-27 01:00 UTC
  week('1730073599', '1729465200')
})

test('Monday after autumn change begins at 00:00 UTC', () => {
  week('1730073600', '1730073600')
})

test('year boundary assigns January to the previous December Monday', () => {
  week('1735732800', '1735516800')
})

test('last-Sunday rules follow the calendar rather than hard-coded dates', () => {
  week('1743375600', '1743375600') // Monday after 2025-03-30 change
  week('1761440400', '1760914800') // 2025-10-26 change
})

test('timestamps beyond signed 32-bit range and non-leap century years work', () => {
  week('4109958000', '4109958000') // 2100-03-28 23:00 UTC
})

test('full unsigned 64-bit lock timestamp does not overflow calendar arithmetic', () => {
  week('18446744073709551615', '18446744073709267200')
})

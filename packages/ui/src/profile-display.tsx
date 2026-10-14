import type { ReactNode } from 'react'

export type AddressDisplayProps = {
  address: string
  username?: string | null
  claimed?: boolean
  visible?: boolean
  showFullAddressTitle?: boolean
}

export function AddressDisplay({
  address,
  username,
  claimed = false,
  visible = false,
  showFullAddressTitle = false,
}: AddressDisplayProps) {
  return (
    <span title={showFullAddressTitle ? address : undefined}>
      {claimed && visible && username?.trim()
        ? username
        : `${address.slice(0, 6)}…${address.slice(-4)}`}
    </span>
  )
}

export type ProfileHoldingsProps = {
  claimed?: boolean
  visible?: boolean
  showHoldings?: boolean
  children: ReactNode
}

export function ProfileHoldings({
  claimed = false,
  visible = false,
  showHoldings = false,
  children,
}: ProfileHoldingsProps) {
  return claimed && visible && showHoldings ? <>{children}</> : null
}

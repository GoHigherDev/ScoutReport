import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { AddressDisplay, ProfileHoldings } from './profile-display'

afterEach(cleanup)

const address = `0x${'1234'.repeat(10)}`

describe('public profile display', () => {
  it('truncates addresses by default', () => {
    render(<AddressDisplay address={address} />)
    expect(screen.getByText('0x1234…1234').getAttribute('title')).toBe(address)
  })

  it.each([
    [false, false],
    [false, true],
    [true, false],
  ])('hides names for claimed=%s visible=%s', (claimed, visible) => {
    render(
      <AddressDisplay
        address={address}
        username="Public name"
        claimed={claimed}
        visible={visible}
      />,
    )
    expect(screen.queryByText('Public name')).toBeNull()
    expect(screen.getByText('0x1234…1234')).toBeTruthy()
  })

  it('shows the whole name only for a claimed, visible profile', () => {
    render(
      <AddressDisplay
        address={address}
        username="Public name"
        claimed
        visible
      />,
    )
    expect(screen.getByText('Public name')).toBeTruthy()
  })

  it.each([null, '', '  '])(
    'falls back for missing or blank names (%s)',
    (username) => {
      render(
        <AddressDisplay
          address={address}
          username={username}
          claimed
          visible
        />,
      )
      expect(screen.getByText('0x1234…1234')).toBeTruthy()
    },
  )

  it.each([
    {},
    { claimed: true, visible: true, showHoldings: false },
    { claimed: false, visible: true, showHoldings: true },
    { claimed: true, visible: false, showHoldings: true },
  ])('does not render public holdings without all permissions: %j', (props) => {
    const { container } = render(
      <ProfileHoldings {...props}>
        <span>Holdings</span>
      </ProfileHoldings>,
    )
    expect(container.textContent).toBe('')
  })

  it('renders public holdings only with an explicit opt-in', () => {
    render(
      <ProfileHoldings claimed visible showHoldings>
        <span>Holdings</span>
      </ProfileHoldings>,
    )
    expect(screen.getByText('Holdings')).toBeTruthy()
  })
})

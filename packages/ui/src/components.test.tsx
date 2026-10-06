import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Badge, Banner, Card, EmptyState, Skeleton, Table } from './components'

describe('base UI components', () => {
  it('renders a secondary badge with its label', () => {
    render(<Badge variant="secondary">Network</Badge>)
    expect(screen.getByText('Network')).toBeTruthy()
  })

  it('renders banner content accessibly', () => {
    render(<Banner variant="warning">Check your connection</Banner>)
    expect(screen.getByRole('status').textContent).toBe('Check your connection')
  })

  it('renders card content', () => {
    render(<Card>Card content</Card>)
    expect(screen.getByText('Card content')).toBeTruthy()
  })

  it('renders an empty state and description', () => {
    render(<EmptyState title="No results" description="Try again later" />)
    expect(screen.getByRole('heading', { name: 'No results' })).toBeTruthy()
    expect(screen.getByText('Try again later')).toBeTruthy()
  })

  it('hides decorative skeletons from assistive technology', () => {
    const { container } = render(<Skeleton />)
    expect(
      (container.firstChild as HTMLElement).getAttribute('aria-hidden'),
    ).toBe('true')
  })

  it('renders semantic tables', () => {
    render(
      <Table>
        <tbody>
          <tr>
            <td>Team</td>
          </tr>
        </tbody>
      </Table>,
    )
    expect(screen.getByRole('table')).toBeTruthy()
  })
})

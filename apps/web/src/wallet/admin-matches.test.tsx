import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { NAMES } from '../copy/names'
import { AdminMatches } from './admin-matches'

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
}))
vi.mock('@scoutreport/chain', async (original) => original())

const match = {
  id: 'd9e4d9e1-8ce3-45a7-b245-1ea7b54f55b4',
  sport: 'football',
  sides: [
    { name: 'First club', tokenKey: null },
    { name: 'Second club', tokenKey: null },
  ],
  kickoff: '2030-06-01T14:00:00.000Z',
  lockTime: '2030-06-01T14:00:00.000Z',
  outcomes: ['HOME', 'DRAW', 'AWAY'],
  pointsForCorrect: 5,
  externalRef: null,
  status: 'open',
  result: null,
  voidReason: null,
  locked: true,
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.fetch.mockImplementation(async (_path, options) =>
    Response.json(
      options?.method === 'PATCH'
        ? { score: { creditedCount: 7, totalPoints: 35 } }
        : { matches: [match] },
    ),
  )
  vi.stubGlobal('fetch', mocks.fetch)
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open')
  }
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  render(
    <QueryClientProvider client={client}>
      <AdminMatches />
    </QueryClientProvider>,
  )
}

it('confirms the selected result and posts an off-chain settlement action', async () => {
  setup()
  const card = await screen
    .findByRole('heading', {
      name: 'First club / Second club',
    })
    .then((heading) => heading.closest('section')!)
  fireEvent.change(within(card).getByLabelText(NAMES.admin.result), {
    target: { value: 'AWAY' },
  })
  fireEvent.click(
    within(card).getByRole('button', { name: NAMES.admin.settle }),
  )
  const dialog = await screen.findByRole('dialog')
  expect(
    within(dialog).getByText('First club / Second club'),
  ).toBeInTheDocument()
  expect(
    within(dialog).getByText(`${NAMES.admin.result}: AWAY`),
  ).toBeInTheDocument()
  expect(within(dialog).getByText(NAMES.admin.confirmHelp)).toBeInTheDocument()
  fireEvent.click(
    within(dialog).getByRole('button', { name: NAMES.admin.settle }),
  )
  await waitFor(() =>
    expect(mocks.fetch).toHaveBeenCalledWith(
      '/api/admin/matches',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({
          action: 'settle',
          id: match.id,
          result: 'AWAY',
        }),
      }),
    ),
  )
  expect(await screen.findByText(/Correct picks: 7/)).toBeInTheDocument()
})

it('keeps settlement closed before lock and allows editing only while open', async () => {
  mocks.fetch.mockResolvedValue(
    Response.json({
      matches: [
        { ...match, locked: false, kickoff: '2030-06-01T14:00:00.000Z' },
      ],
    }),
  )
  setup()
  const card = await screen
    .findByRole('heading', {
      name: 'First club / Second club',
    })
    .then((heading) => heading.closest('section')!)
  expect(
    within(card).getByRole('button', { name: NAMES.admin.settle }),
  ).toBeDisabled()
  fireEvent.click(within(card).getByRole('button', { name: NAMES.admin.edit }))
  expect(
    await screen.findByRole('heading', { name: NAMES.admin.edit }),
  ).toBeInTheDocument()
  expect(
    screen.getByRole('button', { name: NAMES.admin.saveChanges }),
  ).toBeInTheDocument()
})

it('requires a void reason and confirms off-chain recalculation for voids', async () => {
  setup()
  const card = await screen
    .findByRole('heading', {
      name: 'First club / Second club',
    })
    .then((heading) => heading.closest('section')!)
  fireEvent.click(within(card).getByRole('button', { name: NAMES.admin.void }))
  const dialog = await screen.findByRole('dialog')
  const confirm = within(dialog).getByRole('button', { name: NAMES.admin.void })
  expect(confirm).toBeDisabled()
  fireEvent.change(within(dialog).getByLabelText(NAMES.admin.voidReason), {
    target: { value: 'Postponed by organiser' },
  })
  expect(confirm).toBeEnabled()
})

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { decodeFunctionData, encodeErrorResult, keccak256, toHex } from 'viem'
import { SCOUTREPORT_ABIS } from '@scoutreport/chain'
import type { TransactionButtonProps } from './tx-button'
import { NAMES } from '../copy/names'
import { AdminMatches } from './admin-matches'

const mocks = vi.hoisted(() => ({
  address: vi.fn(),
  account: vi.fn(),
  read: vi.fn(),
  fetch: vi.fn(),
  requests: [] as TransactionButtonProps[],
  receiptStatus: 'success' as 'success' | 'reverted',
}))
vi.mock('wagmi', () => ({ useAccount: mocks.account }))
vi.mock('@scoutreport/chain', async (original) => ({
  ...(await original<typeof import('@scoutreport/chain')>()),
  getPredictionsAddress: mocks.address,
  getPublicClient: (chainId: number) => {
    expect(chainId).toBe(88882)
    return { readContract: mocks.read }
  },
}))
vi.mock('./tx-button', () => ({
  TransactionButton: (props: TransactionButtonProps) => {
    mocks.requests.push(props)
    return (
      <button
        disabled={props.disabled}
        onClick={() => void props.onReceipt?.(hash, mocks.receiptStatus)}
      >
        {props.label}
      </button>
    )
  },
}))
const actor = '0x0000000000000000000000000000000000000001'
const contract = '0x0000000000000000000000000000000000000002'
const hash = `0x${'1'.repeat(64)}` as const
const uuid = 'd9e4d9e1-8ce3-45a7-b245-1ea7b54f55b4'
const match = {
  id: uuid,
  matchId: keccak256(toHex(`scoutreport:${uuid}`)),
  sport: 'football',
  sides: [
    { name: 'First club', tokenKey: null },
    { name: 'Second club', tokenKey: null },
  ],
  kickoff: '2030-06-01T14:00:00.000Z',
  lockTime: '2030-06-01T14:00:00.000Z',
  outcomes: ['First club', 'Draw', 'Second club'],
  pointsForCorrect: 5,
}
const open = {
  status: 1,
  result: 0,
  predictorCount: 120,
  creditedCursor: 0,
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.requests.length = 0
  mocks.receiptStatus = 'success'
  mocks.address.mockReturnValue(contract)
  mocks.account.mockReturnValue({ address: actor, chainId: 88882 })
  mocks.read.mockResolvedValue(open)
  mocks.fetch.mockImplementation(async (_path, options) =>
    Response.json(
      options?.method === 'POST' ? { ok: true } : { matches: [match] },
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
      <AdminMatches actorAddress={actor} />
    </QueryClientProvider>,
  )
}

it('disables every on-chain action while deployment is unavailable, without RPC', async () => {
  mocks.address.mockReturnValue(undefined)
  setup()
  await screen.findByRole('heading', { name: 'First club / Second club' })
  expect(screen.getByText(NAMES.admin.unavailable)).toBeInTheDocument()
  for (const label of [
    NAMES.admin.create,
    NAMES.admin.settle,
    NAMES.admin.void,
    NAMES.admin.credit,
  ]) {
    expect(screen.getByRole('button', { name: label })).toBeDisabled()
  }
  expect(mocks.read).not.toHaveBeenCalled()
  expect(mocks.requests).toHaveLength(0)
})

it('does not load chain state if the gated list API fails', async () => {
  mocks.fetch.mockResolvedValue(new Response(null, { status: 403 }))
  setup()
  expect(await screen.findByRole('alert')).toHaveTextContent(NAMES.admin.error)
  expect(mocks.read).not.toHaveBeenCalled()
})

it('requires the session wallet on Spicy before an action can be confirmed', async () => {
  mocks.account.mockReturnValue({ address: actor, chainId: 88888 })
  setup()
  await screen.findByText(NAMES.admin.open)
  expect(screen.getByRole('button', { name: NAMES.admin.void })).toBeDisabled()
  expect(mocks.requests).toHaveLength(0)
})

it('saves validated London input without inventing points or an on-chain match', async () => {
  mocks.address.mockReturnValue(undefined)
  setup()
  fireEvent.change(screen.getByLabelText(NAMES.admin.sideOne), {
    target: { value: 'First club' },
  })
  fireEvent.change(screen.getByLabelText(NAMES.admin.sideTwo), {
    target: { value: 'Second club' },
  })
  fireEvent.change(screen.getByLabelText(NAMES.admin.kickoff), {
    target: { value: '2030-06-01T15:00' },
  })
  fireEvent.change(screen.getByLabelText(NAMES.admin.outcomes), {
    target: { value: 'First club\nDraw\nSecond club' },
  })
  fireEvent.change(screen.getByLabelText(NAMES.admin.points), {
    target: { value: '5' },
  })
  fireEvent.submit(
    screen.getByRole('button', { name: NAMES.admin.save }).closest('form')!,
  )
  await screen.findByText(NAMES.admin.saved)
  const [, options] = mocks.fetch.mock.calls.find(
    ([, options]) => options.method === 'POST',
  )!
  expect(JSON.parse(options.body)).toEqual({
    sport: 'football',
    sides: match.sides,
    kickoff: '2030-06-01T15:00',
    outcomes: match.outcomes,
    pointsForCorrect: 5,
  })
  expect(mocks.requests).toHaveLength(0)
})

it('shows the match and winning result before settlement, then offers sequential credit batches', async () => {
  const pastMatch = {
    ...match,
    kickoff: '2020-06-01T14:00:00.000Z',
    lockTime: '2020-06-01T14:00:00.000Z',
  }
  mocks.fetch.mockImplementation(async (_path, options) => {
    if (options.method === 'POST') {
      const audit = JSON.parse(options.body)
      mocks.read.mockResolvedValue({
        ...open,
        status: 2,
        result: 2,
        creditedCursor: audit.action === 'creditPoints' ? 50 : 0,
      })
      return Response.json({ ok: true })
    }
    return Response.json({ matches: [pastMatch] })
  })
  setup()
  await screen.findByText(NAMES.admin.open)
  fireEvent.change(screen.getByLabelText(NAMES.admin.result), {
    target: { value: '2' },
  })
  fireEvent.click(screen.getByRole('button', { name: NAMES.admin.settle }))
  const dialog = await screen.findByRole('dialog')
  expect(
    within(dialog).getByText('First club / Second club'),
  ).toBeInTheDocument()
  expect(
    within(dialog).getByText(`${NAMES.admin.result}: Second club`),
  ).toBeInTheDocument()
  expect(within(dialog).getByText(NAMES.admin.confirmHelp)).toBeInTheDocument()
  expect(
    decodeFunctionData({
      abi: SCOUTREPORT_ABIS[0],
      data: mocks.requests.at(-1)!.request.data!,
    }),
  ).toEqual({ functionName: 'settle', args: [match.matchId, 2] })
  fireEvent.click(
    within(dialog).getByRole('button', { name: NAMES.admin.settle }),
  )
  await waitFor(() =>
    expect(
      within(screen.getByRole('dialog')).getByText(NAMES.admin.creditHelp),
    ).toBeInTheDocument(),
  )
  expect(
    decodeFunctionData({
      abi: SCOUTREPORT_ABIS[0],
      data: mocks.requests.at(-1)!.request.data!,
    }),
  ).toEqual({ functionName: 'creditPoints', args: [match.matchId, 50n] })
  fireEvent.click(
    within(screen.getByRole('dialog')).getByRole('button', {
      name: NAMES.admin.credit,
    }),
  )
  await screen.findByText(`${NAMES.admin.progress}: 50 / 120`)
  expect(mocks.fetch).toHaveBeenCalledWith(
    '/api/admin/matches/audit',
    expect.objectContaining({
      body: JSON.stringify({
        matchId: match.matchId,
        action: 'creditPoints',
        txHash: hash,
      }),
    }),
  )
})

it('limits the final batch to the remaining predictors and shows completion', async () => {
  mocks.read.mockResolvedValue({
    ...open,
    status: 2,
    creditedCursor: 115,
  })
  setup()
  await screen.findByText(`${NAMES.admin.progress}: 115 / 120`)
  fireEvent.click(screen.getByRole('button', { name: NAMES.admin.credit }))
  const dialog = await screen.findByRole('dialog')
  expect(
    decodeFunctionData({
      abi: SCOUTREPORT_ABIS[0],
      data: mocks.requests.at(-1)!.request.data!,
    }),
  ).toEqual({ functionName: 'creditPoints', args: [match.matchId, 5n] })
  mocks.read.mockResolvedValue({
    ...open,
    status: 2,
    creditedCursor: 120,
  })
  fireEvent.click(
    within(dialog).getByRole('button', { name: NAMES.admin.credit }),
  )
  await screen.findByText(NAMES.admin.complete)
  expect(
    screen.getByRole('button', { name: NAMES.admin.credit }),
  ).toBeDisabled()
})

it('creates an unknown match from its saved metadata through the existing transaction wrapper', async () => {
  mocks.read.mockRejectedValue({
    data: encodeErrorResult({
      abi: SCOUTREPORT_ABIS[0],
      errorName: 'UnknownMatch',
      args: [match.matchId],
    }),
  })
  setup()
  await screen.findByText(NAMES.admin.draft)
  fireEvent.click(screen.getByRole('button', { name: NAMES.admin.create }))
  await screen.findByRole('dialog')
  expect(mocks.requests.at(-1)!.request.to).toBe(contract)
  expect(
    decodeFunctionData({
      abi: SCOUTREPORT_ABIS[0],
      data: mocks.requests.at(-1)!.request.data!,
    }),
  ).toEqual({
    functionName: 'createMatch',
    args: [match.matchId, BigInt(Date.parse(match.lockTime) / 1000), 3, 5],
  })
})

it('blocks writes on RPC failure rather than treating an unavailable match as a draft', async () => {
  mocks.read.mockRejectedValue(new Error('private RPC details'))
  setup()
  await screen.findByRole('alert')
  expect(
    screen.getByRole('button', { name: NAMES.admin.create }),
  ).toBeDisabled()
  expect(screen.queryByText(NAMES.admin.draft)).not.toBeInTheDocument()
})

it('retains a failed audit hash for retry and prevents another write', async () => {
  mocks.fetch.mockImplementation(async (_path, options) =>
    options.method === 'POST'
      ? new Response(null, { status: 500 })
      : Response.json({ matches: [match] }),
  )
  setup()
  await screen.findByText(NAMES.admin.open)
  fireEvent.click(screen.getByRole('button', { name: NAMES.admin.void }))
  const dialog = await screen.findByRole('dialog')
  expect(within(dialog).getByText(NAMES.admin.voidHelp)).toBeInTheDocument()
  fireEvent.click(
    within(dialog).getByRole('button', { name: NAMES.admin.void }),
  )
  await screen.findByText(NAMES.admin.auditError)
  expect(screen.getByText(hash)).toBeInTheDocument()
  fireEvent.click(
    within(dialog).getByRole('button', { name: NAMES.admin.cancel }),
  )
  expect(screen.getByRole('button', { name: NAMES.admin.void })).toBeDisabled()
  mocks.fetch.mockResolvedValue(Response.json({ ok: true }))
  fireEvent.click(screen.getByRole('button', { name: NAMES.admin.retryAudit }))
  await waitFor(() =>
    expect(screen.queryByText(NAMES.admin.auditError)).not.toBeInTheDocument(),
  )
})

it('retains a submitted hash and blocks resubmission after receipt monitoring is interrupted', async () => {
  setup()
  await screen.findByText(NAMES.admin.open)
  fireEvent.click(screen.getByRole('button', { name: NAMES.admin.void }))
  const dialog = await screen.findByRole('dialog')
  const props = mocks.requests.at(-1)!
  await act(async () => props.onSubmitted?.(hash))
  expect(
    within(dialog).getByRole('button', { name: NAMES.admin.void }),
  ).toBeDisabled()
  fireEvent.click(
    within(dialog).getByRole('button', { name: NAMES.admin.cancel }),
  )
  expect(screen.getByText(hash)).toBeInTheDocument()
  expect(screen.getByText(NAMES.admin.receiptPending)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: NAMES.admin.void })).toBeDisabled()
})

it('audits a reverted credit attempt but keeps failure visible and does not start another batch', async () => {
  mocks.receiptStatus = 'reverted'
  mocks.read.mockResolvedValue({
    ...open,
    status: 2,
    creditedCursor: 50,
  })
  setup()
  await screen.findByText(`${NAMES.admin.progress}: 50 / 120`)
  fireEvent.click(screen.getByRole('button', { name: NAMES.admin.credit }))
  const dialog = await screen.findByRole('dialog')
  fireEvent.click(
    within(dialog).getByRole('button', { name: NAMES.admin.credit }),
  )
  await waitFor(() =>
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
  )
  expect(screen.getByRole('alert')).toHaveTextContent(NAMES.gas.failed)
  expect(
    screen.getByText(`${NAMES.admin.progress}: 50 / 120`),
  ).toBeInTheDocument()
  expect(mocks.fetch).toHaveBeenCalledWith(
    '/api/admin/matches/audit',
    expect.objectContaining({
      body: JSON.stringify({
        matchId: match.matchId,
        action: 'creditPoints',
        txHash: hash,
      }),
    }),
  )
})

# ScoutReport

ScoutReport is a third-party SportFi dapp on Chiliz Chain that adds utility on
top of Socios.com Fan Tokens. It is not affiliated with Socios.

For NAVI/AFC indexing, deployment commands and GraphQL examples, see the
[Scout Rating subgraph guide](packages/subgraph/README.md).

For the points-only prediction contract, roles, pagination and Spicy deployment
instructions, see [SR-42 predictions](docs/contracts/predictions.md).

For Rewards Optimizer data availability, read-only research commands and
outstanding access/copy gates, see [SR-50 research](docs/research/optimiser-data-access.md)
and [ADR 0003](docs/adr/0003-optimiser-data-strategy.md).

For Spicy preview/staging on Vercel and the read-only Mainnet indexer, see the
[environment matrix](docs/environments.md) and
[deployment runbook](docs/runbooks/deploy.md). Preview/staging must retain Vercel
Authentication until SR-63; production/Mainnet rollout is deferred to SR-64.

## Prerequisites

- Node.js LTS (22 or newer; Node 24 is selected in `.nvmrc`)
- pnpm 10 (`corepack enable` can make pnpm available with Node.js)
- Foundry for the Solidity project and its tests

## Getting started

```sh
pnpm install
pnpm dev
```

The web app runs at <http://localhost:3000>. Copy `.env.example` to `apps/web/.env.local`
and fill in only values for services you have configured. Set
`NEXT_PUBLIC_SITE_URL` to the public site origin for production Open Graph links;
it defaults to `http://localhost:3000` when left empty. Do not commit secrets.

## Wallet shell

Set `NEXT_PUBLIC_REOWN_PROJECT_ID` in the ignored `apps/web/.env.local` and
allow the site origin in Reown to enable AppKit, injected wallets (including
MetaMask), WalletConnect QR and the featured Socios.com Wallet. Without an ID,
the app still builds and renders with a disabled connect button and notice.
The wagmi adapter and hooks share a pinned `@wagmi/core`; the WalletConnect
provider peer is pinned to avoid older React-incompatible dependencies.

The header shows the connected address and network and offers `ensureChain`
switching to APP_CHAIN. Holdings read every configured Mainnet token in
Multicall3 batches only while connected, skip tokens without a Mainnet address
and display only non-zero held/staked amounts. Metadata and decimals come from
`readTokenMeta`; Scout Rating is held + staked. Staking refreshes use read-only
`eth_call`, never a transaction. Staked amounts are not Reward Points.
`useWalletKind()` checks code on DATA_CHAIN for future ERC-1271 flows; it does
not identify a wallet brand. SR-14 adds a minimal [SIWE sign-in helper and auth
routes](docs/auth.md), using personal_sign and read-only ERC-1271 verification.
No Partner API is included.

See [the manual wallet QA matrix](docs/qa/wallet.md) for desktop/mobile checks.

## Rewards Optimizer

SR-51 adds `/optimiser`, using the same client-side Mainnet portfolio query as
the holdings strip, even when APP_CHAIN is Spicy. It lists configured tokens
with non-zero Held or Staked balances, plus unavailable rows for failed reads.
Held and Unstaked both mean liquid `balanceOf`, not pending unstake; Staked uses
`totalStake` and Scout Rating is Held + Staked, formatted with on-chain decimals.
Balance/stake reads share the displayed capture block. Token metadata is cached
and read once per token; one failed token does not discard successful rows.

Liquid-only rows show the approved Socios.com staking prompt. SR-53 adds a shared
warning banner on every `/optimiser/*` page, including when disconnected. It
shows the approved external-wallet RP caveat once; the other three approved
research caveats remain in the checklist. The banner links to the Socios Connect
staking guide and Help Centre RP/voting articles.

SR-61 adds a static, wallet-independent RP route list. Fan Token staking through
the Socios app is source-confirmed and links to the official staking guide with
a short how-to. Fan Zone tasks, polls, quizzes and check-ins are **Unconfirmed**
as RP routes: their research links explain the evidence limits, not earning
instructions. Evidence that a poll exists or can be voted on does not confirm
RP earning. All route copy and the typed route constant live in
`apps/web/src/copy/names.ts`. The list adds no API, polling, database or RPC work,
and no RP amounts, cost-per-point comparisons, rankings or reward promises.

The existing client-side `useWalletKind()` Mainnet account-code read supplies
context only: EOA shows an account-type note; code presence shows the
conditional smart-account note. Loading or failed reads show no wallet-type
note. Neither code (including EIP-7702 delegation) nor connector choice verifies
Socios Wallet identity or RP eligibility. Results stay fresh indefinitely while
cached and are retained for 30 minutes after the last observer unmounts, keyed by
DATA_CHAIN and address. Remounts, focus and reconnects do not trigger automatic
code reads; a new address triggers one read. Brave approved the banner sentence
and both notes on 13 October 2026 at 18:38 UK; SR-56's later clarification
supersedes the EOA note's external-wallet inference. Link labels still require approval.

SR-56 adds staking coverage and the read-only current-holdings RP Estimate panel.
`FEATURE_RP_ESTIMATE` is a **server-only** flag, defaulting to `false` everywhere;
only the exact value `true` can enable the panel. Production additionally requires
server-only `RP_ESTIMATE_LEGAL_SIGNOFF=true`. Production means
`VERCEL_ENV=production`, or `NODE_ENV=production` unless `VERCEL_ENV=preview`;
Vercel previews can opt in without legal sign-off. There is no geo-block.
`/optimiser` reads these settings at request time; Turbo includes both flags,
`VERCEL_ENV` and `NODE_ENV` in its environment/cache key. No estimates or extra
snapshot reads run when it is off. With the flag on, users can declare that the
connected address is their Socios Wallet. This is not identity verification.
The declaration defaults off, is saved per address in this browser's
`localStorage`, and is never sent to a server, RPC provider or analytics service.
Switching hides all figures immediately; disconnecting hides the entire panel,
but keeps the persistent caveats. There is no address input,
public-profile panel, sign-in, session, signature or database write.

**No measured calibration has been supplied.** `RP_CALIBRATIONS` in
`apps/web/src/wallet/rp-model.ts` deliberately ships empty: enabling the panel
does not manufacture RP figures. A follow-up must provide provenance-reviewed
per-token theta, residuals, distinct-wallet/report-day counts, holdout error,
calibration dates/block and an approved pool-drift tolerance. An optional supplied
`driftAlert` represents an explicitly open calibration drift alert; it is not an
automatically invented alert policy. Required gates are
at least five distinct wallets, seven report days within a fourteen-day window,
and holdout error at most 25%. These are quality thresholds, not RP values.
Report collection/fitting is **not** part of SR-56. Synthetic calibrations exist
only in tests; no default pool parameter, report API or private Socios source
exists.

For future supplied calibration, the tested client read path reuses the existing
public Mainnet log client (PublicNode, no transport retries/fallback) and finds the last block
**strictly before** midnight UTC and pins wallet `totalStake`, `getTotalStake` and
on-chain decimals to that block. Pending unstake never increases stake.
The daily estimate is S/T × theta, not official Socios data; the per-token figure
divides it by current held + staked tokens, never by projected purchases or future
staking. A whole active token is required both currently and at the snapshot.
External-wallet model inputs and CHZ are explicitly ineligible and only return
zero with the caveat, never a modelled earning rate. EOA/contract code remains
context, not brand proof; an undeclared address has no figures.

Snapshot failures and upgrades after calibration hide figures; an upgrade
requires verified replacement calibration before estimates resume. Browser caches
bound midnight/midpoint, token/day/block-hash pool and wallet snapshots; reorg
checks prevent reuse of a changed snapshot. There are no new DB/RPC endpoints,
automatic polling or retries. A presentation-only timer widens stale ranges and
hides yesterday's snapshot at midnight; refreshing it requires a user action
(or a new portfolio capture). Snapshots fail closed unless their boundary is the
current day's midnight UTC: yesterday's snapshot is unavailable, not merely a
wider estimate. Freshness uses calibration time and the actual snapshot read/
verification time (`readAt`), not the midnight boundary as a read timestamp.
Calibration or reads aged at least 24 hours, an explicitly open drift alert, or
pool drift beyond the approved tolerance use P5/P95 instead of P10/P90 and show
“recalibrating”. Holdout residuals are **log residuals**, ln(actual / predicted),
not additive RP errors. With central = S/T × theta, each band endpoint is
central × exp(q × sqrt(1 + 1 / distinct reporters)), where q is its holdout log
residual quantile. The small-sample factor widens the band in log space; interval
bounds also include the central estimate. Overflow or non-finite results are
unavailable. Figures use two significant figures and every
RP field is tagged `kind: 'estimate'`. The panel shows only estimated points per
token currently held, in configured `FAN_TOKENS` order with stable token-key
fallbacks for unknown tokens. It shows no totals, rankings or buy/stake links.

Coverage counts ownership only when liquid held + active staked totals at least
one whole on-chain token, excluding dust and pending-only rows, and counts a token
as staked only at one whole on-chain token or more.
Failed reads make aggregate coverage unavailable rather than confirming a zero.
The checklist links to the existing table. SR-54/SR-55 are absent, so the honest
fallback shows “No polls watched” outside the ordered action list. The list shows
whole-token liquid-only holdings followed by an unavailable watchlist prompt:
neutral holdings reminders only, no buy/stake CTA, fabricated poll, vote status or
nonexistent route. Once those
stories supply watched/voted polls, their open, unvoted, soonest-closing actions
can precede the existing holding reminders. The daily midnight UTC information
uses `Europe/London` for the next credit boundary, including DST.

This is not financial advice or a promise of RP/voting eligibility. All four
caveats and the approved estimate disclaimer remain visible in the panel.
SR-61's unconfirmed routes still have no figures or ordering. There are no prices,
costs, financial rankings, acquisition/staking write actions or RP guarantees.
Tests use mocked reads, never live RPC.

## Backend and local database

The API uses Next.js Node.js route handlers and Drizzle with standard Postgres
`DATABASE_URL` connections. The schema lives in `apps/web/src/server/db/schema.ts`;
committed Drizzle migrations live in `drizzle/`. SIWE authentication reuses the
existing nonce table; see [the auth flow and configuration](docs/auth.md).

For local database work, install Docker Compose and run from the repository root:

```sh
cp .env.example .env
docker compose up -d --wait
# Local-only connection matching Compose's dev default password:
export DATABASE_URL="postgresql://scoutreport:${POSTGRES_PASSWORD:-local-only-dev}@localhost:5432/scoutreport"
pnpm db:migrate
pnpm dev
```

Alternatively put `DATABASE_URL` in the ignored root `.env` for migration
commands and in `apps/web/.env.local` for Next.js. Exported environment variables
take precedence over these files. The Compose password is a local-only dev default,
read from `POSTGRES_PASSWORD`; never use it in production. Postgres listens only
on loopback. `docker compose down` preserves the local volume; `docker compose
down -v` deletes local data. Changing the password does not change an existing
volume's database password.

After schema changes run `pnpm db:generate --name <description>`, review the SQL,
then run `pnpm db:migrate`. The first migration enables `citext`; the migration
database role needs permission to create that extension. Production uses a
server-only `DATABASE_URL` (including provider-required TLS settings). Connections
are lazy, bounded and use no prepared statements for transaction-pooler
compatibility. The database module must never be imported by client components.

`GET /api/health` probes the database and the DATA_CHAIN and APP_CHAIN clients
from `packages/chain` concurrently, bypassing the block-number cache. It returns
`{ db: "ok", dataChainRpc: "ok", appChainRpc: "ok" }` when healthy; failed or
timed-out probes return `"error"` and HTTP 503. Responses are not cached and
never expose provider errors. Unit tests mock all dependencies; CI needs no
database or live RPC.

### Route conventions

Use `handler` from `apps/web/src/server/http.ts` for new API handlers. Pass a Zod
body `schema` for routes accepting JSON. Validation failures return HTTP 400;
`HttpError` returns a typed `{ code, message }` object, and unexpected errors
are redacted to HTTP 500. No request bodies, addresses or IPs are logged.

POST, PUT, PATCH and DELETE routes are automatically rate-limited; mark auth
routes with `auth: true`, including any future GET auth route. The dev limiter
allows 20 requests per minute with a shared dev key (no IP collection), expires
idle keys and caps its map at 10,000 keys. Production auth/write handlers fail
closed unless supplied with both a shared `RateLimiter` implementation and a
`rateLimitKey` resolver. SR-16 must wire a deployment-specific shared store and
trusted identity source before enabling those routes. Do not trust arbitrary
forwarded-IP headers; if a trusted deployment supplies IP-based keys, retain
them only for the limiter window and never log or persist them elsewhere.

`requireAdmin(session)` accepts only a minimal `{ address }` session and compares
it case-insensitively against trimmed, comma-separated `ADMIN_ADDRESSES`. The
caller must pass a verified session from F-09, not user-supplied JSON; this guard
does not authenticate anyone. Missing sessions return 401, denied access 403.
Use `toStoredAddress` for lowercase DB values and `toChecksumAddress` for API/UI
edges. Postgres also rejects malformed/non-lowercase profile and audit addresses,
and `citext` makes usernames unique case-insensitively. Writers must refresh
`profiles.updated_at` on updates.

See [the data inventory](docs/data-inventory.md) for every stored field, current
retention behaviour and the F-12 privacy hand-off.

## Contributing

Every branch, commit, and pull request title must include its Jira key from
project SR, for example `SR-2`.

See [the contributing guide](docs/CONTRIBUTING.md) for branch naming,
conventional commits, local validation, required CI checks, the review rule
and CI caching/timing. GitHub Actions validates pull requests and pushes to
`main` without secrets or deployments.

## Scripts

| Command                                     | Purpose                                             |
| ------------------------------------------- | --------------------------------------------------- |
| `pnpm dev`                                  | Run the Next.js web app                             |
| `pnpm turbo run build`                      | Build all packages and apps                         |
| `pnpm turbo run lint typecheck test build`  | Lint, typecheck, test, and build workspace projects |
| `pnpm --filter @scoutreport/contracts test` | Run Foundry scaffold and staking mock tests         |
| `pnpm format`                               | Format workspace files with Prettier                |
| `pnpm format:check`                         | Check formatting                                    |

## Networks

| Network              | Chain ID | HTTP RPC                                                                      | WebSocket RPC                     | Explorers                                                                                                 |
| -------------------- | -------: | ----------------------------------------------------------------------------- | --------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Chiliz Mainnet       |  `88888` | `https://rpc.ankr.com/chiliz` (fallback: `https://chiliz-rpc.publicnode.com`) | `wss://chiliz-rpc.publicnode.com` | [Chiliscan](https://chiliscan.com), [Chiliz Scan](https://scan.chiliz.com)                                |
| Chiliz Spicy Testnet |  `88882` | `https://spicy-rpc.chiliz.com/`                                               | `wss://spicy-rpc-ws.chiliz.com/`  | [Chiliscan Testnet](https://testnet.chiliscan.com/), [Spicy Explorer](https://spicy-explorer.chiliz.com/) |

These endpoints are from the Chiliz documentation,
[“Connect using RPC”](https://docs.chiliz.com/develop/basics/connect-to-chiliz-chain/connect-using-rpc).
Public RPCs are rate-limited; use a configured provider for production traffic.
Server-side RPC overrides are `RPC_URL_MAINNET`, `RPC_URL_MAINNET_FALLBACK`,
`RPC_URL_SPICY`, `RPC_WS_URL_MAINNET` and `RPC_WS_URL_SPICY`. They are not
exposed to client bundles, which continue to use the public defaults. Keep
provider URLs containing API keys out of `NEXT_PUBLIC_` variables.

**APP_CHAIN** is where ScoutReport's contracts live. Start on Spicy and validate
there before Mainnet. **DATA_CHAIN** is Mainnet, used read-only for real Fan
Token and Socios staking data. The gas token is CHZ. Fan Token decimals must be
read on-chain; token addresses belong in verified configuration and are
intentionally not included here.

### Shared chain helpers

`@scoutreport/chain` exports `getPublicClient(chainId)` for memoised HTTP clients
with Multicall3 batching on both networks. `ensureChain(walletClient, chainId)`
checks the wallet's current chain, switches it, and adds unknown networks before
retrying. User rejection raises `ChainSwitchRejectedError` with a readable message.

`FAN_TOKENS` contains all 81 official Mainnet V2 entries, using
[maintainer-verified data](https://github.com/GoHigherDev/ScoutReport/issues/21#issuecomment-6141845905)
and the [approved sports and DOJO decision](https://github.com/GoHigherDev/ScoutReport/pull/22#issuecomment-6142801649).
Each entry records the official source URL and retrieval date (13 October 2026).
Legacy 0-decimal AFC is excluded. No Spicy addresses are configured:
`getTokenAddress(token, 88882)` returns `undefined`. Config validation
rejects missing Mainnet, empty, zero or malformed addresses; an omitted optional
Spicy address is valid.

`readTokenMeta(chainId, address)` reads `symbol()`, `name()` and `decimals()` via
multicall. Concurrent reads are batched and successful metadata is cached per
chain/address in memory; failed reads can be retried. Format balances with
`formatTokenAmount(value, meta.decimals, opts)` (en-GB, bigint-safe, optional
fraction digits/grouping) and parse ungrouped decimal strings with
`parseTokenAmount(input, meta.decimals)`. Parsing rejects excess non-zero
fraction digits rather than rounding silently. Expected decimals in config are
verification assertions only, never a substitute for an on-chain read.

Run `pnpm --filter chain verify-tokens` to check every available token on
`DATA_CHAIN` (`NEXT_PUBLIC_DATA_CHAIN_ID`, Mainnet by default). The script uses
Node 24's TypeScript support and requires RPC access; it exits non-zero on
invalid addresses, failed reads, symbol or decimals mismatches. Only the approved
Mainnet DOJO contract expects the on-chain symbol `$DOJO` for ticker `DOJO`.
Spicy reports these tokens as unavailable without making RPC calls. Live verification is
separate from the deterministic mocked-transport unit tests and CI builds.

### Read-only Socios staking

ScoutReport is a third-party dapp, not affiliated with Socios. External-wallet
staking can contribute to staking and Scout Rating but does **not** earn Socios
Reward Points; only Socios Wallet staking earns RP. No Partner API or RP
calculations are used.

`readStakeDataLatest(client, user, token)` calls the Mainnet proxy
`0x5ff7f9724fd477d9a07dcdb894d0ca7f8fae1501` with the verified Staking3
implementation ABI in `packages/chain/abis/staking.json`.
That file is the complete 76-entry ABI supplied in [issue #17](https://github.com/GoHigherDev/ScoutReport/issues/17),
retrieved by the Delivery Manager on **13 October 2026** from the
[Routescan verified-source API](https://api.routescan.io/v2/network/mainnet/evm/88888/etherscan/api?module=contract&action=getsourcecode&address=0xed9331b504cd498ec04613d621a92c8e28bb8417)
and [Chiliscan implementation page](https://chiliscan.com/address/0xed9331b504cd498ec04613d621a92c8e28bb8417).
The ERC-1967 UUPS proxy's implementation was verified externally as
`0xed9331b504cd498ec04613d621a92c8e28bb8417` (`Staking3`, solc v0.8.23).
Explorer DNS prevented an independent sandbox re-fetch; the supplied ABI is
preserved, including original names. An implementation upgrade requires
re-verification.
It uses **`simulateContract` / `eth_call`**, never a transaction: the nonpayable
`getStakeDataLatest(staker, token, false)` refreshes accounting in simulation,
whereas the view `getStakeData` does not run that latest accounting logic.
The returned single tuple's `totalStake` is used as `staked`; locked and pending
fields are not added again. There are no stake, unstake, claim or other write
wrappers, even though the complete source ABI includes write functions.

The helper reads `balanceOf` as `held`, reuses `readTokenMeta` for on-chain
`decimals()`, and returns `normaliseStake(held, staked, decimals)`:
`{ held, staked, unstaked: held, totalScoutRating: held + staked, decimals, formatted }`.
Amounts are bigint; formatted strings are exact, en-GB and bigint-safe.
**`unstaked` means the liquid wallet balance**, not pending unstake.
`readUnstakePeriod(client, token)` returns bigint seconds from the no-argument
`unstakePeriod()` getter. The token is validated but not passed on-chain:
the returned period is contract-wide and does not expose token-specific
overrides. Period seconds are not scaled by token decimals.

```sh
pnpm --filter @scoutreport/chain read-stake <public-wallet-address> NAVI
```

Use a known public wallet with NAVI or AFC from `FAN_TOKENS`. The CLI prints
normalised DATA_CHAIN output to stdout (bigint as decimal strings), stores
no wallet data or keys, and exits non-zero on invalid input or failed reads.
It rejects Spicy rather than sending Mainnet staking calls to an unverified
testnet address. Set `RPC_URL_MAINNET` to `https://rpc.ankr.com/chiliz`,
`https://rpc.chiliz.com` or `https://chiliz-rpc.publicnode.com`; the existing
`RPC_URL_MAINNET_FALLBACK` is also supported.
The sandbox could not resolve any of these RPC hosts on 13 October 2026, so a
live wallet read remains to be run with RPC access. Unit tests use the approved
zero-stake reference and recorded period from issue #17 / PR #18, plus explicitly
synthetic arithmetic cases; they do not claim a block-pinned Mainnet capture.

See the [SR-30 staking spike](docs/research/chat-staking-spike.md) for the exact
tuple interface, evidence limitations, Spicy mock strategy, read-only
verification commands and C-02–C-11 / R-01 hand-offs. Revised SR-30 AC4 is met
by the mock scaffold; actual deployment is deferred to F-11 and an authorised
key holder. `packages/contracts/deployments/88882.json` contains null
placeholders, not deployed addresses. The existing Mainnet reader remains
unchanged and does not silently fall back to mocks.

## Transaction gas guardrails (SR-18)

`@scoutreport/chain` exports `useTxGuard(request, { getWallet })`. Call the
returned asynchronous guard immediately before writing. It checks the current
wallet against APP_CHAIN, reads native CHZ balance and estimates gas and fees.
It returns `{ ok: true }` or `{ ok: false, reason }`, where reason is
`insufficient_gas`, `wrong_network` or `unknown`. Insufficient balance includes
transaction value and the gas fee ceiling. Tests inject mock clients; they do
not use live RPC or send Mainnet transactions.

`@scoutreport/ui` exports `TxButton` with injected guard, write, receipt,
explorer and safe-error callbacks and application-supplied labels.
Web writes should use `TransactionButton` in `apps/web/src/wallet/tx-button.tsx`
with the same encoded viem request that will be sent. It supplies the guard,
APP_CHAIN client, F-04 explorer helper, `NAMES.gas` copy and gas panel.
Use `encodeFunctionData` with the generated contract ABI rather than building
calldata by hand. Give the component a new React `key` for a new transaction;
after a hash is submitted, it prevents accidental resubmission even if receipt
monitoring fails. Check the explorer in that case. Estimates can change and
wallet fee edits remain subject to wallet approval.

The gas panel shows the configured, verified faucets only on Spicy. Mainnet
has neutral CHZ gas guidance with no purchase links. Connected wallets also
see the approved no-gas/no-funds statement before SIWE signing.
`decodeTxError` decodes ScoutReport ABI custom errors, including nested viem
causes, using application-supplied messages and a generic fallback.
Regenerate `packages/contracts/abis/ScoutReportPredictions.json` from the
contract when its ABI changes:

```sh
cd packages/contracts
forge inspect ScoutReportPredictions abi --json > abis/ScoutReportPredictions.json
```

See [ADR 0002](docs/adr/0002-gas-sponsorship.md): paymaster and account
abstraction are **LATER**, subject to re-checking current Chiliz/Biconomy
guidance.

## Repository map

| Path                 | Purpose                                               |
| -------------------- | ----------------------------------------------------- |
| `apps/web`           | Next.js App Router web app                            |
| `packages/chain`     | viem chain configuration and helpers                  |
| `packages/ui`        | Shared UI components and brand tokens                 |
| `packages/config`    | Shared TypeScript, ESLint, and Prettier configuration |
| `packages/contracts` | Foundry Solidity project                              |
| `packages/subgraph`  | The Graph subgraph skeleton                           |

Off-chain data uses Postgres with Drizzle ORM, and API endpoints use Next.js
route handlers. Subgraph network and contract values are placeholders
until verified deployments exist.

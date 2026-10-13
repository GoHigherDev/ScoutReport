# ScoutReport

ScoutReport is a third-party SportFi dapp on Chiliz Chain that adds utility on
top of Socios.com Fan Tokens. It is not affiliated with Socios.

## Prerequisites

- Node.js LTS (22 or newer; Node 24 is selected in `.nvmrc`)
- pnpm 10 (`corepack enable` can make pnpm available with Node.js)
- Foundry for the Solidity project and its tests

## Getting started

```sh
pnpm install
pnpm dev
```

The web app runs at <http://localhost:3000>. Copy `.env.example` to `.env.local`
and fill in only values for services you have configured. Set
`NEXT_PUBLIC_SITE_URL` to the public site origin for production Open Graph links;
it defaults to `http://localhost:3000` when left empty. Do not commit secrets.

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
| `pnpm --filter @scoutreport/contracts test` | Run the Foundry placeholder test                    |
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

`FAN_TOKENS` contains the explorer-verified Mainnet V2 NAVI and AFC addresses,
with source URLs beside each entry. There are no official V2 deployments on
Spicy: `getTokenAddress(token, 88882)` returns `undefined`. Config validation
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
invalid addresses, failed reads, symbol or decimals mismatches. Spicy reports
these tokens as unavailable without making RPC calls. Live verification is
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

## Repository map

| Path                 | Purpose                                               |
| -------------------- | ----------------------------------------------------- |
| `apps/web`           | Next.js App Router web app                            |
| `packages/chain`     | viem chain configuration and helpers                  |
| `packages/ui`        | Shared UI components and brand tokens                 |
| `packages/config`    | Shared TypeScript, ESLint, and Prettier configuration |
| `packages/contracts` | Foundry Solidity project                              |
| `packages/subgraph`  | The Graph subgraph skeleton                           |

Off-chain data will use Postgres with Drizzle ORM, and API endpoints will be
Next.js route handlers. Subgraph network and contract values are placeholders
until verified deployments exist.

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

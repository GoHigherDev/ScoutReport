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
and fill in only values for services you have configured. Do not commit secrets.

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

## Network roles

- **APP_CHAIN** is where ScoutReport's contracts live. Start on Chiliz Spicy
  Testnet (chain ID `88882`) and validate there before Mainnet.
- **DATA_CHAIN** is Chiliz Mainnet (chain ID `88888`), used read-only for real
  Fan Token and Socios staking data.
- The gas token is CHZ. Fan Token decimals must be read on-chain; token addresses
  belong in verified configuration and are intentionally not included here.

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

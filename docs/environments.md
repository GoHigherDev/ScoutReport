# Environments (SR-16)

ScoutReport is a third-party dapp on Chiliz Chain, not affiliated with Socios.
APP_CHAIN hosts our contracts; DATA_CHAIN reads real Fan Token/staking data.
No Mainnet transactions or production rollout belong to this ticket.

## Matrix

| Environment     | APP_CHAIN   | DATA_CHAIN               | Holdings subgraph                                 | Database                                       | Reown project ID                                     |
| --------------- | ----------- | ------------------------ | ------------------------------------------------- | ---------------------------------------------- | ---------------------------------------------------- |
| Local           | Spicy 88882 | Mainnet 88888, read-only | Optional operator-issued Mainnet URL, server-only | Local Compose Postgres                         | Developer-supplied, or blank (wallet disabled)       |
| Preview, per PR | Spicy 88882 | Mainnet 88888, read-only | Goldsky Mainnet URL, server-only                  | Shared preview Postgres, isolated from staging | Maintainer-supplied preview ID with approved origins |
| Staging         | Spicy 88882 | Mainnet 88888, read-only | Goldsky Mainnet URL, server-only                  | Separate staging Postgres                      | Maintainer-supplied staging ID with approved origin  |
| Production      | See SR-64   | See SR-64                | See SR-64                                         | See SR-64                                      | See SR-64                                            |

Mainnet uses Goldsky's supported `chiliz` network (88888). Goldsky does not
list Chiliz testnet; the separate inert `chiliz-testnet` manifest is documented
only. Do not substitute Mainnet addresses on Spicy.

## Vercel project settings

A maintainer creates and links the Vercel project to this repository:

- Root Directory: `apps/web`; enable access to files outside the root directory.
- Framework: Next.js; Node.js: 24.x (see `.nvmrc`).
- `apps/web/vercel.json` installs from the workspace root and builds only the web
  app and its dependencies, not Foundry or the subgraph.
- Git integration generates Preview deployments for PRs. Use a maintainer-selected
  non-production staging branch with branch-specific Preview environment values.
  Do not configure a production deployment here; disable automatic production
  branch deployments in project Git settings until SR-64.
- **Vercel Deployment Protection (Vercel Authentication) stays on for preview
  and staging until SR-63 lands.** These URLs must not be publicly reachable:
  `/api/health` still performs uncached DB/RPC work. Do not issue public bypass
  links or disable protection.
- Hold deployments containing schema changes until migration succeeds. Pause
  automatic Git deployments for the affected rollout, then redeploy the chosen
  commit after migration. Otherwise automatic PR builds may precede migration.

Project linking, protection, branch overrides and secrets are maintainer settings,
not properties enforced by `vercel.json`. Check them before the first rollout.

## Variables and secrets

Use `.env.example` as the inventory; never commit real values. Local Next.js uses
`apps/web/.env.local`; migration commands use root `.env` or exported values.
In Vercel, scope values to Preview with staging branch overrides. Keep separate
DB credentials and session secrets for preview/staging.

| Name                                                                | Where it goes                                                                                   | Purpose                                                                                              |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_APP_CHAIN_ID`                                          | Local/Vercel Preview and staging override                                                       | `88882` only here                                                                                    |
| `NEXT_PUBLIC_DATA_CHAIN_ID`                                         | Local/Vercel Preview and staging override                                                       | `88888`, read-only                                                                                   |
| `NEXT_PUBLIC_SITE_URL`                                              | Local/Vercel per deployment                                                                     | Actual origin for metadata; no invented URL                                                          |
| `NEXT_PUBLIC_REOWN_PROJECT_ID`                                      | Local/Vercel per environment                                                                    | Public Reown ID; allowlist intended origins                                                          |
| `DATABASE_URL`                                                      | Local root `.env` and web env; Vercel server env; GitHub `preview`/`staging` environment secret | Matching Postgres database, provider-required TLS; migration role needs `citext` creation permission |
| `SESSION_SECRET`                                                    | Local/Vercel server env per environment                                                         | Maintainer-generated secret for session consumers                                                    |
| `ADMIN_ADDRESSES`                                                   | Local/Vercel server env                                                                         | Verified allowlist; does not authenticate users                                                      |
| `FEATURE_RP_ESTIMATE`                                               | Local/Vercel **server-only**, every environment defaults to `false`                              | SR-56 current-owner estimate panel; only `true` enables it, and no figures/read work without approved calibration |
| `RPC_URL_MAINNET`, `RPC_URL_MAINNET_FALLBACK`, `RPC_WS_URL_MAINNET` | Local/Vercel server env                                                                         | Optional Mainnet read providers; blank uses public defaults                                          |
| `RPC_URL_SPICY`, `RPC_WS_URL_SPICY`                                 | Local/Vercel server env                                                                         | Optional Spicy providers; blank uses public defaults                                                 |
| `SUBGRAPH_URL_HOLDINGS`                                             | Local/Vercel **server-only** env, Preview and staging override                                  | Provider-issued Goldsky query URL; never `NEXT_PUBLIC_`, never commit the real URL/project ID        |
| `NEXT_PUBLIC_SUBGRAPH_URL_PREDICTIONS`                              | Reserved, leave blank                                                                           | SR-43, not holdings                                                                                  |
| `POSTGRES_PASSWORD`                                                 | Local root `.env` only                                                                          | Compose development password, not hosted credentials                                                 |
| `SPICY_DEPLOYER_PRIVATE_KEY`                                        | GitHub `spicy` environment secret only                                                          | Dedicated funded testnet key; never passed as a CLI argument                                         |
| `GOLDSKY_API_KEY`                                                   | GitHub `indexer` environment secret only                                                        | Goldsky CLI authentication                                                                           |
| `SUBGRAPH_NAME`, `VERSION`                                          | Indexer dispatch inputs; local operator env                                                     | Maintainer-selected deployment identifiers, not product copy                                         |
| `GITHUB_TOKEN`                                                      | Automatically supplied to contracts workflow                                                    | Open deployment-record PR; enable Actions PR creation in repository settings                         |

GitHub environment deployment branch policies must allow only `main` for
`preview`, `staging`, `spicy` and `indexer`; dispatch workflows also enforce this.
No deploy workflow runs on `push` or `pull_request`, and none accepts Mainnet
contract deployment. Ordinary CI remains secret-free.

Preview databases are shared: all migrations must be additive/backwards-compatible
with every still-active preview. Do not drop columns used by older PR builds.
Auth/write routes remain disabled/fail closed until a deployment-specific shared
limiter and trusted identity resolver exist. No new public paid-work endpoint is
introduced. Protection is not a substitute for SR-63 hardening.

SR-56 adds no endpoint or database migration. Do not configure this flag as
`NEXT_PUBLIC_`; the server passes only its boolean decision to the optimiser.
Changing the flag does not supply calibration. The shipped calibration list is
empty; leave the flag off unless the informational panel is deliberately enabled.
Preview, staging and production do not opt in implicitly. The local Socios Wallet
declaration is not an authenticated session and never leaves the browser.

See the [deployment runbook](runbooks/deploy.md) for rollout and rollback.

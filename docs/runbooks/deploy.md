# Preview and staging deployment (SR-16)

Scope: APP_CHAIN Spicy 88882; DATA_CHAIN Mainnet 88888 read-only. Production,
Mainnet contract deployment, role hand-over and production rollback are SR-64.
Never broadcast a Mainnet transaction.

## Prerequisites

1. A maintainer provisions the Vercel project, preview/staging Postgres, Reown
   IDs, Goldsky project/API key and a dedicated Spicy deployer.
   Configure every value and GitHub environment policy in
   [the environment matrix](../environments.md).
2. **Vercel Deployment Protection (Vercel Authentication) stays on for preview
   and staging until SR-63 lands.** Verify signed-out access is denied, including
   `/api/health`; do not publish bypass links. No unauthenticated endpoint may
   trigger paid DB/RPC/subgraph work without a rate limit or cache.
3. Merge reviewed code with all four CI checks passing. Dispatch deployment
   workflows from `main` only. These workflows do not execute on PR/push.
   Pause affected automatic Vercel deployments until migrations succeed.
4. Use Spicy/Tatum faucets linked from the
   [Chiliz Developer Toolbox](https://docs.chiliz.com/develop/dev-tools/developer-toolbox)
   for testnet CHZ. Never reuse a Mainnet key. Never enable shell tracing.

## Rollout order

### 1. Database migration

In Actions, run **Migrate preview/staging database** (`db-migrate.yml`) from
`main`, first with `preview`, then separately with `staging` before each rollout.
It reuses `pnpm db:migrate` with that environment's `DATABASE_URL`. Confirm success
before continuing; failures intentionally suppress provider output.

Preview PRs share a database. Review migrations for additive/backwards-compatible
changes with all active previews; pause new builds when introducing a migration,
migrate, then resume/redeploy. Do not run unreviewed PR migrations against shared
credentials. Local equivalent from the repository root: `pnpm db:migrate`.

### 2. Spicy contracts

Run **Deploy Spicy contracts** (`deploy-contracts.yml`) from `main`, selecting
only `spicy`. It invokes `DeployChatMocks.s.sol`, not product contract logic.
The script and workflow must both reject non-Spicy chains. The authorised
maintainer runs this; no agent broadcasts transactions.

The workflow opens an `SR-16` PR with
`packages/contracts/deployments/88882.json`: contract addresses, deploy blocks,
transaction hashes and source git SHA, taken from successful Forge receipts.
Review explorer receipts and fallback ABI/flattened-source/commit evidence before
merging. Pending/null entries mean **not deployed**, including in the chain exports.
Use the explorer's supported verifier if available; otherwise retain the committed
fallback evidence. Never commit the full Forge broadcast or private key.

If broadcasting fails, inspect Spicy receipts privately before retrying: a partial
deployment may already exist. Do not blindly redeploy or claim pending addresses
are live. Redeployment creates new mocks and loses their test state.

### 3. Hosted read-only Mainnet indexer

Goldsky supports Subgraphs on Chiliz Mainnet, slug `chiliz`, but does not list
Chiliz testnet (maintainer-verified 13 October 2026:
[Chiliz](https://docs.goldsky.com/chains/chiliz),
[supported networks](https://docs.goldsky.com/chains/supported-networks)).
This is data indexing only; it sends no Mainnet transactions.

After merge, run **Deploy read-only Mainnet indexer** (`deploy-subgraph.yml`)
from `main` with a maintainer-selected name and a new immutable version label.
The workflow installs Goldsky CLI `13.17.0`, builds `subgraph.yaml`, authenticates
with the `indexer` environment secret and deploys the Mainnet `build` directory.
Never reuse a version to overwrite an index still used by previews/staging.

Operator equivalent (Goldsky CLI installed, secrets supplied privately):

```sh
cd packages/subgraph
pnpm build
pnpm deploy:chiliz
```

Set `SUBGRAPH_NAME`, `VERSION`, `GOLDSKY_API_KEY` in the operator environment,
not committed commands. The deploy script runs `goldsky login --token` and
`goldsky subgraph deploy <name>/<version> --path ./build`, suppressing credential
output. Obtain the real query URL privately from Goldsky:
`https://api.goldsky.com/api/public/project_<project-id>/subgraphs/<name>/<version>/gn`.
Never commit the real project ID, key or URL.

Wait for full historical sync. Query `_meta { block { number } hasIndexingErrors }`
privately and confirm `hasIndexingErrors` is false and the indexed block is near
the chain head. Use the NAVI/AFC sample queries in the
[subgraph guide](../../packages/subgraph/README.md), check exclusion filters and
raw-unit decimals. An incomplete index is not an authoritative ranking.
Record deployment version, source SHA and validation outcome in the private
operator log; do not claim a live deployment until the maintainer completes it.

Spicy/preview: the app still reads Mainnet via DATA_CHAIN. Goldsky is not used
for Spicy. The separate `subgraph.testnet.yaml` is intentionally inert: no verified
NAVI/AFC/staking testnet configuration exists. For a future supported The Graph
Studio deployment, confirm `chiliz-testnet` support with the provider, authenticate
privately, then use the separate manifest:

```sh
cd packages/subgraph
pnpm exec graph codegen subgraph.testnet.yaml
pnpm exec graph build subgraph.testnet.yaml --output-dir build/testnet
pnpm exec graph auth
pnpm exec graph deploy "$SUBGRAPH_SLUG" subgraph.testnet.yaml \
  --node https://api.studio.thegraph.com/deploy/ --version-label "$VERSION"
```

No live Spicy subgraph is required here. Never switch the Mainnet manifest's
network while retaining Mainnet addresses.

### 4. Frontend environment and rollout

Set `SUBGRAPH_URL_HOLDINGS` as a **server-only** Vercel Preview/staging branch
override after indexer validation. Do not use `NEXT_PUBLIC_` for holdings.
Set APP_CHAIN `88882`, DATA_CHAIN `88888` and the matching DB/Reown/site values.
Link `apps/web`, retain Authentication protection and resume Git previews only
after migration. Redeploy the selected PR/staging commit with its new values;
public build-time variables require a rebuild.

While authenticated, check the rendered wallet shell and Spicy chain switching,
Mainnet read-only holdings, metadata origin and `/api/health`. Confirm signed-out
requests are blocked. Do not enable public auth/write routes without the shared
limiter and trusted key resolver. This ticket adds no DB/RPC/subgraph query route.

## Preview/staging rollback

- Pause affected Git deployments. Restore/redeploy the last known-good Vercel
  commit with its matching environment values; keep Vercel Authentication on.
- Database: retain additive migrations so older previews still work. Do not
  automatically down-migrate or delete shared data. For incompatible changes,
  stop rollout and have the DB operator restore a verified backup to an isolated
  database, reconcile writes and update only the affected environment.
- Contracts: broadcasts cannot be undone. Restore the previously reviewed Spicy
  record/config in a PR and redeploy consumers; retain receipt/evidence history.
  Do not reuse mock addresses on Mainnet.
- Indexer: retain the previous fully synced version. Restore its server-only URL
  and redeploy the frontend. Do not delete the old index until no environment
  depends on it; diagnose indexing errors before another version.
- Recheck authenticated health/wallet reads and signed-out protection.
  Production/Mainnet rollback is explicitly deferred to SR-64.

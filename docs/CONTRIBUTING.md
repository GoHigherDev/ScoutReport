# Contributing

## Branches and commits

Create a branch from `main` named `<type>/SR-<number>-<short-description>`,
for example `ci/SR-7-validation`. Start the pull request title with the same
Jira key.

Use conventional commits and include the Jira key in every commit message,
for example `ci: SR-7 add workspace checks` or `fix(web): SR-12 correct copy`.
Keep changes scoped to the ticket and use en-GB spelling.

## Local checks

Install Node LTS from `.nvmrc`, pnpm from the root `packageManager` field,
and Foundry. From the repository root, run:

```sh
pnpm install --frozen-lockfile
pnpm turbo run lint typecheck test build
pnpm --filter @scoutreport/subgraph codegen
pnpm --filter @scoutreport/subgraph build
cd packages/contracts
forge fmt --check
forge build
forge test -vvv
```

Turbo includes the contracts and subgraph package scripts, so Foundry must
also be available for the workspace checks. The dedicated CI jobs additionally
check Solidity formatting and independently validate subgraph generation.
Current scaffold builds require no environment values, database, RPC access
or repository secrets. Do not add live credentials to CI; if future builds
require environment values, use explicitly dummy, non-sensitive values.

## Required checks and reviews

Repository maintainers must configure branch protection (or a ruleset) for
`main` to require a pull request, **at least one approving review**, and all
four successful status checks before merge:

- `web+packages`: lint, typecheck, tests and builds for workspace packages.
- `contracts`: `forge fmt --check`, `forge build`, `forge test -vvv`.
- `subgraph`: Graph codegen and build.
- `secret-scan`: Gitleaks scans the full Git history with findings redacted.

Do not bypass these requirements. Workflow files do not configure branch
protection themselves; maintainers must enable it in GitHub settings.
CI runs on every pull request and on pushes to `main`, with read-only
repository permissions. It does not deploy contracts, subgraphs or the app.
Dependabot checks npm workspaces and GitHub Actions weekly.

## Caching and CI time

Node setup caches the pnpm store using the lockfile. The workspace job caches
local Turbo task results in `.turbo`, keyed by the runner OS, Node version,
lockfile, Turbo/Foundry configuration, workflow and commit, with a restore prefix for
reuse across commits. No remote-cache credentials are needed.

The four jobs run in parallel. Budget approximately **5–10 minutes total
wall-clock time** for a cold run and **2–5 minutes** with warm caches; these
are estimates, not measured GitHub Actions results. Runner queueing, downloads
and project growth can change this. Check the Actions run's start/end times
for actual total duration (do not sum parallel job durations). Job timeouts
are 20 minutes for the workspace, 10 for contracts/subgraph and 5 for scanning.

## Product and chain safety

Never commit secrets or private keys. Read Fan Token `decimals()` on-chain
and use only explorer-verified addresses from configuration. Test chain-facing
changes on Spicy (`88882`) before Mainnet (`88888`); Mainnet data reads remain
read-only. Do not invent API responses, Reward Point figures or product names.
Unapproved display names remain bracketed placeholders in the copy/config file.
If blocked or a product decision is needed, leave a pull request comment
starting with `QUESTION:` rather than guessing.

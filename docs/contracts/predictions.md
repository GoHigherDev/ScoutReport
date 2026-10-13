# SR-42 prediction contract

`packages/contracts/src/ScoutReportPredictions.sol` uses Solidity 0.8.30,
Foundry's Prague EVM target and OpenZeppelin AccessControl/Pausable. This ticket
adds no UI, API routes, database work, sports API calls or oracle integration.
Prediction points are non-transferable counters, not Socios Reward Points.
There are no deposits, stakes, pools, ERC-20 interactions or token transfers.

## Lifecycle and reads

- `createMatch(matchId, lockTime, outcomeCount, pointsForCorrect)` requires
  `MATCH_ADMIN_ROLE`, a new ID, a future lock time, 2 or 3 outcomes and
  **1–100** points. `MAX_POINTS_PER_CORRECT = 100` is a named constant.
- IDs follow `keccak256(abi.encodePacked("scoutreport:", <db uuid>))`. Producers
  must agree on the UUID's canonical text encoding.
- `predict(matchId, outcome)` accepts zero-based outcomes while the match is
  Open and `block.timestamp < lockTime`. Each address has one pick; it may
  replace that pick until lock. Only the first pick adds a predictor.
- `settle(matchId, winningOutcome)` requires `SETTLER_ROLE` and
  `block.timestamp >= lockTime`, validates the outcome and moves Open to Settled
  exactly once. Settlement does not iterate predictors.
- `voidMatch(matchId)` requires `MATCH_ADMIN_ROLE` and moves only Open matches
  to Voided. Voided matches cannot settle or earn points. Settlement cannot be
  reversed by voiding.
- `creditPoints(matchId, maxCount)` is permissionless for Settled matches.
  It processes at most `maxCount` predictors from `creditedCursor`, credits only
  correct picks and advances the cursor across both winners and losers. There
  are no external calls or unbounded contract loops. Choose a small batch for
  available block gas; no single caller needs to credit all predictors.
- `getMatch` exposes `lockTime`, `outcomeCount`, `result`, `pointsForCorrect`,
  `status`, `predictorCount` and `creditedCursor`. `predictionOf` distinguishes
  an absent pick from outcome zero. `pointsOf` returns the cumulative counter.

Events are `MatchCreated`, `Predicted`, `MatchSettled`,
`PointsCredited(matchId, from, to)` and `MatchVoided`. Crediting ranges are
half-open: `[from, to)`. Indexers must treat subsequent Predicted events for
the same match/address as replacements, not additional predictors.

## Roles and threat model

The constructor grants the supplied administrator `DEFAULT_ADMIN_ROLE`,
`MATCH_ADMIN_ROLE` and `SETTLER_ROLE`. The deploy script initially uses the
Spicy deployer as administrator. AccessControl permits separately granting
and revoking each role; use distinct operational accounts and protect the
administrator with a multisignature wallet before operational use.

The settler is centralised and trusted: a compromised key can select a false
result for any locked Open match. There is no oracle, dispute mechanism or
post-settlement correction. Mitigations are role separation, limited settler
access, off-chain result review before settlement, event monitoring, key
rotation and administrator-controlled pause/unpause. Pausing stops lifecycle
mutations and crediting; views and role administration remain available.
MATCH_ADMIN can create or void matches and must also be protected.

One pick per address is not one pick per person: multiple addresses can
participate. This contract does not implement identity or Sybil resistance.
Timestamps use chain time. Predictors pay network gas but cannot send value
to contract functions. The non-payable fallback rejects empty and unknown
calldata; forced native-token balances cannot be prevented by Solidity and
do not create points or withdrawal rights.

## Validation and ABI

From the repository root:

```sh
pnpm install --frozen-lockfile
pnpm turbo run lint typecheck test build
cd packages/contracts
forge fmt --check
forge build
forge test -vvv
forge test --match-test testPagination500 -vv
forge inspect ScoutReportPredictions abi --json > ../chain/abis/ScoutReportPredictions.json
```

Tests cover points boundaries 0, 1, 100 and 101, outcome/count validation,
duplicates, missing matches, roles, pause, deadline boundaries, changing picks,
double settlement, voiding and paginated crediting. A conservation fuzz test
varies 1–200 predictors, picks, result, 1–100 points and successive batch sizes,
then checks total credited points and that an extra completed-batch call adds
nothing. The 500-predictor test reports gas per batch; gas is an EVM test
measurement, not a Spicy fee estimate.

The local Foundry run measured five all-correct batches of 100 predictors with
storage access cooled before each call:
**2,793,629; 2,793,632; 2,793,632; 2,793,632; 2,793,642 gas**.
Mixed-result batches can cost less; repeat the test after compiler or dependency
changes rather than treating these figures as a permanent gas bound.
These local tests used Forge 1.7.1 with solc-js 0.8.30; the native Solidity
compiler was unavailable in the sandbox. Standard native-compiler validation remains a CI
gate, not a claimed local result.

Slither is not part of the installed workspace tooling. In an environment with
Slither and the pinned dependencies installed, run:

```sh
cd packages/contracts
slither src/ScoutReportPredictions.sol --compile-force-framework foundry
```

Triage timestamp-comparison findings against the intentional lock boundary;
review pagination/cursor findings for exactly-once crediting and bounded
iteration. Centralised result authority and address-based participation are
documented trust assumptions, not oracle or identity guarantees. Do not treat
this command or these triage notes as evidence of a clean Slither run.

## Spicy deployment after merge

Run **Deploy Spicy contracts** manually from `main` with `network=spicy` and
`contract=predictions`. The default `contract=mocks` retains SR-16 behaviour.
Both the workflow and deployment script reject chains other than **88882**.
The protected `spicy` environment supplies `SPICY_DEPLOYER_PRIVATE_KEY`;
never put its value in source, documentation or command history.

`DeployPredictions.s.sol` deploys the contract. The recorder requires one
confirmed CREATE transaction and successful matching receipt, then records
its address, block, transaction hash and source commit in
`packages/contracts/deployments/88882.json`. It preserves mocks and their
source commits; deploying mocks later likewise preserves predictions.
The workflow opens a deployment-record PR with sanitised ABI, flattened source
and `ScoutReportPredictions.commit.txt` evidence. Raw broadcast data stays
ignored and is not published.

No address or transaction is recorded before a real broadcast. The actual
Spicy deployment requires the environment key holder and runs after merge.
Mainnet deployment is out of scope (P-09). This document is technical only;
it does not supply legal guardrails or terms.

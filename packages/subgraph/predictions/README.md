# SR-43 predictions subgraph

This is a separate subgraph from holdings/staking. It indexes the five events
from `ScoutReportPredictions`; it makes no contract calls and needs no sports
API. ScoutReport is a third-party dapp on Chiliz Chain, not affiliated with
Socios. Prediction points are the contract's non-transferable counters, not
Socios Reward Points.

## Event semantics

- `MatchCreated` stores the event's lock time, outcome count and
  `pointsForCorrect` without substituting a fixed award.
- `Predicted` upserts one `Prediction` per match/address. Only the first pick
  increments `predictorCount` and creates a `PredictorIndex` in first-pick
  order. Changes retain that index and replace the outcome.
- `MatchSettled` records the final result and Settled status. It does not award
  points or iterate predictions.
- `PointsCredited` processes precisely the half-open range `[from, to)` using
  the index lookup, advancing `creditedCursor` across correct and incorrect
  picks. Empty ranges are no-ops. Correct picks add the event-configured
  `pointsForCorrect` to their season and week totals. `credited` means processed,
  including incorrect picks; it prevents duplicate additions.
- `MatchVoided` records Voided status without awarding points. The contract
  only permits voiding Open matches, never settled ones.

`Prediction.correct` remains null until that prediction's credit range is
processed, when it becomes true or false. It remains null for Open, Voided and
unprocessed Settled predictions. This avoids an unbounded settlement loop.
`Match.result` remains null until settlement; zero is a valid result.

Counts, indices, cursors and points use `BigInt`, including the full unsigned
32-bit contract counter range. IDs are lower-case match hex, match-user for
picks, and match-index for lookup entries. The single provisional season is
`SEASON_ID` in `src/config.ts`: `provisional`. The contract has no season events;
this is not an approved season boundary policy. All matches currently share it.
`UserPoints` IDs are season-user; `WeeklyPoints` IDs are season-user-weekStart.
Users get a zero season total on their first pick; weekly rows exist only after
a correct pick is credited.

## Week calculation

Weekly points belong to the week containing the **match lock time**, not the
settlement or credit timestamp. `weekStart` is the UTC Unix timestamp of
Monday 00:00 in Europe/London. During BST it is Sunday 23:00 UTC; during GMT
it is Monday 00:00 UTC.

`src/week.ts` implements the modern UK rules deterministically in
AssemblyScript: BST starts on the last Sunday of March at 01:00 UTC and ends
on the last Sunday of October at 01:00 UTC. It calculates Monday's own offset,
not the lock timestamp's offset, so changeover Sundays stay in the correct
week. Historical UK timezone exceptions before the modern rule and future
legislative changes are not modelled. Matchstick tests cover both changeovers,
Sunday/Monday boundaries, year boundaries and timestamps beyond signed 32-bit
range.

## Queries

Supply real match IDs, lower-case wallet addresses, timestamps and endpoint
through variables; none are assumed here. `now` is the current Unix timestamp.
An Open match whose lock time has passed is no longer upcoming even if it has
not yet been settled.

```graphql
query Upcoming($now: BigInt!) {
  matches(
    first: 100
    where: { status: Open, lockTime_gt: $now }
    orderBy: lockTime
    orderDirection: asc
  ) {
    id
    status
    lockTime
    outcomeCount
    pointsForCorrect
    predictorCount
  }
}

query MyPicks($user: Bytes!) {
  predictions(first: 100, where: { user: $user }) {
    id
    outcome
    correct
    credited
    predictorIndex
    match {
      id
      status
      lockTime
      result
      pointsForCorrect
    }
  }
}

query SeasonTop100($season: String!) {
  userPoints_collection(
    first: 100
    where: { seasonId: $season }
    orderBy: total
    orderDirection: desc
  ) {
    id
    user
    seasonId
    total
  }
}

query WeekTop100($season: String!, $weekStart: BigInt!) {
  weeklyPoints_collection(
    first: 100
    where: { seasonId: $season, weekStart: $weekStart }
    orderBy: total
    orderDirection: desc
  ) {
    id
    user
    seasonId
    weekStart
    total
  }
}
```

Use `season: "provisional"` until a season policy is implemented. Compute the
week variable with the same Europe/London Monday convention. Paginate picks
and upcoming matches for more than 100 entries. Ties in leaderboards do not
define a product ranking policy. The Graph appends `_collection` to plural
query fields when an entity name already ends in the plural `Points`.

## Tooling and pending deployment

Install the existing workspace dependencies from the repository root. From
`packages/subgraph`, the parent CLI `scripts/predictions.mjs` handles isolated
codegen, build, Matchstick execution and deployment-manifest generation. Bindings
are generated inside `predictions/generated`; sources import
`../generated/ScoutReportPredictions/ScoutReportPredictions` and
`../generated/schema`. Generated code and build output are not committed.

Targeted local commands, from `packages/subgraph`:

```sh
pnpm exec graph codegen predictions/subgraph.yaml --output-dir predictions/generated
pnpm exec graph build predictions/subgraph.yaml --output-dir predictions/build
pnpm exec eslint predictions/src predictions/tests
cd predictions
../node_modules/.bin/graph test --version 0.6.0
```

`subgraph.yaml` is a **non-deployable mainnet template** (`network: chiliz`,
chain 88888). P-09 must supply a confirmed mainnet address and deployment block;
neither is fabricated here. Its ABI path is
`../../chain/abis/ScoutReportPredictions.json`. The parent generator supplies
address/startBlock for Spicy (88882) from its verified deployment record and
generates `subgraph.testnet.yaml`. It skips the Spicy manifest only when
`contracts.ScoutReportPredictions` is explicitly null; missing or invalid records
fail. The generated `networks.json` keeps `chiliz: {}` pending P-09. Do not deploy
the bare template or mix its data with holdings.

The parent CLI `scripts/check-points.ts` uses `RPC_URL_SPICY` and
`SUBGRAPH_URL_PREDICTIONS` to compare the top 50 users ordered by total with
on-chain `pointsOf`. It reads the indexed block from `_meta`, then queries both
the leaderboard and contract at that same block; the RPC must support historical
state reads. Configure these environment variables locally, then run
`pnpm check-points` from `packages/subgraph`. The CLI exits nonzero on a mismatch
or failure. Never run live reconciliation in CI or commit credentials. Actual
deployment, endpoint publication and live reconciliation remain pending until a
real deployment and indexer are available.

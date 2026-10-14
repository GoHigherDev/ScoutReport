# SR-44 manual match settlement

ScoutReport is independent of Socios. This free-to-play console records
non-transferable prediction points, not Socios Reward Points. There is no
fixture import, sports API, HLTV scraping or server-held settler key.

## Prerequisites and access

- Apply the Drizzle migrations with `pnpm db:migrate` using authorised local
  environment configuration. Never paste credentials into this runbook.
- Set `ADMIN_ADDRESSES` to the approved admin wallets. Connect one of those
  wallets, use the existing SIWE sign-in flow at `/admin/matches`, and reopen
  the console. An empty allowlist denies access. Changing the connected wallet
  does not change the session; sign in again for the intended actor.
- Admin pages and APIs verify the SIWE session and allowlist before database
  or RPC work. All admin APIs use the existing rate-limited handler, including
  reads. Production APIs deliberately fail closed until an approved shared
  limiter and trusted identity resolver are supplied by SR-72. This ticket
  does not make the console production-operational without that wiring.
- Writes are restricted to APP_CHAIN **Spicy 88882**. The signing wallet needs
  the appropriate on-chain role (`MATCH_ADMIN_ROLE` for creation/voiding,
  `SETTLER_ROLE` for settlement), and test CHZ for gas. Crediting is
  permissionless on-chain but restricted to admins in this console.
- The approved deployment must be recorded in
  `packages/contracts/deployments/88882.json` and the app rebuilt. While the
  record is PENDING/null, all transaction controls are disabled and no
  predictions RPC reads are made. Do not substitute an address, deploy a
  contract or use Mainnet to bypass this restriction. The committed pending
  record is intentionally unchanged.

## Create a match

1. Select football or CS2, enter both sides and map a side to an existing Fan
   Token key where applicable. Leave the mapping empty if none applies; do not
   infer that a token mapping verifies the side's identity or eligibility.
2. Enter kickoff and optional lock time in **Europe/London**, regardless of
   the browser's local timezone. Lock time defaults to kickoff and cannot be
   later than kickoff. UTC timestamps are stored and displayed.
   Non-existent spring clock-change times and repeated autumn times are
   rejected rather than assigned a guessed offset. Obtain an unambiguous
   time before saving.
3. Enter two or three distinct, ordered outcome labels and the approved
   points setting within the contract's range (1–100). The console does not
   supply or promise an award. Results use zero-based indices in this order.
4. Save metadata. The database UUID produces
   `keccak256("scoutreport:" + uuid)` as the bytes32 match ID. Metadata and its
   audit entry are saved atomically; this does **not** create an on-chain
   match. Do not save again to retry a rejected wallet signature.
5. Once deployment is available, select **Create match on Spicy**, check the
   match, and sign through the shared transaction button. The lock time must
   still be in the future. Check `MatchCreated` against the metadata before
   accepting predictions. Failed RPC reads are not treated as missing matches.

## Verify result → settle → credit

1. **Verify an official result.** Use the football competition organiser's
   published final result or the CS2 tournament organiser's official result.
   Retain the source URL, time checked and match/outcome in the authorised
   operational record. Do not use unofficial aggregators, scraped HLTV pages,
   community posts or an inferred score as authority. If the organiser has
   not finalised the result or evidence conflicts, stop and escalate.
2. Match the database UUID, bytes32 match ID, sides, kickoff and ordered
   outcomes to the official fixture. Ensure the on-chain match is Open and
   its lock time has passed.
3. Choose the result and select **Settle match**. The confirmation modal shows
   the match, ID and result. Independently re-check these details before
   signing. **Settlement is irreversible**: the MVP contract cannot correct,
   resettle or void a Settled match.
4. Wait for a successful Spicy receipt and `MatchSettled(matchId, result)`.
   The browser wallet signs; the server only verifies reads and records audit
   metadata. Never provide a settler/admin private key to the server.
5. The console then offers credit batches of up to 50 predictors. Confirm each
   batch through the same transaction button and wallet. After each receipt,
   it reads the on-chain cursor and offers the next batch until
   `creditedCursor == predictorCount`. Correct and incorrect picks both
   advance the cursor. A zero-predictor match needs no batch.
6. Verify each `PointsCredited(matchId, from, to)` half-open range and the
   final cursor. Do not equate settlement with completed crediting.

## Verify events/subgraph → refresh the leaderboard

1. Use the actual transaction hashes in `admin_audit_log.payload` and the
   Spicy explorer receipt links to check the contract address and events:
   `MatchCreated`, `MatchSettled`, `PointsCredited`, or `MatchVoided`.
   Audit records include the session actor, action and receipt status.
   Metadata-only actions have `txHash: null`; reverted receipts are recorded
   as reverted, not as completed state transitions.
2. Query the **predictions** subgraph, not the holdings/staking subgraph.
   Obtain its approved provider-issued endpoint; no endpoint is assumed here.
   Wait until `_meta.block.number` reaches the last receipt block and
   `_meta.hasIndexingErrors` is false. Check the match ID, status, result,
   points setting and cursor:

   ```graphql
   query SettlementCheck($matchId: ID!) {
     match(id: $matchId) {
       id
       status
       result
       pointsForCorrect
       predictorCount
       creditedCursor
     }
     _meta {
       block {
         number
       }
       hasIndexingErrors
     }
   }
   ```

3. Refresh/requery the season and week leaderboard consumers only after the
   index catches up. Use the existing `SeasonTop100` and `WeekTop100` queries
   in [the predictions subgraph documentation](../../packages/subgraph/predictions/README.md).
   The provisional season and Europe/London Monday week convention are
   defined there; do not invent a season or ranking policy. This ticket adds
   no leaderboard cache invalidation service or public leaderboard page.
4. When an approved Spicy deployment and indexer exist, use the existing
   `pnpm --filter @scoutreport/subgraph check-points` reconciliation command
   with authorised local `RPC_URL_SPICY` and `SUBGRAPH_URL_PREDICTIONS`
   configuration. It compares at the indexed block. Do not run live
   reconciliation in CI, publish credentials, or declare success with an
   incomplete index.

## Recovery, postponements and disputes

- **Signature rejected / insufficient gas:** no transaction was sent.
  Resolve the wallet issue and retry the saved match; do not duplicate metadata.
- **Pending receipt / browser closed:** retain the actual wallet/explorer hash.
  Wait for the receipt, then refresh matches to recover state. Never resend
  based only on a timeout. Use **Record a previous transaction** with its
  action and hash to recover audit recording. The API checks the receipt,
  sender, destination, calldata, match metadata and successful event; a
  cancelled transaction or another wallet's transaction cannot impersonate
  the current admin's action.
- **Audit recording failed:** retain the displayed receipt hash and use
  **Retry audit recording** before continuing. Recovery is idempotent. A
  successful on-chain action is not undone by a database outage. After a
  reload, use hash recovery. A missing/reverted receipt never proves success.
- **Batch interrupted:** refresh to recover `creditedCursor`; resume remaining
  batches, not settlement. The contract never credits a predictor twice.
  During rate limiting, wait for the `Retry-After` interval before retrying.
  Paused contracts must be escalated to an authorised operator; the console
  does not manage pause/role administration.
- **Postponed/cancelled, still Open:** verify the official announcement, select
  **Void match**, review the confirmation and sign. Check `MatchVoided` and
  the subgraph's Voided status. No points are credited. An approved replacement
  fixture requires a new UUID/match ID; do not reuse a voided ID.
- **Dispute before settlement:** do not settle while evidence is unresolved.
  Escalate to the product/operations owner and retain official evidence.
- **Dispute after settlement:** stop further operational actions and escalate.
  Neither correction nor voiding is supported for Settled matches; do not
  attempt compensating transactions or promise a points adjustment. Any
  future remedy requires a separately approved policy/change.

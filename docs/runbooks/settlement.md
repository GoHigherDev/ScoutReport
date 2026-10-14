# SR-44 off-chain match settlement

ScoutReport is independent of Socios. This free-to-play console records
non-transferable prediction points, not Socios Reward Points. Match management,
settlement and scoring are stored in Postgres; the admin console submits no
on-chain transactions and uses no server-held signing key.

## Access and match creation

- Apply the Drizzle migrations with `pnpm db:migrate` using authorised local
  environment configuration. Never paste credentials into this runbook.
- Set `ADMIN_ADDRESSES` to approved admin wallets. Open `/admin/matches` and
  sign in through SIWE with an allowlisted wallet. An empty allowlist denies
  access. Every admin page and API verifies the SIWE session and allowlist
  before database work.
- Create a match with sport, sides, optional Fan Token keys and official
  reference, ordered outcomes, and the approved points setting (1–100).
  Admin-entered kickoff and lock times use Europe/London; lock defaults to
  kickoff, and both are stored in UTC. Ambiguous or non-existent clock-change
  times are rejected. Match creation is a Postgres write only.
- Edit only an open, unlocked match. Once a pick exists, outcomes cannot change.
  A postponement may be represented by changing the kickoff and lock before
  lock, or by voiding the match.

## Verify → settle → credit → verify totals → leaderboard refresh

1. **Verify the result from an official source.** Use the football competition
   organiser's published final result or the CS2 tournament organiser's
   official result. Do not use unofficial aggregators, scraped HLTV pages,
   community posts or an inferred score as authority. If evidence conflicts or
   the organiser has not finalised the result, stop and escalate.
2. Find the match in the admin console and confirm its sides, official
   reference, kickoff, outcomes and lock status. Settlement is permitted only
   after lock.
3. Select the result and review the confirmation dialog, which displays the
   match and selected result. Check them against the official source before
   confirming. **Settlement is final:** a settled match cannot be corrected or
   voided in the November build.
4. The server writes the result and runs `scoreMatch` in the same database
   transaction. It clears that match's previous points, then credits the
   configured points once to each correct pick updated before lock. Incorrect
   and late picks receive no score row. Re-running the scorer produces the
   same rows and totals.
5. Select **Credit / recalculate points** to run the same scoring function
   again when needed. Check the reported correct-pick count and total points
   against the official fixture and stored picks. This is an idempotent
   Postgres recalculation, not a wallet batch or transaction.
6. Refresh/requery leaderboard consumers after totals are verified. Season
   totals group points by wallet; weekly totals group by wallet and the Monday
   00:00 Europe/London week of the match's lock time. The season identifier is
   `provisional`. This ticket adds no leaderboard UI or cache invalidation
   service.

Every create, edit, settle, void and credit/recalculation writes an
append-only `admin_audit_log` row in the same transaction as the state change.
It records the admin wallet, action, before/after state, UTC creation time and,
for scoring actions, the returned totals. No transaction hashes are recorded.

## Voids and disputes

- Void only an open match, whether locked or not, and provide the official
  postponement or abandonment reason. Voiding updates the status in Postgres
  and runs `scoreMatch`, which removes all points for the match. A settled
  match cannot be voided.
- For a dispute before settlement, do not settle while evidence is unresolved;
  escalate to the product/operations owner and retain the official source.
- For a dispute after settlement, record the dispute and its official evidence
  in the authorised operational process, then escalate. Record the action in
  the audit log where an admin action is taken. The November build supports no
  correction or void after settlement; do not promise or apply a points
  adjustment. Any future remedy requires a separately approved policy/change.

# Data inventory (SR-13 / F-12 hand-off)

ScoutReport is a third-party SportFi dapp on Chiliz Chain and is not affiliated
with Socios. This scaffold stores no emails, KYC data, analytics cookies,
private keys, credentials, holdings or staking histories. Wallet addresses and
usernames can identify people; treat them as personal data even when public.
SR-14 adds SIWE nonce writes and encrypted browser sessions, not profile writes.

## Persistent fields

There are no profile write routes. SR-44 adds session/allowlist-gated off-chain
match management, picks, prediction points and append-only admin audit writes.
SIWE enforces single use and a ten-minute nonce expiry; new nonce issuance deletes already-expired rows,
including consumed rows. There is no scheduled deletion or automatic database
TTL, so expired rows remain until another nonce is issued. The following
retention descriptions document actual behaviour, not an approved production
retention policy. SR-17 / F-12 drafts the notice and erasure contract; SR-23
implements erasure. Approved production retention and backup disposal are
still required before personal data is
collected in production. Expiry timestamps alone do not delete rows.

| Table / field                                                   | Purpose                                                                                | Current retention                                                                                                                               |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `profiles.address`                                              | Lowercase wallet address; profile primary key                                          | Until profile row is explicitly deleted                                                                                                         |
| `profiles.username`                                             | Optional public alias; case-insensitive uniqueness through `citext`                    | Until replaced, cleared or profile deleted                                                                                                      |
| `profiles.show_holdings`                                        | Opt-in display preference; defaults to false, not a holdings snapshot                  | Until preference changed or profile deleted                                                                                                     |
| `profiles.claimed_chain_id`                                     | Optional chain identifier associated with a profile claim                              | Until cleared/replaced or profile deleted                                                                                                       |
| `profiles.claimed_at`                                           | Optional time of profile claim, with time zone                                         | Until cleared/replaced or profile deleted                                                                                                       |
| `profiles.updated_at`                                           | Time of the latest profile change, with time zone                                      | Until overwritten or profile deleted                                                                                                            |
| `siwe_nonces.nonce`                                             | Unique challenge for SIWE replay protection                                            | Deleted on nonce issuance after its ten-minute expiry                                                                                           |
| `siwe_nonces.created_at`                                        | Time the challenge was created                                                         | Same as nonce row                                                                                                                               |
| `siwe_nonces.expires_at`                                        | Deadline after which auth rejects the challenge                                        | Same as nonce row; no scheduled purge                                                                                                           |
| `siwe_nonces.used_at`                                           | Optional consumption time to prevent reuse                                             | Same as nonce row                                                                                                                               |
| `siwe_nonces.address`                                           | Wallet linked on verified consumption or nonce issuance from a verified session        | Deleted by Predict erasure or expired-nonce cleanup                                                                                             |
| `matches.id`                                                    | UUID identifying an off-chain match                                                    | Until explicitly deleted under SR-41 retention                                                                                                  |
| `matches.sport`                                                 | Football or CS2 sport identifier                                                       | Same as match row                                                                                                                               |
| `matches.home_label` / `away_label`                             | Match side labels and optional Fan Token keys                                          | Same as match row                                                                                                                               |
| `matches.external_ref`                                          | Optional official fixture reference                                                    | Same as match row                                                                                                                               |
| `matches.kickoff_utc` / `lock_at_utc`                           | UTC fixture and pick-lock times                                                        | Same as match row                                                                                                                               |
| `matches.outcomes`                                              | Ordered outcome keys available to picks                                                | Same as match row                                                                                                                               |
| `matches.points_for_correct`                                    | Points credited for a correct pick                                                     | Same as match row                                                                                                                               |
| `matches.status` / `result`                                     | Open, settled or voided state and final outcome                                        | Same as match row                                                                                                                               |
| `matches.void_reason`                                           | Admin-supplied reason for a postponed or abandoned match                               | Same as match row                                                                                                                               |
| `matches.created_by` / lifecycle fields                         | Admin wallet and UTC create/update/settle/void timestamps                              | Same as match row                                                                                                                               |
| `picks.match_id` / `address`                                    | One current pick per wallet and match                                                  | Follows SR-41 retention and erasure                                                                                                             |
| `picks.outcome`                                                 | The wallet's selected match outcome                                                    | Same as pick row                                                                                                                                |
| `picks.signature`                                               | Nullable EIP-712 signature slot; SR-45 owns submission/persistence                     | Deleted with the pick on erasure                                                                                                                |
| `picks.created_at` / `updated_at`                               | Server timestamps used to enforce lock and scoring eligibility                         | Same as pick row                                                                                                                                |
| `prediction_points.match_id` / `address`                        | Match and wallet key for idempotently calculated points                                | Follows SR-41 retention and erasure                                                                                                             |
| `prediction_points.points`                                      | Points for a correct pick; wrong picks have no score row                               | Same as score row                                                                                                                               |
| `prediction_points.week_start_utc` / `season_id`                | UTC Monday week and season aggregation keys                                            | Same as score row                                                                                                                               |
| `prediction_points.credited_at`                                 | UTC time the scoring function last calculated this wallet's row                        | Same as score row                                                                                                                               |
| `admin_audit_log.id`                                            | Random UUID identifying an audit event                                                 | Until explicitly deleted under the F-12 policy                                                                                                  |
| `admin_audit_log.actor_address`                                 | Lowercase wallet identifying the admin actor                                           | Same as audit row                                                                                                                               |
| `admin_audit_log.action`                                        | Identifier of the admin action                                                         | Same as audit row                                                                                                                               |
| `admin_audit_log.payload`                                       | JSON object containing minimal action metadata                                         | Same as audit row                                                                                                                               |
| `admin_audit_log.created_at`                                    | Time of the admin event, with time zone                                                | Same as audit row                                                                                                                               |
| `predict_age_confirmations.address` / `confirmed_at`            | Wallet's positive 18+ self-confirmation and UTC time; no date of birth                 | Until Predict erasure; approved retention pending                                                                                               |
| `predict_terms_acceptances.address` / `version` / `accepted_at` | Wallet, terms version and first UTC acceptance time                                    | Until Predict erasure; approved retention pending                                                                                               |
| `predict_terms_acceptances.country` / `country_check`           | Trusted platform country code or null, and allowed/unknown result; never raw IP        | Same as acceptance row                                                                                                                          |
| `predict_nonces.nonce` / `address` / `expires_at`               | Wallet-linked replay-protection storage for SR-45                                      | Until Predict erasure; expiry is not automatic deletion                                                                                         |
| `predict_rate_limits.address` / `count` / `expires_at`          | Shared authenticated acceptance limit; count resets after a minute on the next request | Erased with the wallet; opportunistic cleanup of up to 100 other rows expired over an hour per eligible authenticated request; no scheduled TTL |
| `prediction_audit.id` / `match_id` / `outcome` / `created_at`   | Pick event metadata; SR-45 owns event insertion                                        | Retained after erasure; approved retention pending                                                                                              |
| `prediction_audit.address` / `signature`                        | Wallet and nullable EIP-712 signature                                                  | Erasure replaces address with keyed pseudonym and nulls signature                                                                               |

The `matches` table stores off-chain fixture metadata and lifecycle state;
there are no chain IDs, derived contract match IDs or transaction hashes.
SR-41 adds nullable signature storage, a wallet-linked nonce table and a Predict
audit table; SR-45 owns submission, signature verification and event insertion.
The intended Predict record includes the wallet
address, pick, EIP-712 signature and timestamps in Postgres. Picks use a free
wallet signature, with no gas or on-chain submission. They support submission
verification, deadline enforcement and scoring. The lawful basis is pending
legal review; the draft retention value is `LEGAL_DETAILS.retention` in
`apps/web/src/copy/names.ts`. The revised draft policy requires Predict aggregates
to be anonymised after 24 months; other retention periods remain unconfirmed.
The Predict audit log is append-only except for erasure. `erasePredictData`
deletes picks, points, terms/18+ records, wallet-linked Predict/SIWE nonces and
acceptance rate-limit rows in one transaction. Audit signatures are removed;
audit wallet columns and fixture admin-wallet metadata are pseudonymised with
HMAC-SHA-256 using restricted server-only `PREDICT_ERASURE_SECRET` (required, at
least 32 characters, held in deployment secret management with access limited to
authorised erasure operators, never exposed in client bundles/logs or committed).
Identifying admin audit payloads are redacted
entirely, including signature copies and mixed-case wallet references.
Retained keyed pseudonyms are not claimed to be anonymous.
The acceptance endpoints require SIWE, same Origin and a shared Postgres rate
limit before acceptance work. Terms records include country code/result from
the trusted platform, never client country or raw IP. Unknown countries fail
closed in production. These processing/retention policies remain draft; no
automatic anonymisation or submission route is added. See
[Predict guardrails](legal/predictions-guardrails.md) and
[DPIA screening](legal/predict-dpia-screening.md).
`prediction_points` is replaced by the
idempotent SR-44 scoring function and stores only correct picks. Their
retention, erasure and backup disposal follow SR-41; SR-44 adds no automatic
deletion.

SR-44 audit actions are `matches.create`, `matches.edit`, `matches.settle`,
`matches.void` and `matches.credit`. Each payload contains before/after state;
scoring actions also include the correct-pick count and total points. Audit
rows are written in the same transaction as the corresponding database action,
and the database rejects updates and deletes except the SR-41 erasure redaction.
They do not store SIWE messages,
signatures, official-source page contents or raw provider errors.

Audit writers must allowlist payload fields per action, not dump request
bodies or sessions. Do not include nonce values, credentials, emails, IPs,
unneeded wallet data or raw provider responses in payloads. SR-44 validates its
action types; any future action needs its own validator.

Drizzle additionally stores migration bookkeeping in
`drizzle.__drizzle_migrations`: `id` (migration row identifier), `hash` (migration
content hash) and `created_at` (migration ordering timestamp). These contain no
user data and remain for the database lifetime to avoid reapplying migrations.
The local Compose volume persists until `docker compose down -v`; provider
backups and platform access-log retention must be covered by F-12/SR-16.

## Transient state and configuration

The encrypted, httpOnly, Secure, SameSite=Lax SIWE cookie contains the verified
wallet address, chain ID, account-code classification and session issuance time.
It expires after seven days and is cleared on logout. A pending nonce is also
held in the cookie to bind verification to its issuing browser, then removed
on successful verification. Nonces, signatures, full messages and cookies are
never logged. `SESSION_SECRET` is server-only environment configuration.

| Field             | Purpose                                                                | Retention                                                                                                                                         |
| ----------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rate-limit key    | Groups auth/write requests; the default is a shared dev key, not an IP | Default entries expire after 60 seconds and are swept at least every 60 seconds (at most 120 seconds in memory); no persistent storage or logging |
| Rate-limit count  | Enforces requests per window                                           | Same as key                                                                                                                                       |
| Rate-limit expiry | Marks the end of the fixed window                                      | Same as key                                                                                                                                       |

Production must inject a shared limiter and a trusted key resolver. Any
IP-derived keys must have short TTLs and must not become audit or application
logs. The scaffold does not read forwarded-IP headers or log IP addresses.
Hosting access logs are outside this in-memory limiter and need separate
deployment review.

`DATABASE_URL`, RPC URLs and `ADMIN_ADDRESSES` are environment-only
configuration, not database fields. `ADMIN_ADDRESSES` contains admin wallets;
keep access restricted. The committed `.env.example` contains empty placeholders
only; Compose's password default is explicitly local-only. Health probes return
only dependency status, do not persist probe results and do not reveal errors.

## SR-56 browser-only declaration and estimates

SR-56 adds no database field, session, report collection or server-side wallet
preference. `scoutreport:rp-declaration:<lowercase connected address>` in browser
`localStorage` contains only `true` or `false`, defaulting to false if absent or
storage is unavailable. It is not verification. The current implementation keeps
this flag in the browser; the revised legal policy permits reported RP to be sent
only with consent, which can be withdrawn. No report-submission flow or
consent-transmission mechanism is added by SR-17. The draft describes the RP
Estimate panel as showing holdings only and assuming a Socios Wallet based on
the user's declaration, not verified wallet identity.
Unchecking saves false; clearing site storage removes
it. It remains in that browser until changed/cleared. Address switches and
disconnects immediately hide figures; reconnecting restores only that address's
own declaration. This local key contains a public address, still personal data.

Future calibrated snapshots use the existing public Mainnet read client; wallet
addresses are arguments to ordinary on-chain reads, not submissions of the
declaration. Midnight/midpoint, pool/day/block-hash, wallet snapshots and upgrade
checks are cached in bounded in-memory maps (up to 256 entries per map); they
disappear when the browser context closes or entries are evicted. Failed reads
are not retained as successful zeros. UI query data is address-keyed and removed
when its last observer unmounts. No estimate snapshot requests run when the flag
is off, the address is undeclared, or no usable calibration exists. Existing
wallet holdings/account-context reads are unchanged.

`FEATURE_RP_ESTIMATE` is server-only configuration and defaults false. The public
calibration list is empty: no real theta, individual reports, reporter addresses,
RP balance/history or pool values have been provided or persisted by this work.
Only synthetic test fixtures contain illustrative RP parameters.

## SR-17 draft legal notice and display rules

`/privacy` and `/terms` are static drafts, marked “Draft, pending legal review”.
All legal copy and the shared controller/contact/retention placeholders live in
`apps/web/src/copy/names.ts`. No approved controller, contact, lawful basis,
complete production retention schedule, provider/transfer assessment or backup-disposal
policy has been supplied. The notice must not be treated as legal approval.
The draft is version 0.2, last updated 14 October 2026. Both pages state that the
service is for users 18 or over and does not knowingly process children's data;
the terms also state the 18+ eligibility requirement. Public Chiliz Chain records
are the source of chain data. Sign-in and rights requests require a wallet
signature; sign-in costs no gas and moves no funds. The notice includes the
right to object and no solely automated decisions with legal or similarly
significant effects. User-facing copy points to the privacy contact, not internal
tickets, schemas or endpoint notes.

The revised draft wording is: “On erasure, we delete your picks, terms-acceptance
records and stored signatures, and pseudonymise your audit-log entries, which
are kept.” The processing policy above remains to be implemented; SR-17 changes
the draft and contract only, not the existing backend or RP panel behaviour.

Wallet addresses can be personal data when linked to a person, as discussed in
ICO distributed-ledger guidance; truncation is not anonymisation. Shared
`AddressDisplay` truncates addresses and shows a name only when the profile is
claimed and explicitly visible. Its full-address tooltip is absent by default;
only the connected user's own `WalletButton` opts in with `showFullAddressTitle`.
`ProfileHoldings` defaults to hidden and requires
claim, visibility and `showHoldings` opt-in. Public profile consumers must use
these safeguards and avoid fetching/serialising hidden holdings in the first
place; a rendering guard is not server-side access control. The existing
connected-wallet holdings/optimiser is the user's private view, not public
publication. SR-23 owns preference persistence and toggle UI.

Only the essential SIWE session cookie is used by the app; AppKit analytics is
disabled. `apps/web/src/privacy-guardrails.test.ts` prevents known tracker
packages/scripts and duplicated shared legal placeholders.

## DELETE /api/profile contract (SR-23 / S-05 implementation, not available yet)

- **Request:** same-origin `DELETE /api/profile`, no body or address parameter.
  Derive the target address only from the verified SIWE session, never from
  client-supplied identity. Require the encrypted session cookie and a valid
  seven-day `issuedAt` lifetime. Verify the request Origin against the configured
  site origin to prevent cross-site requests; reject a missing/untrusted Origin.
- **Cost protection:** apply the shared production rate limiter and trusted
  rate-limit key resolver before any session-dependent DB work. Fail closed
  when these are absent; no unauthenticated request may trigger paid DB/RPC
  work. This action needs no RPC call or on-chain transaction.
- **Deletion:** atomically delete the profile row (`address`, `username`,
  `show_holdings`, `claimed_chain_id`, `claimed_at`, `updated_at`), all picks
  belonging to that wallet, terms-acceptance and 18+ records, wallet-linked
  nonces, acceptance rate-limit rows and their stored signatures
  (including future SR-45 signature/nonce records) and related
  `prediction_points` rows. Pseudonymise the wallet's audit-log entries, which
  are kept. Remove identifying wallet addresses and payload references; all
  stored copies of raw signatures, including audit payloads, must be deleted
  rather than retained under a pseudonymous label. Invalidate
  derived off-chain public-profile caches. Delete dependent records even if the
  profile row is already absent; do not leave orphaned signatures or
  terms-acceptance records. The retained append-only audit history must not
  contain recoverable wallet identifiers or signatures after erasure.
- **Response:** `204 No Content`, empty body, `Cache-Control: no-store`; clear
  the session cookie after a successful commit. Repeating deletion with a valid
  session is idempotent; the cleared cookie requires sign-in for another call.
  Missing/invalid/expired session: `401`; untrusted Origin: `403`; rate limit:
  `429` with `Retry-After`; unexpected failure: generic `500`, with no partial
  deletion, cookie clearing or sensitive error detail. Follow the existing
  `{ code, message }` error shape.
- **Limits:** on-chain transactions, balances and history cannot be erased.
  Fixture metadata is not deleted by this profile action. Audit-log entries
  are kept but must be pseudonymised as above, not left identifiable. The current
  database rejects audit updates/deletes/truncation except the narrow SR-41
  erasure operation, which redacts identifying payloads/signatures. SR-23 must
  coordinate profile deletion atomically with `erasePredictData` before this
  endpoint is available; no endpoint is built in SR-41. Predict aggregates must be anonymised
  after 24 months; retention periods for retained pseudonymised audit entries,
  picks, signatures and terms records remain pending confirmation.
  No automatic database TTL exists; production must separately approve and
  implement backup expiry/disposal and prevent restored backups from republishing
  deleted data. Browser-only declarations can be removed by clearing site storage.
- **Scope:** this section defines the future contract only. SR-17 adds no route,
  profile toggle, schema change, private key or on-chain write.

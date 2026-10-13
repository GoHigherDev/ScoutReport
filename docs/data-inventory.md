# Data inventory (SR-13 / F-12 hand-off)

ScoutReport is a third-party SportFi dapp on Chiliz Chain and is not affiliated
with Socios. This scaffold stores no emails, KYC data, analytics cookies,
private keys, credentials, holdings or staking histories. Wallet addresses and
usernames can identify people; treat them as personal data even when public.
SR-14 adds SIWE nonce writes and encrypted browser sessions, not profile writes.

## Persistent fields

There are no profile or admin write routes. SIWE enforces single use and a
ten-minute nonce expiry; new nonce issuance deletes already-expired rows,
including consumed rows. There is no scheduled deletion or automatic database
TTL, so expired rows remain until another nonce is issued. The following
retention descriptions document actual behaviour, not an approved production
retention policy. F-12 must define and implement
production retention, erasure and backup disposal before personal data is
collected in production. Expiry timestamps alone do not delete rows.

| Table / field                   | Purpose                                                               | Current retention                                                      |
| ------------------------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `profiles.address`              | Lowercase wallet address; profile primary key                         | Until profile row is explicitly deleted                                |
| `profiles.username`             | Optional public alias; case-insensitive uniqueness through `citext`   | Until replaced, cleared or profile deleted                             |
| `profiles.show_holdings`        | Opt-in display preference; defaults to false, not a holdings snapshot | Until preference changed or profile deleted                            |
| `profiles.claimed_chain_id`     | Optional chain identifier associated with a profile claim             | Until cleared/replaced or profile deleted                              |
| `profiles.claimed_at`           | Optional time of profile claim, with time zone                        | Until cleared/replaced or profile deleted                              |
| `profiles.updated_at`           | Time of the latest profile change, with time zone                     | Until overwritten or profile deleted                                   |
| `siwe_nonces.nonce`             | Unique challenge for SIWE replay protection                           | Deleted on nonce issuance after its ten-minute expiry                  |
| `siwe_nonces.created_at`        | Time the challenge was created                                        | Same as nonce row                                                      |
| `siwe_nonces.expires_at`        | Deadline after which auth rejects the challenge                       | Same as nonce row; no scheduled purge                                  |
| `siwe_nonces.used_at`           | Optional consumption time to prevent reuse                            | Same as nonce row                                                      |
| `admin_audit_log.id`            | Random UUID identifying an audit event                                | Until explicitly deleted under the F-12 policy                         |
| `admin_audit_log.actor_address` | Lowercase wallet identifying the admin actor                          | Same as audit row                                                      |
| `admin_audit_log.action`        | Identifier of the admin action                                        | Same as audit row                                                      |
| `admin_audit_log.payload`       | JSON object containing minimal action metadata                        | Same as audit row                                                      |
| `admin_audit_log.created_at`    | Time of the admin event, with time zone                               | Same as audit row                                                      |

Future audit writers must allowlist payload fields per action, not dump request
bodies or sessions. Do not include nonce values, credentials, emails, IPs,
unneeded wallet data or raw provider responses in payloads. The schema has no
approved action types yet; those validators belong to the stories adding writes.

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
storage is unavailable. It is not verification and is never transmitted,
including to RPC providers. Unchecking saves false; clearing site storage removes
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

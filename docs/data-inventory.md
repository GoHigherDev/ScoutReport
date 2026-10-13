# Data inventory (SR-13 / F-12 hand-off)

ScoutReport is a third-party SportFi dapp on Chiliz Chain and is not affiliated
with Socios. This scaffold stores no emails, KYC data, analytics cookies,
private keys, credentials, holdings or staking histories. Wallet addresses and
usernames can identify people; treat them as personal data even when public.
Feature tables and SIWE session issuance belong to later stories.

## Persistent fields

The scaffold only creates tables; it has no profile, auth or admin write routes.
There is no scheduled deletion or automatic database TTL. All rows currently
remain until explicitly deleted. The following retention descriptions document
actual behaviour, not an approved production retention policy. F-09 must add
nonce expiry/use enforcement and disposal; F-12 must define and implement
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
| `siwe_nonces.nonce`             | Unique challenge for future SIWE replay protection                    | Until explicitly deleted; F-09 must dispose of expired/used challenges |
| `siwe_nonces.created_at`        | Time the challenge was created                                        | Same as nonce row                                                      |
| `siwe_nonces.expires_at`        | Deadline after which future auth code must reject the challenge       | Same as nonce row; no automatic purge                                  |
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

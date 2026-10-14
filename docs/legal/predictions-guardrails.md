# Predict guardrails — SR-41

**Draft, pending legal review. Not legal advice. For counsel to confirm.**
This is an implementation and review checkpoint, not a legal conclusion,
regulator approval or approval by general counsel. ScoutReport is independent
of Socios. The November Predict build is free, off-chain and wallet-signed:
EIP-712 messages, Postgres storage, no gas, transaction or predictions contract.
Existing contract experiments are not part of this Predict flow.

## Eligibility and API integration

- SR-45 must call `assertPickEligibility(verifiedSession, request)` from
  `apps/web/src/server/predict.ts` before accepting every new or replacement
  pick. No pick-submission route exists at this checkpoint.
- Require a valid SIWE session, a persisted positive 18+ confirmation, acceptance
  of `PREDICT_TERMS_VERSION` (`0.3`), and a permitted country at submission time.
  A stale version is not acceptance of current terms. Change the version and
  the displayed legal revision together whenever terms change.
- No CHZ, Fan Token or RP balance is read or required. Prediction points are
  non-transferable, have no cash value and cannot be redeemed. There is no
  prize/reward/redemption feature flag or implementation in this module.
- `POST /api/predict/age-confirmation`: strict JSON `{ "confirmed": true }`.
- `POST /api/predict/terms-acceptance`: strict JSON `{ "version": "0.3" }`;
  requires the 18+ record. Neither endpoint accepts an address, country, date
  of birth or IP from the client.
- Both endpoints validate Origin against `NEXT_PUBLIC_SITE_URL`, decrypt and
  validate the SIWE session, then consume a shared Postgres rate limit of
  20 requests per wallet per minute across both endpoints. Authentication and
  Origin rejection occur **before any paid DB work**, including rate limiting.
  The bounded bodies are validated before acceptance writes. Responses are
  `no-store`; failures use existing 400/401/403/429/500 response conventions.
  Repeated acceptance is idempotent and retains the first acceptance timestamp.
- Rate-limit rows hold wallet, count and expiry, not IP. Expiry resets the
  counter on the next request. Each authenticated, same-origin, country-eligible
  limiter call also deletes at most 100 other rows whose expiry is over an hour
  old, oldest first, using the expiry index and skipping locked rows. Active and
  recently expired limits are not removed. The current wallet is excluded from
  cleanup and its expired counter is reset atomically. This opportunistic purge
  needs request traffic; it is not a scheduled TTL or a fixed deletion deadline.
  Erasure also deletes the wallet's row.

## Trusted country configuration

`trustedPredictCountry` reads only the platform-overwritten
`x-vercel-ip-country` header when `VERCEL=1`. The deployment must be on Vercel
with that header overwritten, and must not expose an alternative ingress that
preserves a client-supplied value. Merely setting `VERCEL=1` on another host is
**not** a trust mechanism. A different platform requires a reviewed, server-side
resolver and spoofing tests before enablement. Raw IP is neither stored nor logged.
Missing/non-ISO/`XX` countries fail closed in production; non-production may
use an unknown result for local testing. Country is checked again for every
pick, never just at terms acceptance.
Preview deployments must also run with `NODE_ENV=production`; only local
development/tests may use the unknown-country allowance.

The default typed draft list is in `predict-config.ts`:

- Legal's named exclusions: US (USA), AU (Australia), NL (Netherlands),
  IT (Italy), FR (France), BE (Belgium).
- GB (United Kingdom): country-level data cannot distinguish Northern Ireland,
  so **all GB is conservatively blocked**, pending counsel's regional decision.
- Conservative UK/OFAC country/regional sanctions screening seed: AF, BY, MM,
  CF, CN, CU, CD, HT, IR, IQ, LB, LY, KP, RU, SO, SS, SD, SY, UA, VE, YE, ZW.
  This intentionally over-inclusive draft is **not** a claim that each country
  is comprehensively sanctioned, or that country filtering screens designated
  people/entities. UA is whole-country blocking for regional restrictions.
  Scope, omissions, territorial codes and changes require counsel confirmation.

`PREDICT_BLOCKED_COUNTRIES` optionally replaces that list with comma-separated
uppercase two-letter codes. Empty or malformed configuration fails closed;
unset uses the draft. Only maintainers may set it after counsel review. Check
UK and OFAC sources in [data sources](data-sources.md) at review and before
release. Do not infer legal eligibility from country checking alone.

## Erasure hand-off to SR-23

`erasePredictData(address)` validates and normalises the address and requires an
independently generated, restricted server-only `PREDICT_ERASURE_SECRET` of at
least 32 characters. Store it in deployment secret management and restrict access
to authorised erasure operators; never expose it in client bundles or logs.
Never commit its value. No database work occurs if it is missing.
HMAC-SHA-256 produces `erased:<digest>` without storing an address-to-digest
mapping. This is pseudonymisation, not a claim of irreversible anonymisation:
restrict secret access, retention and backups separately.

Migration `0003_predict_guardrails.sql` installs `erase_predict_data`, invoked
in one transaction. It first locks affected matches in ID order, serialising
with existing scoring/admin writers before scanning their committed audit rows.
It deletes picks (including signatures), points,
terms/18+ records, Predict nonces, wallet-linked SIWE nonces and rate-limit
rows. It nulls Predict audit signatures, replaces wallet columns with the
keyed digest and removes entire identifying admin audit payloads, including
signature copies. Fixture admin-address metadata is pseudonymised too, so
retained audit fixture IDs cannot recover the erased admin address by joining
to a match. Fixture sporting metadata and audit IDs/actions/times remain.
Unrelated wallets are not erased.

Audit triggers forbid updates, deletes and truncation outside the narrow
erasure exception; erasure may change only identity/signature fields (or
redact identifying admin payloads), not event content. Transaction-local
erasure markers are cleared before return. These are application-integrity
guards, not a security boundary against the database owner: restrict direct
SQL/table-write access. The function is SECURITY INVOKER and PUBLIC execution
is revoked; the migration owner can execute it. If deployment uses a separate
service role, grant only that role the function and necessary table privileges.

SR-23 owns `DELETE /api/profile`, profile deletion, cookie invalidation and
cache invalidation. It must use the session wallet and coordinate profile
deletion atomically by passing its transaction to `erasePredictData(address, tx)`;
it must not clear the cookie before
commit. No profile deletion endpoint is added here. See the
[data inventory](../data-inventory.md) for the complete endpoint contract.
Backup expiry/restoration controls and the draft 24-month aggregate
anonymisation requirement still need implementation and retention approval;
they are not provided by this erasure function.

## Legal and copy review checkpoint

- Keep `/privacy` and `/terms` marked **Draft, pending legal review**.
- Review the existing lawful-basis placeholders and the additional
  `[PREDICT ELIGIBILITY AND COUNTRY RESTRICTIONS — FOR COUNSEL TO CONFIRM]`
  clause; no legal clauses or approvals are inferred.
- All new public copy is in `NAMES` in `apps/web/src/copy/names.ts`. The terms
  banner uses the copy-owner-approved `NAMES.predict.freeToPlayBanner` text;
  SR-45 will consume the same copy for its interface.
- Counsel confirms country restrictions, eligibility, terms, lawful bases,
  retention, providers/transfers and the [DPIA screening](predict-dpia-screening.md)
  before merge/release. Copy owner signed off the new strings on 14 October 2026;
  legal wording remains under separate Legal & Compliance review.
- AppKit analytics remains off. The SR-17 tracker guardrail still applies.
- No prize fulfilment, sponsorship, Mainnet writes, deployment or contracts
  form part of this ticket.

## Verification

`predict.test.ts` directly covers missing 18+, absent/stale acceptance, every
draft blocked country, unknown/untrusted production country, zero-asset
eligibility without RPC/RP lookup, Origin/session rejection before DB work,
rate limits and no prize implementation/configuration. `legal-pages.test.tsx`
checks the draft pages, approved free-to-play banner and valueless points.

`predict.integration.test.ts` applies real migrations to a **disposable**
Postgres database and tests real encrypted sessions, the shared rate limit,
atomic erasure/rollback, unrelated-wallet preservation, audit immutability and
removal of an EIP-712 signature whose signer is demonstrably recoverable before
erasure. CI provides this database. Locally set `PREDICT_TEST_DATABASE_URL` to
a dedicated test database, then run `pnpm turbo run lint typecheck test`.
Without that variable only the database integration suite is skipped.

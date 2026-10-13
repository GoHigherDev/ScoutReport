# ADR 0003: Rewards Optimizer data strategy

- Ticket: SR-50 [R-01]
- Date: 13 October 2026
- Status: Proposed; caveat copy approved (AC7), not an approval of this ADR.
- Evidence: [data-access research](../research/optimiser-data-access.md),
  including pipeline sources retrieved 13 Oct 2026, SR-30 maintainer reads and
  [SR-50 maintainer capture/ACs](https://github.com/GoHigherDev/ScoutReport/pull/32#issuecomment-6148508386),
  [detailed inline capture](https://github.com/GoHigherDev/ScoutReport/pull/32#issuecomment-6148857196)
  and [four-caveat approval](https://github.com/GoHigherDev/ScoutReport/pull/32#issuecomment-6148594790).

## Context

ScoutReport is not affiliated with Socios and has no Partner API credentials.
Mainnet holdings/staking and individual Survey3 polls have public read
interfaces. Exhaustive poll discovery, team mapping, wallet-brand detection
and RP inputs are not reliably available from the supplied evidence.
The sandbox cannot reproduce live RPC reads. The maintainer ran `all.ts` at
head dbd7b72: 103/103 reads succeeded on Mainnet at block 38378088.
The detailed inline capture resolves the gist-access blocker; answers, tallies,
user hashes and wallet probes are transcribed separately from sandbox failures.
Raw logs remain captured, not transcribed (counts only). Five samples share a
90-byte runtime code hash without establishing Socios Wallet brand.
Exact downstream Jira ACs are now supplied; no story scope is inferred.

## Decision

1. Keep APP_CHAIN on Spicy for ScoutReport development; DATA_CHAIN is Mainnet
   88888, strictly read-only. Reuse verified staking ABI/config/helpers.
   Reference SR-30's Spicy check; no official alternative deployment is assumed.
2. Base future information views only on evidenced balance/staking reads and
   individually validated poll contracts. Capture block/time and disclose
   missing/stale data. Read token decimals on-chain. Do not sum overlapping
   staking fields or treat pending unstake as liquid holdings.
3. Treat Vote logs/explorer/community lists as incomplete candidate discovery,
   not an authoritative all-poll feed or evidence of token/team association.
   Require curated provenance or approved Partner API access before promises
   of coverage. No canonical factory is established by the two EOA deployments.
4. Do not calculate RP/day, pool yields, marginal allocation or numerical point
   efficiency without a licensed, reliable pool/denominator/eligibility source
   and an approved methodology. SR-61's actual AC permits only source-confirmed
   earn-route flags; Fan Zone and other unconfirmed routes remain excluded.
   Do not scrape the Socios app/private API.
5. Never infer Socios Wallet brand or RP eligibility from code presence/hash or
   connector branding. Keep it UNKNOWN pending authenticated/validated evidence.
6. Partner API is optional and gated on confirmed indie access, Due Diligence,
   Terms, licensing, quotas and consent where required. No access requests,
   forms, keys or API response assumptions in this spike.
7. The four caveats are **approved as drafted by Brave**, unchanged, on
   13 October 2026 at 16:04 UK (linked approval); **AC7 is met**.
   This does not approve a detection heuristic or all future UI wording.
   Map R-02–R-08 to the supplied ACs as individually listed in the research
   table: holdings checklist, cooldown, RP caveat, curated registry, watchlist,
   dashboard and dossier/disabled adapter. SR-54/SR-55 remain parked until
   after Brave's test; all stories remain To Do, not implemented in this spike.
   Missing inputs must be unavailable, never fabricated estimates.
8. No unauthenticated endpoint may trigger paid DB/RPC work without a rate
   limit or a cache. This spike adds no routes: read-only CLI scripts only.
   Future private data additionally requires authentication/consent.

## SR-56 amendment: approved current-holdings estimate scope

The 13 October SR-56 clarification (PR comment `6153503217`)
supersedes the original cost/persistence scope and the blanket RP-estimate
exclusion above for this specific, clearly labelled model. It does not supply a
real RP pool parameter or approve an official-data claim. The shipped calibration
configuration is empty and `FEATURE_RP_ESTIMATE` defaults off in every environment.
Missing data remains unavailable, not fabricated.

The panel is only for the connected owner; the Socios Wallet declaration defaults
off and persists per address solely in browser `localStorage`, sent nowhere.
No authentication, signing, sessions, report collection, per-profile DB
persistence, prices, costs, numerical ordering or acquisition/staking CTAs are
included. EOA/contract code is contextual, never proof of wallet brand.
Source-confirmed and unconfirmed SR-61 route flags remain unchanged.

Future approved calibration must document theta and residual provenance, at
least five distinct wallets and seven report days in a fourteen-day window,
holdout error no greater than 25%, calibration date/block and an approved
pool-drift tolerance. These gates are not RP rates. The client-only model uses
S/T × theta at the last block strictly before midnight UTC, on-chain decimals at
that block, and `totalStake` excluding pending unstake. Snapshot failures or
post-calibration `Upgraded` events hide estimates until verified replacement
calibration is supplied. External-wallet inputs and CHZ are never eligible.
Bands use holdout log residuals ln(actual / predicted): central ×
exp(quantile × sqrt(1 + 1 / distinct reporters)), normally P10/P90 and widened to
P5/P95 for calibration/read age of at least 24 hours, an explicitly supplied open
`driftAlert`, or pool drift beyond the approved tolerance. These states show
“recalibrating”; no arbitrary automated alert policy is introduced.
Read freshness uses snapshot read/verification time, not the midnight block
boundary. Prior-day snapshots fail closed at midnight rather than remaining
visible with wider bands. Non-finite results are unavailable. A total requires valid
calibration for every current holding. See the [implementation notes](../../README.md#rewards-optimizer).
No new unauthenticated DB/RPC endpoint or polling is introduced. Real calibration
and the deferred watched-poll integration require follow-up evidence.

## Alternatives considered

- Partner API first: could supply discovery/catalogue metadata, but no access
  is confirmed and removed user-poll endpoints cannot be assumed available.
- Full-chain Vote indexing: useful partial discovery, but misses no-vote polls
  and cannot alone establish affiliation/team/token mapping.
- App scraping or private endpoint reverse engineering: rejected, out of scope
  and ToS/privacy risk.
- RP estimates from total on-chain stake: rejected; externally held stakes can
  be RP-ineligible and daily pool/denominator inputs are unavailable.
- Universal smart-wallet code hash: rejected without labelled deployment and
  upgrade evidence; shared proxy code does not establish brand.

## Consequences and review triggers

Public-chain information work can be designed without inventing RP data, but
the optimiser cannot promise RP optimisation or complete poll coverage.
Fallbacks are narrower information views only if Brave accepts them; they do
not silently change downstream ticket scope. No production changes follow
automatically from this ADR.

Revisit when complete log history is available, new copy needs approval,
Socios confirms access/licensing and RP rules, or verified deployment/
factory/wallet evidence changes. Record each new source/date and any reorg,
upgrade, freshness, privacy or cost-control implications before granting GO.

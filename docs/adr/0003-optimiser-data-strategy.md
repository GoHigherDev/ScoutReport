# ADR 0003: Rewards Optimizer data strategy

- Ticket: SR-50 [R-01]
- Date: 13 October 2026
- Status: Proposed; pending Brave's caveat approval and missing Jira story scopes.
- Evidence: [data-access research](../research/optimiser-data-access.md),
  including pipeline sources retrieved 13 Oct 2026 and SR-30 maintainer reads.

## Context

ScoutReport is not affiliated with Socios and has no Partner API credentials.
Mainnet holdings/staking and individual Survey3 polls have public read
interfaces. Exhaustive poll discovery, team mapping, wallet-brand detection
and RP inputs are not reliably available from the supplied evidence.
The sandbox cannot reproduce live RPC reads; supplied observations are
separately attributed, and one CLI hand-off collects the outstanding reads.

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
4. Do not calculate RP/day, pool yields, marginal allocation or point efficiency
   (including SR-61) without a licensed, reliable pool/denominator/eligibility
   source and an approved methodology. Do not scrape the Socios app/private API.
5. Never infer Socios Wallet brand or RP eligibility from code presence/hash or
   connector branding. Keep it UNKNOWN pending authenticated/validated evidence.
6. Partner API is optional and gated on confirmed indie access, Due Diligence,
   Terms, licensing, quotas and consent where required. No access requests,
   forms, keys or API response assumptions in this spike.
7. All caveat wording is **Draft, pending Brave's approval**. R-02–R-08 build
   decisions await their actual ACs, as individually listed in the research
   table. Missing inputs must be unavailable, never fabricated estimates.
8. No unauthenticated endpoint may trigger paid DB/RPC work without a rate
   limit or a cache. This spike adds no routes: read-only CLI scripts only.
   Future private data additionally requires authentication/consent.

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

Revisit when maintainers supply the CLI capture and Jira ACs, Brave approves
copy, Socios confirms access/licensing and RP rules, or verified deployment/
factory/wallet evidence changes. Record each new source/date and any reorg,
upgrade, freshness, privacy or cost-control implications before granting GO.

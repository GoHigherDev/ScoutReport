# Predict DPIA screening — SR-41

**Draft, pending legal review. Not legal advice.**
Screening checkpoint: 14 October 2026. Controller/privacy contact are the
existing `LEGAL_DETAILS` placeholders, not inferred identities. This screening
does not assert ICO approval or replace a controller/counsel decision.

## Processing screened

Free off-chain EIP-712 picks; wallet addresses, signatures, submission times,
derived non-transferable points and audit events in Postgres. Eligibility uses
a verified SIWE session, positive 18+ self-confirmation, current terms acceptance
and server-derived country. No gas, transactions, prizes, redeemable value,
asset/RP eligibility lookup, date of birth, raw IP storage or analytics.

## Risk indicators and safeguards

| Indicator                                    | Draft screening assessment                                                                                                                                                                                                                 |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Evaluation/profiling                         | Picks are scored and points aggregated. Public ranking/display in later tickets could link behaviour to a public wallet; review scale, visibility and potential effects before launch.                                                     |
| Systematic monitoring/linkage                | Repeated wallet-linked activity and immutable public chain history allow linkage; EIP-712 signatures can recover an address even after its text column is removed. Treat addresses/signatures as personal data.                            |
| Innovative technology                        | Wallet authentication/signatures and public-chain linkage warrant documented assessment; Predict itself does not write to a chain.                                                                                                         |
| Vulnerable people                            | Service is 18+, with an explicit recorded self-confirmation. This does not reliably establish age; counsel must assess adequacy and exclusion/accessibility risks.                                                                         |
| Automated exclusion                          | Country/age/terms gates refuse submissions. Do not infer a legal conclusion about significant effects from this screening; review the existing privacy wording with counsel.                                                               |
| Scale, sensitive data and combining datasets | Production scale is not supplied. No special-category fields or third-party datasets are added here, but wallet linkage and future public displays may reveal more than intended.                                                          |
| Retention, erasure and transfers             | Retention periods, provider locations, safeguards and backup disposal remain unresolved. Transactional erasure deletes signatures/nonces and pseudonymises retained audits; HMAC output remains pseudonymous, not automatically anonymous. |

Safeguards implemented in SR-41: authenticated same-origin rate-limited
acceptance; fail-closed unknown production country; no client country trust;
minimal age/terms records; no balances/RP dependencies; no prize path; keyed
audit pseudonymisation and signature removal; database append-only controls
with a narrow erasure exception; regression tests; analytics kept off.
Safeguards do not establish a lawful basis or eliminate re-identification risk.

## Screening outcome and full DPIA checkpoint

**Draft outcome: proceed to a full DPIA before production Predict processing.**
Potential profiling, persistent wallet linkage and innovative technology provide
multiple risk indicators; unknown scale, age-assurance adequacy and public
ranking plans prevent a defensible “no DPIA needed” conclusion at this
checkpoint. This is a conservative engineering recommendation, not a statement
that a full DPIA is legally mandatory or that residual risks are acceptable.
Counsel/controller must confirm and document the final necessity decision.

Before release, the controller/privacy reviewer must record the full DPIA (or
a reasoned alternative screening decision), purposes and lawful bases,
necessity/proportionality, scale, access/visibility, affected people,
provider/transfer and backup controls, retention, age assurance, threat model,
rights handling, residual risk and named approval/date. Seek appropriate advice
about any unmitigated high risk. Do not mark this draft approved on the strength
of a passing code test.

See [guardrails](predictions-guardrails.md), [sources](data-sources.md) and
[data inventory](../data-inventory.md). SR-23 implements the profile deletion
endpoint; SR-45 implements submission and its UI. Neither is implemented here.

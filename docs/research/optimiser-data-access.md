# SR-50 [R-01]: Rewards Optimizer data accessibility

ScoutReport is a third-party dapp on Chiliz Chain, **not affiliated with Socios**.
Rewards Optimizer is the approved display name (`NAMES.optimiser`). This is a
research spike, not a production integration or permission to send transactions.

## Timebox, outcome and evidence standard

Timebox: **at most three working days**, starting 13 October 2026; initial
research and local validation on 13 October. Network/access blockers are handed
off, not a reason to extend the spike indefinitely. No sign-ups, forms, contact
with Socios, app scraping, private endpoints, credentials or transactions.

**GO for verified Mainnet holdings/staking reads and explicitly curated poll
reads; NO-GO for RP estimates, automatic wallet-brand detection or a claim of
complete poll coverage.** All build stories remain subject to their actual Jira
acceptance criteria and the gates below. No optimiser build should start on an
assumed feed. See [ADR 0003](../adr/0003-optimiser-data-strategy.md).

External sources below were **retrieved 13 Oct 2026 by the issue pipeline**;
they were not independently fetched in this sandbox. Distinguish:

- **ABI evidence:** interface/types only, not implementation semantics.
- **Pipeline evidence:** supplied public-doc and Mainnet observations in
  [SR-50 / issue #31](https://github.com/GoHigherDev/ScoutReport/issues/31).
- **Maintainer evidence:** block-pinned SR-30 reads, linked below.
- **Local evidence:** offline tests and failed RPC connectivity, not live reads.
- **UNKNOWN:** unavailable or insufficient evidence; never substitute a zero,
  fabricated response, yield, token association or approved wording.

## Data accessibility matrix

Story references are dependency candidates, **not invented ticket scopes**.
R-02–R-08 = SR-51–SR-57; their full Jira descriptions were not supplied or found
in this repository/GitHub issues. SR-61's known point-efficiency routes depend
on the RP rows. Brave must confirm the exact mapping before any build.

| Data item                                                         | Source                                      | Access requirements                                                                                            | Reliability / limits                                                                                                                                                                 | Evidence link                                                                                                                                                           | Stories affected                                            |
| ----------------------------------------------------------------- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Fan Token liquid balance, decimals, transfers                     | On-chain                                    | Mainnet RPC, verified configured token proxy, `balanceOf`, `decimals`, `Transfer` logs                         | High at a named block; reorgs, RPC limits, proxies and historical completeness matter. Never hardcode decimals                                                                       | [Token catalogue](https://docs.chiliz.com/quick-start/token-contract-addresses), [config](../../packages/chain/src/tokens.config.ts)                                    | R-02–R-08 wherever holdings are needed; mapping pending     |
| Stake and per-token total stake/stakers                           | On-chain                                    | Verified staking proxy/ABI; `getStakeDataLatest` by `eth_call`, `getStake`, `getTotalStake`, `getTotalStakers` | Two-token SR-30 samples verified; not RP or all accounting semantics                                                                                                                 | [SR-30 capture](chat-staking-spike.md#maintainer-run-block-pinned-capture), [staking guide](https://connect.socios.com/interact-with-chiliz-chain/working-with-staking) | R-02–R-08 staking-dependent work; mapping pending           |
| Pending unstake, claimable, locks, cooldown                       | On-chain                                    | Raw stake tuple and lifecycle events                                                                           | Pending amounts verified; non-zero matured claimable/overlaps UNKNOWN. Per-operation deadline from `Unstake.claimableAt`, not tuple                                                  | [SR-30 exact interface](chat-staking-spike.md#exact-read-interface), [ABI](../../packages/chain/abis/staking.json)                                                      | R-02–R-08 cooldown-dependent work; mapping pending          |
| Official Socios staking on Spicy                                  | Unknown beyond sampled address              | Official deployment evidence                                                                                   | No code at Mainnet proxy address on Spicy; alternative official deployment UNKNOWN. ScoutReport mocks are not Socios                                                                 | [SR-30 provenance](chat-staking-spike.md#evidence-and-provenance)                                                                                                       | All build/test strategies                                   |
| Poll question, answer IDs/text/tallies, user answer hashes        | On-chain                                    | Poll address, Survey3 ABI, public wallet address, RPC                                                          | Sample reads supplied; one poll is not an exhaustive poll feed. Tallies are raw values, not RP                                                                                       | [Poll guide](https://connect.socios.com/interact-with-chiliz-chain/working-with-polls), [ABI](../../packages/chain/abis/survey3.json)                                   | R-02–R-08 poll-dependent work; mapping pending              |
| Poll start/end, state, cap, binding/whitelist flags, quorum       | On-chain                                    | `startDate`, `endDate`, `getState`, `votingCap`, `isBinding`, `whitelistEnabled`, `getQuorum(uint8)`           | Times are on-chain; flags/cap alone do not prove a wallet can vote. Quorum scale/eligibility semantics need implementation evidence                                                  | [Survey3 provenance](#polls-survey3-interface-and-discovery)                                                                                                            | R-02–R-08 scheduling/eligibility work; mapping pending      |
| Exhaustive poll discovery, team/token association                 | Partner API / unknown completeness on-chain | `GET /polls`, approved API access; otherwise curated addresses or bounded logs/explorer                        | Vote logs miss polls with no votes. No factory shown by sampled creations; token/team UNKNOWN for both samples                                                                       | [Poll endpoints](https://connect.socios.com/partner-api/api-reference/polls-api/polls-api-endpoints), [creation evidence](#discovery-without-partner-api)               | R-02–R-08 poll discovery; mapping pending                   |
| Poll answer images/media                                          | Partner API / off-chain                     | Approved API or separately licensed metadata                                                                   | Not on-chain according to guide (May 2025); no media responses observed                                                                                                              | [Poll guide](https://connect.socios.com/interact-with-chiliz-chain/working-with-polls)                                                                                  | Any media-dependent R story; mapping pending                |
| Public Fan Token/poll/reward catalogue metadata                   | Partner API                                 | Client credentials after access is granted                                                                     | Documented endpoints remain; access and response schemas/results untested, indie access UNKNOWN                                                                                      | [2025 update](https://connect.socios.com/partner-api/2025-api-update-overview)                                                                                          | R-02–R-08 metadata work; mapping pending                    |
| Consented user profile                                            | Partner API                                 | Authorisation-code flow, consent, approved scopes/terms                                                        | `GET /user/me` kept; no credentials or user response observed                                                                                                                        | [Authentication](https://connect.socios.com/partner-api/authentication)                                                                                                 | Any account-linked R story; mapping pending                 |
| Daily per-token RP pools, allocation denominator, RP/day or yield | App-only / no public feed found             | No documented usable public feed in supplied sources                                                           | Cannot calculate live RP/day per token, marginal RP, optimal allocation or point efficiency                                                                                          | [Issue research brief](https://github.com/GoHigherDev/ScoutReport/issues/31), [documentation index](https://connect.socios.com/llms.txt)                                | RP-dependent R-02–R-08; SR-61 point-efficiency routes NO-GO |
| RP balance/history, Token Hunt, games/quizzes and their rewards   | App-only / no public feed found             | Socios app/private account data, out of bounds here                                                            | No scrape or private endpoint. On-chain voting/staking does not reveal RP credited                                                                                                   | [Issue brief](https://github.com/GoHigherDev/ScoutReport/issues/31), [2025 endpoint inventory](https://connect.socios.com/partner-api/2025-api-update-overview)         | RP/account-dependent R-02–R-08; SR-61                       |
| Personal reward availability, affordability and redemption        | App-only / unknown API coverage             | RP balance and approved account/catalogue access                                                               | Public reward metadata has Partner API endpoints; a freely accessible, live account-specific catalogue was not found. Do not conflate catalogue metadata with redemption eligibility | [Rewards endpoints](https://connect.socios.com/partner-api/api-reference/rewards-api/rewards-api-endpoints)                                                             | Reward-dependent R-02–R-08; SR-61                           |
| CHZ staking → Socios RP                                           | Unknown                                     | Official clarification                                                                                         | Interaction not fully clarified; CHZ stake must not be assigned an RP rate                                                                                                           | [Issue brief](https://github.com/GoHigherDev/ScoutReport/issues/31)                                                                                                     | Any CHZ/RP comparison, SR-61                                |
| Whether a wallet is specifically a Socios Wallet                  | Unknown                                     | Authenticated brand evidence or a validated deployment/code-pattern registry                                   | Code presence/hash alone identifies neither brand nor RP eligibility; no known-positive/negative brand-labelled samples                                                              | [Wallet experiment](#socios-wallet-detection)                                                                                                                           | Wallet/RP eligibility-dependent R-02–R-08; SR-61            |

## Staking: reuse SR-11 / SR-30

Do not duplicate the verified [Staking3 ABI](../../packages/chain/abis/staking.json).
Mainnet proxy: `0x5ff7f9724fd477d9a07dcdb894d0ca7f8fae1501`.
Verified UUPS implementation: `0xed9331b504cd498ec04613d621a92c8e28bb8417`.
Source: [Routescan verified implementation](https://api.routescan.io/v2/network/mainnet/evm/88888/etherscan/api?module=contract&action=getsourcecode&address=0xed9331b504cd498ec04613d621a92c8e28bb8417)
and [Socios staking guide](https://connect.socios.com/interact-with-chiliz-chain/working-with-staking),
retrieved 13 Oct 2026. Upgrades can change behaviour: recheck implementation.
Spicy status and full historical samples remain in [SR-30](chat-staking-spike.md).

### Optimiser-relevant interface inventory

| Function                                   | Inputs → return                                                                    | Interpretation / limitation                                                       |
| ------------------------------------------ | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `getStakeData`                             | `(address staker,address token,bool perEventType)` → one `StakeDataResponse` tuple | View; potentially stale versus time-dependent refresh                             |
| `getStakeDataLatest`                       | Same → same tuple                                                                  | **Nonpayable**; simulation via `eth_call` only, no persisted refresh              |
| `getStake`                                 | `(address staker,address token)` → `uint256`                                       | Matches sampled `totalStake`                                                      |
| `getClaimableStake`                        | `(address staker,address token)` → `uint256`                                       | **Nonpayable**; `eth_call` only; sampled values zero                              |
| `getTotalStake` / `getTotalStakers`        | `(address token)` → `uint256` each                                                 | Aggregate stake / staker count; not an RP denominator                             |
| `unstakePeriod` / `MAX_UNSTAKE_PERIOD_SEC` | `()` → `uint256` each                                                              | Seconds; sampled 604800 / 1209600 at block 38370307. No per-token override getter |

Tuple order/type: `uint256 totalStake`, `totalUnstakable`, `totalLocked`,
`totalLockedFlexible`, `totalClaimable`, `totalPendingUnstake`,
`totalExemptFromCooldownPeriod`, followed by `uint256[] totalLockedPerEventType`.
Verified internal type: `IStaking2aTypes.StakeDataResponse`.
No deadline/timestamp in the tuple. Sampled total/pending amounts are raw token
units; lock/exemption semantics, overlap and array positions remain UNKNOWN.
Do not sum these fields. Read each token's `decimals()` before formatting.

Other view functions in the ABI are configuration/access/proxy diagnostics:
`DEFAULT_ADMIN_ROLE`, `UNSTAKE_PERIOD_ADMIN_ROLE`, `WHITELISTED_ROLE`,
`WHITELIST_ADMIN_ROLE` → `bytes32`; `getRoleAdmin(bytes32)` → `bytes32`;
`hasRole(bytes32,address)` → `bool`; `owner`, `pendingOwner`, `ftSwap` → `address`;
`supportsInterface(bytes4)` → `bool`; `UPGRADE_INTERFACE_VERSION` → `string`;
`proxiableUUID` → `bytes32` (may revert through the proxy). None supplies RP,
a wallet brand, or a per-wallet cooldown timestamp.

### Lifecycle/configuration events

Names and parameter order below are from the ABI, including its spelling.
`staker` and `token` are indexed in the five lifecycle events.

| Event                             | Parameters / use                                                                                                            |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `Stake`                           | `address staker,address token,uint256 amount`; adds stake                                                                   |
| `Unstake`                         | `address staker,address token,uint256 amount,uint256 claimableAt`; starts cooldown; per-operation claim time                |
| `Claim`                           | `address staker,address token,uint256 amount`; claims completed unstake                                                     |
| `LockStake`                       | `address staker,address token,uint256 amount,uint256 deadline,uint256 flags`; locks existing stake                          |
| `LockReleased`                    | `address staker,address token,uint256 amount,uint256 deadline,address releaser,uint256 idx`; releases lock, not fresh stake |
| `UnstakePariodUpdated`            | `uint256 newPeriod` (not indexed); contract-wide policy changes                                                             |
| `UnstakePeriodUpdatedForToken`    | `address token,uint256 newUnstakePeriod` (neither indexed); token overrides                                                 |
| `ExemptFromCooldownPeriodUpdated` | `uint256 newMask` (not indexed); exemption policy, bit meaning UNKNOWN                                                      |
| `Upgraded`                        | indexed `address implementation`; invalidate assumptions and reverify                                                       |

`Initialized(uint64)` and ownership/role events document administrative changes,
not wallet activity or RP. Index with proxy address, ABI topics, bounded ranges,
block hashes and reorg handling. Lock events redistribute existing stake;
they must not increase total staked. An accurate remaining cooldown requires
complete Unstake/Claim history, policies and block timestamps; a seven-day
global period alone is insufficient.

The CLI samples **NAVI and AFC**, addresses from existing verified config.
It reuses `STAKING_ADDRESS`, `StakeDataResponse` and `normaliseStake`; raw
simulation is necessary because the existing `readStakeDataLatest` helper only
returns normalised total stake/liquid holdings, not pending fields. All reads
are pinned to the capture block, including both `perEventType` values.
The earlier SR-30 pending-only AFC samples were 600/300 AFC with
`claimableAt` 1792417420/1792296717; these are historical observations, not
promised current balances. Non-zero matured claimable remains UNKNOWN.

## Polls: Survey3 interface and discovery

The exact supplied ABI array is committed as
[`packages/chain/abis/survey3.json`](../../packages/chain/abis/survey3.json).
Source: [Socios Connect Working with Polls](https://connect.socios.com/interact-with-chiliz-chain/working-with-polls)
→ [original survey3ABI.json attachment](https://31329255-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2FMDcaoJLMj5Y3jzFMTONF%2Fuploads%2FQtuJhi06OOetyXOrvudX%2Fsurvey3ABI.json?alt=media&token=5644de83-6a46-4e72-81ee-52639e99d570),
retrieved 13 Oct 2026. The attachment query token is a supplied public download
identifier, **not an API credential**.

- Original download SHA-256 (pipeline):
  `0b4a4faa9cbe5b6473c61e29cf06eceac3013da4d5275b5e6166af9c6f90e6e9`.
- Committed JSON is pretty-printed; its byte hash need not match the download.
  SHA-256 of `JSON.stringify(parsedArray)`:
  `bc02c7f5f37891a55520aa63c16e72e0daf06871fa81002b0cc2e003bc026cdd`.
  Offline test pins this content digest.

Views: `question`/`questionId` → string; `startDate`/`endDate` → uint256 Unix
seconds; `getState`, `isBinding`, `whitelistEnabled` → bool; `votingCap`,
`getTotalVoters`, `getTotalOwners`, `getTotalTokensUsed`, `getQuorum(uint8 scalePow)`
→ uint256. `getAnswers()` returns tuples
`{string id,string text,uint256 totalVotes,uint256 totalTokens}[]`;
`getAnswer(string)` returns one tuple; `getAnswerIdsByIndex(uint256)` returns
an ID. Tallies are readable, but weight/token unit semantics need verified
underlying token/implementation evidence, not an assumed 18-decimal scale.

`getUserAnswers(address)` → `bytes32[]`: match each hash against
`keccak256(UTF-8 answer.id)` from `getAnswers`, not the display text.
`getUserVoteByAnswer(address,bytes32)` → `(uint256 index,uint256 weight,uint256 blockNumber)`.
Unmatched hashes remain UNKNOWN. Other views cover roles, interface support and
delegation allowance, not RP.

`Vote(address from,address to,string proposition,uint256 weight)` has
**no indexed parameters**. Topic0:
`0xd6a7c7a36d76a0cfc7614e4d4d0964958841ee423af68cb1b56add38c7b491dd`.
Filter topic0/address then decode data; a wallet cannot be filtered as topic1.
`Approval` and role events are administrative/delegation evidence.
Both `vote` overloads, `approve`, `closeSurvey` and role/config setters are
write functions: document only, **never call**, even in this CLI.

### Supplied Mainnet observations

Pipeline log search reached block **38377739**, retrieved 13 Oct 2026.
These are pipeline samples, not sandbox re-verification or current values.

| Poll / explorer                                                                                                        | Supplied results                                                                                                                                                                                          | Limits                                                              |
| ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| [0xc145fea14431b05f4048e13ef679079b6ff38747](https://chiliscan.com/address/0xc145fea14431b05f4048e13ef679079b6ff38747) | “Vegas LAN Activity - You Choose”; questionId `d6cb0dd7-36c0-4e56-a704-135278e1ea7f`; start `1791532800`, end `1791964800`; state true; 774 voters; binding true; cap `1000000000000000000`; four answers | Team/token UNKNOWN; individual answer contents/tallies not supplied |
| [0x51f5b6fa10146420c2445017e02c9f4a8d31cf53](https://chiliscan.com/address/0x51f5b6fa10146420c2445017e02c9f4a8d31cf53) | “Who do you want to be the guest in our next Discord Q&A?”; start `1790589600`, end `1791194400`                                                                                                          | Team/token, state and user-vote results UNKNOWN                     |

First poll public voter: `0x57263860374550da427dad543439165e1540e29c`,
[vote transaction](https://chiliscan.com/tx/0x7915fc3e326528a7a9d0c1238f773db481345032da4d1ef117d580163af97ef4),
block **38377562**. `getUserAnswers` returned
`0xecda680559ebdf992deda1fad2bcb17c3709333161f6c82c78ec345b646c988f`.
The matching answer ID/text is UNKNOWN until the CLI returns answers.
On-chain **open/close times exist**; answer media is off-chain (guide, May 2025).

### Discovery without Partner API

Routescan `getcontractcreation`, pipeline evidence retrieved 13 Oct 2026:
[first poll creation lookup](https://api.routescan.io/v2/network/mainnet/evm/88888/etherscan/api?module=contract&action=getcontractcreation&contractaddresses=0xc145fea14431b05f4048e13ef679079b6ff38747)
and [second poll creation lookup](https://api.routescan.io/v2/network/mainnet/evm/88888/etherscan/api?module=contract&action=getcontractcreation&contractaddresses=0x51f5b6fa10146420c2445017e02c9f4a8d31cf53).
Both were **directly deployed by EOA**
`0xdff2968a58df65b3c74e5f6bbdc48c04196ebf74`, not a factory.
Creation transactions:
[first](https://chiliscan.com/tx/0xc73a88a1706d08939fef8fb48ce0758d63581f32ce1743dcffa9f9ef486ad495),
[second](https://chiliscan.com/tx/0x69dfa06f29e954c129d813e3460bf7cca5f0444bccf5f1e41cf7784515e99b3f).
Poll source is not verified on Routescan. This does **not** prove every poll
uses the same deployer or that no factory exists anywhere.

| Route                                      | Assessment / fallback                                                                                                                                                                  |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Factory creation events                    | Not available for these two direct deployments; no evidenced canonical factory to index                                                                                                |
| Deployer contract creations                | Explorer/transaction indexing can identify candidates, including no-vote contracts; validate ABI/constructor data individually. Other creators, token mapping and completeness UNKNOWN |
| `Vote` topic logs                          | Demonstrated candidate discovery; no-vote polls invisible, signature collisions/unrelated contracts possible. Verify every candidate; do not infer team from question text             |
| Explorer                                   | Useful candidate/provenance check, not a complete or necessarily licensed production feed. Constructor `_vtAddress` may help only if decoding/deployment semantics are verified        |
| Community lists                            | No authoritative maintained list supplied/verified. Manual allowlist only with provenance/date; coverage UNKNOWN, no automatic trust                                                   |
| Partner `GET /polls`, `GET /poll/{pollId}` | Documented intended route; access-dependent. Response-to-contract/team mapping untested without credentials                                                                            |

CLI discovery is one bounded **50,000-block** topic0 query on
`https://rpc.chiliz.com`, not a full-chain scan/indexer. Ankr permits small
ranges only; Publicnode requires an address for logs. Failure/empty results are
not evidence of no polls. Future indexing needs chunking, caching, reorg repair
and curated validation; no production route/indexer is added here.

## Partner API: documentation only

Sources, retrieved 13 Oct 2026:
[prerequisites](https://connect.socios.com/partner-api/prerequisites),
[quick start](https://connect.socios.com/partner-api/quick-start),
[authentication](https://connect.socios.com/partner-api/authentication),
[2025 update](https://connect.socios.com/partner-api/2025-api-update-overview),
[poll endpoints](https://connect.socios.com/partner-api/api-reference/polls-api/polls-api-endpoints),
[reward endpoints](https://connect.socios.com/partner-api/api-reference/rewards-api/rewards-api-endpoints),
[documentation index](https://connect.socios.com/llms.txt).

Access starts with the
[Chiliz Help Centre](https://mediarex.atlassian.net/servicedesk/customer/portal/5),
then **Complete API Due Diligence**, after which the Socios team makes contact.
Quick start directs new users to a Partnership Manager or Due Diligence and
then an access code for the
[API Manager / Developer Portal](https://partner.socios.com/devportal/apis).
The issue brief also requires Terms; applicable current terms, licence,
redistribution rights and approval conditions need Socios confirmation.
Keys are created only after access is granted. **Indie-builder access: UNKNOWN.**
No account was created and no forms/contact/API requests were made.

- Base: `https://api-public.socios.com`.
- OAuth2: authorise `https://partner.socios.com/oauth2/authorize`;
  token `https://partner.socios.com/oauth2/token`;
  revoke `https://partner.socios.com/oauth2/revoke`.
- Client-credentials flow: public read-only data, **not user data**.
- Authorisation-code flow: user data with consent.
- Sandbox: **under construction**; public docs direct users to production.
  That is not permission to test without approved credentials.

| 2025 status                              | Documented endpoints                                                                                                                                                               |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Kept                                     | `GET /countries`, `/sports`, `/leagues`, `/fantokens`, `/fantokens/rate`, `/ping`, `/polls`, `/poll/{pollId}`, `/rewards`, `/rewards/{rewardId}`, `/reward-categories`, `/user/me` |
| Removed                                  | `POST /user/polls`, `/user/polls/history`, `/user/poll/{pollId}/vote`, `/user/poll/{pollId}`, `/wallet/sign-message`; `GET /nfts/smartcontract/{id}` and admin NFT endpoints       |
| Removed, on-chain alternative documented | `GET /user/nfts`, `/nft/{id}`, `/user/wallet`, `/user/wallet/{transactionId}`, `/user/wallet/transaction-history/fan-token`; `POST /admin/wallet/transfer/fan-token`               |

An on-chain alternative does not preserve private account metadata or establish
API parity. There is no tested response, scope grant, rate limit, uptime,
pagination scheme or supported indie access in this spike.

### Questions for Socios (Brave decides whether to send)

1. Are independent, non-affiliated builders eligible? Required due diligence,
   Terms, fees, scopes, caching/redistribution licence and approval timeline?
2. Which poll endpoints return contract address, chain ID, token/team identity,
   images, pagination and closed/no-vote polls? Expected freshness/coverage?
3. Are any RP balances, daily per-token pool totals, allocation denominators,
   midnight UTC accounting rules or reward-redemption feeds publicly licensed?
4. Confirm external-wallet RP exclusion and team-specific minimum voting stake,
   including delegated/whitelisted voting, per-poll thresholds and token versions.
5. How does CHZ staking interact with RP, if at all?
6. Is there an official Socios Wallet deployment/implementation registry and
   upgrade policy? Can brand and RP eligibility be attested with consent?
7. Production quotas, `Retry-After`, cache policy, incident/SLA policy and sandbox
   availability? No answer should be inferred from an undocumented endpoint.

## RP and other app-side data

**No public daily RP pool feed was found in the supplied public documentation.**
This is bounded evidence, not proof that no internal/partner feed can exist.
The supplied research brief describes per-token proportional pools credited at
midnight UTC, but gives neither live pool sizes nor an eligible-stake denominator
or complete eligibility/accounting rules. On-chain total stake includes wallets
that do not earn RP and cannot substitute for that denominator.

Cannot compute: live RP/day per token, current/future yields, marginal RP from
moving stake, optimal RP allocation, RP balances/history, point-efficiency
rankings (including SR-61), Token Hunt/game/quiz entitlements, or affordable/
redeemable rewards. Partner reward catalogue endpoints are documented, but
no freely accessible feed or response was observed; catalogue metadata is
distinct from personal redemption eligibility.

External-wallet staking **does not earn Socios RP** (supplied brief and staking
guide); on-chain staking amounts are not RP. Voting requires owning **and**
staking at least one Fan Token of that team, potentially more per poll
(supplied brief). Poll flags/cap alone do not prove eligibility.
**CHZ staking/RP interaction is not fully clarified: UNKNOWN.**
No RP numbers or hypothetical yields are introduced.

## Socios Wallet detection

Experiment in `scripts/spike/all.ts`: `eth_getCode` at the capture block on four
public SR-30 stakers and the supplied public voter. Output records presence,
byte length, `keccak256(runtimeCode)` and a possible EIP-7702 delegation
designator, always with `sociosWallet: UNKNOWN`.

Local RPC connectivity failed before chain verification, so **no sample code
hashes or brand-labelled comparisons were obtained**. Confidence in a reliable
Socios identifier: **insufficient**. A non-empty code result does not prove a
Socios SCA (other smart wallets and delegated accounts exist). Empty code does
not attest app account status; shared proxy runtime can hide differing
implementations/owners. Upgrades, counterfactual wallets and unlabelled samples
make a universal fingerprint unsafe even if several hashes match.

Fallback: disclose that RP eligibility cannot be verified; do not label a
wallet as Socios or infer RP eligibility from code presence, connector name
or a user assertion. A future heuristic needs labelled positives/negatives,
official deployment provenance, proxy/delegation resolution, upgrade handling
and false-positive/negative tests, or authenticated consent-based evidence.

## Caveat copy

**Draft, pending Brave's approval.** Not approved UI copy and not wired into UI.

> ScoutReport is not affiliated with Socios. Rewards Optimizer shows available
> on-chain data; it cannot verify your Socios Reward Points or forecast RP yields.

> Staking from an external wallet does not earn Socios Reward Points. We cannot
> reliably verify whether this address is a Socios Wallet or qualifies for RP.

> To vote, you must own and stake at least one Fan Token of that team. Some polls
> require more or have additional conditions. Check the poll's requirements in
> Socios; an on-chain balance does not guarantee eligibility.

> Poll coverage may be incomplete. Times and balances reflect the stated capture
> block and may change. Pending unstake is not a liquid wallet balance.

Brave's approval is an outstanding acceptance gate; this spike does not claim
AC7 approved. No extra user-facing product names or copy constants are added.

## Go / no-go / fallback: R-02–R-08 and SR-61

Exact R-02–R-08 scopes/ACs are **UNKNOWN** here. Each row is deliberately gated,
not an invented feature assignment. Shared evidence permits holdings/staking
and manually verified poll reads; it does not permit RP forecasts or guaranteed
poll coverage. Brave must provide the Jira ACs to turn a row into a build GO.

| Story                         | Decision now                                 | Go condition                                                                                 | No-go condition / fallback                                                                       |
| ----------------------------- | -------------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| R-02 / SR-51                  | NO-GO for build pending actual scope         | ACs map exclusively to evidenced reads; confirm freshness/coverage and caveats               | Any assumed feed; otherwise restrict to block-labelled holdings/stake if ACs allow               |
| R-03 / SR-52                  | NO-GO for build pending actual scope         | ACs map to evidenced staking tuple/events, with accounting uncertainties excluded            | Exact cooldown/claim promises without complete history; show raw verified state only if accepted |
| R-04 / SR-53                  | NO-GO for build pending actual scope         | ACs permit curated, validated poll addresses and UNKNOWN token mapping where applicable      | Exhaustive poll/team discovery without approved source; curated list only if accepted            |
| R-05 / SR-54                  | NO-GO for build pending actual scope         | ACs use known views without asserting voting/RP eligibility                                  | Wallet-brand or RP eligibility inference; disclosure/manual Socios check only if accepted        |
| R-06 / SR-55                  | NO-GO for build pending actual scope         | ACs exclude unavailable RP/account feeds or approved access is confirmed                     | Live RP balance/pool/yield assumptions; unavailable state, not estimated numbers                 |
| R-07 / SR-56                  | NO-GO for build pending actual scope         | Required metadata licensing/access is confirmed or ACs permit evidenced on-chain-only subset | Unapproved Partner API/private app dependencies; omit unavailable catalogue/account data         |
| R-08 / SR-57                  | NO-GO for build pending actual scope         | ACs and data sources, caveat approval and backend cost controls are confirmed                | Optimisation claims requiring missing feeds; read-only information subset only if accepted       |
| SR-61 point-efficiency routes | NO-GO for live point-efficiency calculations | Licensed reliable RP pools/denominators/eligibility and approved method                      | Omit/mark unavailable; no made-up RP figures, no unauthenticated paid-work route                 |

These fallback examples are options for Brave, not decisions to reduce ticket
scope. Re-open this ADR/research gates when authoritative evidence changes.

## Reproduce all reads: one CLI hand-off

After `pnpm install --frozen-lockfile`, run from the repository root (Node 24).
No private key, account, API credentials or app login:

```sh
RPC_URL_MAINNET=https://rpc.chiliz.com \
  node --experimental-strip-types packages/chain/scripts/spike/all.ts \
  > /tmp/sr-50-capture.json
```

Individual probes:
`node --experimental-strip-types packages/chain/scripts/spike/staking.ts` and
`node --experimental-strip-types packages/chain/scripts/spike/polls.ts`.
`all.ts` includes both and wallet-code probes in one invocation. Reads are
batched by the HTTP transport, independently failure-labelled, and pinned to
one capture block (chain ID checked first). JSON includes capture time, block
hash/timestamp, raw values as decimal strings and failed reads as UNKNOWN.
Exit status is non-zero on a blocked/partial capture; keep the JSON regardless.
Errors are redacted to avoid printing credential-bearing RPC URLs.
Only public-client read methods and `simulateContract` (`eth_call`) are used.
The complete ABI includes writes for provenance, but no write function is invoked.

### Sandbox attempt, 13 October 2026

`all.ts` against `https://rpc.chiliz.com` at **14:51 UTC**:
`chainId` failed, value UNKNOWN; “Mainnet 88888 not confirmed; no probes run.”
Thus staking, poll views/log discovery and wallet code reads could not run.
No live block or result is claimed. SR-30 already records sandbox DNS failures.
The same command with `RPC_URL_MAINNET=https://rpc.ankr.com/chiliz` and
`RPC_URL_MAINNET=https://chiliz-rpc.publicnode.com` at **14:54 UTC** produced
the same failed chain verification and ran no probes. All three CLI attempts
exited non-zero. The CLI deliberately redacts low-level network errors; this
does not establish their precise cause. Maintainer output will be appended
only when supplied; historical evidence remains pipeline/maintainer-labelled.

**QUESTION: Maintainer, please run the single `all.ts` command above and post
the JSON capture (including any failed reads) on this PR. Also supply the
R-02–R-08/SR-51–57 and SR-61 Jira ACs to resolve story mapping, and ask Brave
to approve or revise the draft caveats.** No separate RPC runs are needed.
Do not paste credentials or private account data. Pending output must not be
treated as successful verification.

## Cost, privacy and follow-up boundary

No API route, production feature, UI, database work or dependency is added.
Scripts are CLI-only, manually invoked, bounded and keyless.
**No unauthenticated endpoint may trigger paid DB or RPC work without a rate
limit or a cache.** Future routes must have that control before exposure;
shared caching should include chain/block/address/version and safe freshness,
and any limiter must work across instances. Private data still requires
authentication/consent; a cache alone does not grant access.
Do not keep per-wallet research captures as production analytics. Public
addresses can be personal data: retain only necessary evidence and apply the
repository's [data inventory](../data-inventory.md) rules.

Local tests validate exact ABI content, chain fail-closed behaviour, hash
matching, raw pending amounts, on-chain decimals, block pinning, redacted
failures and exclusively read-only RPC methods. CI tests need no network.
No workflow or four required-check configuration is changed.

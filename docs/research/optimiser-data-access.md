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

**SR-56 amendment (13 October 2026):** the approved clarification permits a
feature-gated, explicitly labelled estimate model for existing current holdings,
not an official RP feed. No real theta/calibration has been supplied; the shipped
configuration is empty and the server flag defaults false. Browser-only wallet
declaration is not brand verification. No collection, auth/session, database
persistence, price/cost ordering or acquisition/staking CTA is authorised.
The historical evidence/unknowns in this research remain unchanged; see the
[ADR amendment](../adr/0003-optimiser-data-strategy.md#sr-56-amendment-approved-current-holdings-estimate-scope)
and [implementation gates](../../README.md#rewards-optimizer). Policy thresholds
must never be treated as RP values. Actual calibration is a follow-up.

External sources below were **retrieved 13 Oct 2026 by the issue pipeline**;
they were not independently fetched in this sandbox. Distinguish:

- **ABI evidence:** interface/types only, not implementation semantics.
- **Pipeline evidence:** supplied public-doc and Mainnet observations in
  [SR-50 / issue #31](https://github.com/GoHigherDev/ScoutReport/issues/31).
- **Maintainer evidence:** block-pinned SR-30 reads and the SR-50 inline capture
  at block 38378088, linked below; raw log arrays are captured, not transcribed
  (counts only).
- **Local evidence:** offline tests and failed RPC connectivity, not live reads.
- **UNKNOWN:** unavailable or insufficient evidence; never substitute a zero,
  fabricated response, yield, token association or approved wording.

## Data accessibility matrix

Story mapping now follows the exact Jira `customfield_10043` ACs supplied in
the [maintainer answer](https://github.com/GoHigherDev/ScoutReport/pull/32#issuecomment-6148508386),
13 October 2026. R-02–R-08 = SR-51–SR-57; all are To Do. SR-54/SR-55 remain
parked until after Brave's test. SR-61 permits only source-confirmed earn-route
flags, not guessed routes or numerical point-efficiency calculations.

| Data item                                                         | Source                                      | Access requirements                                                                                            | Reliability / limits                                                                                                                                                                 | Evidence link                                                                                                                                                   | Stories affected                                                                               |
| ----------------------------------------------------------------- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Fan Token liquid balance, decimals, transfers                     | On-chain                                    | Mainnet RPC, verified configured token proxy, `balanceOf`, `decimals`, `Transfer` logs                         | High at a named block; reorgs, RPC limits, proxies and historical completeness matter. Never hardcode decimals                                                                       | [Token catalogue](https://docs.chiliz.com/quick-start/token-contract-addresses), [config](../../packages/chain/src/tokens.config.ts)                            | SR-51 checklist; SR-56 coverage/actions                                                        |
| Stake and per-token total stake/stakers                           | On-chain                                    | Verified staking proxy/ABI; `getStakeDataLatest` by `eth_call`, `getStake`, `getTotalStake`, `getTotalStakers` | Two-token SR-30 samples verified; SR-50 maintainer reports successful repeat reads. Not RP or all accounting semantics                                                               | [SR-30 capture](chat-staking-spike.md#maintainer-run-block-pinned-capture), [SR-50 capture](#maintainer-mainnet-capture-13-october-2026)                        | SR-51 stake/Scout Rating; SR-55 eligibility hint; SR-56 actions                                |
| Pending unstake, claimable, locks, cooldown                       | On-chain                                    | Raw stake tuple and lifecycle events                                                                           | Pending amounts verified; non-zero matured claimable/overlaps UNKNOWN. Per-operation deadline from `Unstake.claimableAt`, not tuple                                                  | [SR-30 exact interface](chat-staking-spike.md#exact-read-interface), [ABI](../../packages/chain/abis/staking.json)                                              | SR-52 cooldown; SR-56 actions                                                                  |
| Official Socios staking on Spicy                                  | Unknown beyond sampled address              | Official deployment evidence                                                                                   | No code at Mainnet proxy address on Spicy; alternative official deployment UNKNOWN. ScoutReport mocks are not Socios                                                                 | [SR-30 provenance](chat-staking-spike.md#evidence-and-provenance)                                                                                               | All build/test strategies                                                                      |
| Poll question, answer IDs/text/tallies, user answer hashes        | On-chain                                    | Poll address, Survey3 ABI, public wallet address, RPC                                                          | Both polls' answers/tallies transcribed at block 38378088; sample voter has one matched answer on the first poll and none on the second. No exhaustive feed; tallies are not RP      | [Poll guide](https://connect.socios.com/interact-with-chiliz-chain/working-with-polls), [SR-50 capture](#maintainer-mainnet-capture-13-october-2026)            | SR-54 validation; SR-55 watchlist; SR-56 coverage                                              |
| Poll start/end, state, cap, binding/whitelist flags, quorum       | On-chain                                    | `startDate`, `endDate`, `getState`, `votingCap`, `isBinding`, `whitelistEnabled`, `getQuorum(uint8)`           | Times are on-chain; flags/cap alone do not prove a wallet can vote. Quorum scale/eligibility semantics need implementation evidence                                                  | [Survey3 provenance](#polls-survey3-interface-and-discovery)                                                                                                    | SR-54 validation; SR-55 close time/eligibility hint                                            |
| Exhaustive poll discovery, team/token association                 | Partner API / unknown completeness on-chain | `GET /polls`, approved API access; otherwise curated addresses or bounded logs/explorer                        | Vote logs miss polls with no votes. No factory shown by sampled creations; token/team UNKNOWN for both samples                                                                       | [Poll endpoints](https://connect.socios.com/partner-api/api-reference/polls-api/polls-api-endpoints), [creation evidence](#discovery-without-partner-api)       | SR-54 curated registry; SR-55 watchlist; SR-56 coverage; SR-57 source interface                |
| Poll answer images/media                                          | Partner API / off-chain                     | Approved API or separately licensed metadata                                                                   | Not on-chain according to guide (May 2025); no media responses observed                                                                                                              | [Poll guide](https://connect.socios.com/interact-with-chiliz-chain/working-with-polls)                                                                          | No supplied AC requires media; SR-57 dossier limitation                                        |
| Public Fan Token/poll/reward catalogue metadata                   | Partner API                                 | Client credentials after access is granted                                                                     | Documented endpoints remain; access and response schemas/results untested, indie access UNKNOWN                                                                                      | [2025 update](https://connect.socios.com/partner-api/2025-api-update-overview)                                                                                  | SR-57 dossier/disabled adapter only                                                            |
| Consented user profile                                            | Partner API                                 | Authorisation-code flow, consent, approved scopes/terms                                                        | `GET /user/me` kept; no credentials or user response observed                                                                                                                        | [Authentication](https://connect.socios.com/partner-api/authentication)                                                                                         | No supplied AC requires profile data; SR-57 dossier limitation                                 |
| Daily per-token RP pools, allocation denominator, RP/day or yield | App-only / no public feed found             | No documented usable public feed in supplied sources                                                           | Cannot calculate live RP/day per token, marginal RP, optimal allocation or numerical point efficiency                                                                                | [Issue research brief](https://github.com/GoHigherDev/ScoutReport/issues/31), [documentation index](https://connect.socios.com/llms.txt)                        | Explicitly excluded by SR-51/SR-56; SR-55 qualitative note only; no SR-61 numerical comparison |
| RP balance/history, Token Hunt, games/quizzes and their rewards   | App-only / no public feed found             | Socios app/private account data, out of bounds here                                                            | No scrape or private endpoint. On-chain voting/staking does not reveal RP credited                                                                                                   | [Issue brief](https://github.com/GoHigherDev/ScoutReport/issues/31), [2025 endpoint inventory](https://connect.socios.com/partner-api/2025-api-update-overview) | SR-53 caveat; SR-56 excludes Token Hunt/games; SR-61 excludes unconfirmed routes               |
| Personal reward availability, affordability and redemption        | App-only / unknown API coverage             | RP balance and approved account/catalogue access                                                               | Public reward metadata has Partner API endpoints; a freely accessible, live account-specific catalogue was not found. Do not conflate catalogue metadata with redemption eligibility | [Rewards endpoints](https://connect.socios.com/partner-api/api-reference/rewards-api/rewards-api-endpoints)                                                     | SR-57 dossier limitation; no redemption claim in supplied ACs                                  |
| CHZ staking → Socios RP                                           | Unknown                                     | Official clarification                                                                                         | Interaction not fully clarified; CHZ stake must not be assigned an RP rate                                                                                                           | [Issue brief](https://github.com/GoHigherDev/ScoutReport/issues/31)                                                                                             | SR-61 must not flag CHZ RP earning as confirmed                                                |
| Whether a wallet is specifically a Socios Wallet                  | Unknown                                     | Authenticated brand evidence or a validated deployment/code-pattern registry                                   | Code probes succeeded per maintainer, but code presence/hash identifies neither brand nor RP eligibility; no labelled samples                                                        | [Wallet experiment](#socios-wallet-detection)                                                                                                                   | SR-53 contextual account notes, never assert brand; SR-51/SR-55 caveats                        |

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
`claimableAt` 1792417932/1792299917 (receipt corrections recorded on 13 October
2026 in SR-52); these are historical observations, not
promised current balances. Non-zero matured claimable remains UNKNOWN.

SR-52 displays pending-only rows without adding pending amounts to liquid or
Scout Rating balances. Client-side log reads use only the configured public
PublicNode endpoint, without retries or Ankr fallback. The SR-52 review on
13 October 2026 measured accepted ranges of 1,000 blocks on Ankr and 50,000
blocks on PublicNode, correcting the earlier 250,000-block claim. The lookback
uses the live contract-wide `unstakePeriod()` plus a 10% margin, estimating
three-second blocks, capped at 250,000 blocks including both endpoints.
At most five sequential `eth_getLogs` requests of at most 50,000 blocks run,
stopping at the first error. Reads are filtered by staking address, staker and
pending tokens. A failed period read also leaves release time unavailable.
Remaining Unstake amounts after
Claim events must reconcile with the captured tuple before showing the earliest
release and operation count in Europe/London. A failed or non-reconciling history
shows “Release time unavailable”. The displayed period is explicitly the
contract-wide default; per-token overrides remain unknown. Once the displayed
release has passed the chip says “Ready to claim”; for multiple operations this
refers to the earliest release, not necessarily the whole pending amount.
No API route,
subgraph change or write action is involved. Tests use offline SR-30 fixtures
with the receipt-corrected timestamps above, plus synthetic failure and GMT cases. Non-zero matured claimable remains UNKNOWN.

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
The later block-38378088 capture below matches this hash to answer ID
`2052a831-aceb-49d4-840d-77b3cba0b5d9`, text `Arcade\games night`.
On-chain **open/close times exist**; answer media is off-chain (guide, May 2025).

### Maintainer Mainnet capture, 13 October 2026

Provenance: [maintainer summary on PR #32](https://github.com/GoHigherDev/ScoutReport/pull/32#issuecomment-6148508386)
and [inline capture](https://github.com/GoHigherDev/ScoutReport/pull/32#issuecomment-6148857196),
running the committed `all.ts` at head **dbd7b72** against
`https://rpc.chiliz.com`. The maintainer reports **103/103 reads ok**,
`blocked: null`. This is maintainer-run evidence, not a successful sandbox run.

| Capture field                    | Maintainer-reported value                                            |
| -------------------------------- | -------------------------------------------------------------------- |
| Chain ID                         | `88888`                                                              |
| Block number                     | `38378088`                                                           |
| Block hash                       | `0x9fe4bcf8f7c5936d0119db1f228404a031b3256f778cf3a81d274dca4c53c7f0` |
| Block timestamp (Unix seconds)   | `1791903563`                                                         |
| `capturedAt`                     | `2026-10-13T14:59:34.089Z`                                           |
| `staking.unstakePeriod`          | `604800` seconds                                                     |
| `staking.MAX_UNSTAKE_PERIOD_SEC` | `1209600` seconds                                                    |

The original [gist](https://gist.github.com/GoHigherDev/5e71ef0fec763139d1f0b83732b5edb8)
failed DNS resolution / GitHub gist API HTTP 403 here; the maintainer then
supplied the same capture inline. All **103 read statuses are `ok`** in that
inline evidence. Every non-log read is complete; log arrays are count-only.
Tables below transcribe that public evidence, not a new sandbox RPC capture.

#### Staking samples at block 38378088

Both tokens returned `decimals()` **18**. Amounts in this table are formatted
token amounts using those observed decimals, not hardcoded decimals or RP.

| Token / public staker                             | Held = Unstaked (liquid) | Staked = `totalStake` = `totalUnstakable` | `totalPendingUnstake` | Scout Rating |
| ------------------------------------------------- | ------------------------ | ----------------------------------------- | --------------------- | ------------ |
| NAVI `0x2bda90268064f289df62dd48c9b7a48fb9d9383b` | 0                        | 2                                         | 0                     | 2            |
| AFC `0xf2f267dbe597eb029e44359ca4e14ec991c88cc2`  | 0                        | 3,044.41                                  | 0                     | 3,044.41     |
| AFC `0xfea00bddbf1dd40300f9739b933c0070b004049d`  | 0                        | 0                                         | 600                   | 0            |
| AFC `0xe57316b95c3b2f1daac76e907705469e30af57e9`  | 0                        | 0                                         | 300                   | 0            |

In all four samples, `totalLocked`, `totalLockedFlexible`, `totalClaimable`,
`totalExemptFromCooldownPeriod` and `getClaimableStake` were zero.
`getStakeData(...,true)` matched `getStakeDataLatest(...,true)`; `getStake`
matched `totalStake`. Latest reads with `false` returned the same scalar
fields and `totalLockedPerEventType: []`; `true` returned `[0,0]`.
This confirms flag behaviour for these samples only, not array meanings or
general accounting equivalence. Pending amounts remain outside liquid
Unstaked and Scout Rating; no non-zero matured claimable was observed.

Aggregate `getTotalStake` raw units / `getTotalStakers`: NAVI
`264000000000000000000` / `15`; AFC
`258599124896023207189544` / `3813` (same in each AFC sample).
Neither aggregate supplies an RP pool or RP-eligible denominator.

#### Poll metadata at block 38378088

Poll A = `0xc145fea14431b05f4048e13ef679079b6ff38747`;
poll B = `0x51f5b6fa10146420c2445017e02c9f4a8d31cf53`.
Team/token association remains **UNKNOWN** for both.

| View                       | Poll A                                 | Poll B                                                   |
| -------------------------- | -------------------------------------- | -------------------------------------------------------- |
| `question`                 | Vegas LAN Activity - You Choose        | Who do you want to be the guest in our next Discord Q&A? |
| `questionId`               | `d6cb0dd7-36c0-4e56-a704-135278e1ea7f` | `a5315c63-80b3-4bc4-8018-2215ae6050f8`                   |
| `startDate` (Unix seconds) | `1791532800`                           | `1790589600`                                             |
| `endDate` (Unix seconds)   | `1791964800`                           | `1791194400`                                             |
| `getState`                 | `true`                                 | `true`                                                   |
| `isBinding`                | `true`                                 | `true`                                                   |
| `votingCap` (raw)          | `1000000000000000000`                  | `1000000000000000000`                                    |
| `getTotalVoters`           | `774`                                  | `406`                                                    |
| `getTotalOwners`           | `138`                                  | `316`                                                    |
| `getTotalTokensUsed` (raw) | `774000000000000000000`                | `406000000000000000000`                                  |
| `whitelistEnabled`         | `false`                                | `false`                                                  |
| `getQuorum(0)`             | `19`                                   | `25`                                                     |

Do not interpret `getState: true` as proof a poll is currently open:
poll B's recorded end time precedes the capture timestamp despite that
returned state. Preserve the view value alongside the dates; contract-state
semantics are not independently verified.

#### Answer contents and tallies at block 38378088

`totalVotes` and `totalTokens` below are the verbatim raw values.
Do not format poll weights/tokens with assumed token decimals or convert
them to RP. `getAnswer(i's id)` and `getAnswerIdsByIndex(i)` matched every
`getAnswers()` entry in the displayed order.

| Poll / index | Answer ID                              | Answer text (verbatim)             | `totalVotes` | `totalTokens` (raw)     |
| ------------ | -------------------------------------- | ---------------------------------- | ------------ | ----------------------- |
| A / 0        | `3e84f68d-34a1-46ee-86a4-b0de3787ca00` | Team dinner at a famous restaurant | `246`        | `246000000000000000000` |
| A / 1        | `a2896c61-44fb-4a51-80f6-c08ceb39cdd4` | Movie night in hotel room          | `139`        | `139000000000000000000` |
| A / 2        | `08d13f85-409a-4c44-9efe-0c5b8c591d0b` | Unlucky picks dinner spot          | `148`        | `148000000000000000000` |
| A / 3        | `2052a831-aceb-49d4-840d-77b3cba0b5d9` | `Arcade\games night`               | `241`        | `241000000000000000000` |
| B / 0        | `cf2e3522-0e38-4835-8e5a-c54cd12299a8` | Natsumi                            | `79`         | `79000000000000000000`  |
| B / 1        | `edfc2516-473a-4106-b9cb-cbbdbf389079` | Topson                             | `63`         | `63000000000000000000`  |
| B / 2        | `166634d9-bd24-4711-832b-ec6c8c71cbf9` | SSS                                | `64`         | `64000000000000000000`  |
| B / 3        | `28ab21be-74ac-41d0-a74d-50a63b0b836d` | OneJey                             | `70`         | `70000000000000000000`  |
| B / 4        | `8bf3138d-e848-405b-a651-65f8ab6e5fbe` | skem                               | `52`         | `52000000000000000000`  |
| B / 5        | `26c8c1da-8acb-4cdc-9b1a-9c50f9f5385e` | Coach kaffs                        | `78`         | `78000000000000000000`  |

For public voter `0x57263860374550da427dad543439165e1540e29c`:

- Poll A `getUserAnswers` returned
  `["0xecda680559ebdf992deda1fad2bcb17c3709333161f6c82c78ec345b646c988f"]`.
  `matchedUserAnswers` maps it to ID `2052a831-aceb-49d4-840d-77b3cba0b5d9`,
  text `Arcade\games night`, `totalVotes: 241`,
  `totalTokens: 241000000000000000000`.
  `getUserVoteByAnswer` returned `(index,weight,blockNumber)` =
  `("0","1000000000000000000","38377562")`. Its returned `index: 0` is not
  the answer's position 3 in `getAnswers`; no index semantics are inferred.
- Poll B `getUserAnswers` and `matchedUserAnswers` both returned `[]`.
  No `getUserVoteByAnswer` call was needed for an empty user-answer list.
  A successful empty list supports Not voted for this sampled address/poll
  at this block, not Unknown or a claim about other addresses/polls.

#### Log summaries: captured, not transcribed

| Read                     | Count supplied | Treatment                                                     |
| ------------------------ | -------------- | ------------------------------------------------------------- |
| `staking.recentEvents`   | `112`          | Captured, not transcribed; raw array omitted for comment size |
| `poll.discoveryVoteLogs` | `126`          | Captured, not transcribed; raw array omitted for comment size |

Only counts are supplied here. No event payload, candidate address list,
deduplication, factory evidence or complete history is inferred from them.

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

Local RPC connectivity failed before chain verification. The
[inline maintainer capture](https://github.com/GoHigherDev/ScoutReport/pull/32#issuecomment-6148857196)
supplies these results at **block 38378088**:

| Public address                               | `hasCode` | `byteLength` | `delegationDesignator` | `sociosWallet` |
| -------------------------------------------- | --------- | ------------ | ---------------------- | -------------- |
| `0x2bda90268064f289df62dd48c9b7a48fb9d9383b` | `true`    | `90`         | `false`                | `UNKNOWN`      |
| `0xf2f267dbe597eb029e44359ca4e14ec991c88cc2` | `true`    | `90`         | `false`                | `UNKNOWN`      |
| `0xfea00bddbf1dd40300f9739b933c0070b004049d` | `true`    | `90`         | `false`                | `UNKNOWN`      |
| `0xe57316b95c3b2f1daac76e907705469e30af57e9` | `true`    | `90`         | `false`                | `UNKNOWN`      |
| `0x57263860374550da427dad543439165e1540e29c` | `true`    | `90`         | `false`                | `UNKNOWN`      |

All five returned the same runtime code hash:
`0xeb943ca16c0a3d8c19be2c02105552f49d4ff1d02fb80b199b613f085c8c7847`.
The code bytes themselves are not returned by these probes; no implementation,
owner or brand provenance is established. There is no labelled positive/
negative comparison, and no empty-code control in this sample.

Confidence in a reliable Socios identifier: **insufficient** despite the shared
hash. A non-empty code result does not prove a
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

**Approved as drafted by Brave**, with no edits, **13 October 2026, 16:04 UK**.
Provenance: [product-owner approval recorded by the maintainer](https://github.com/GoHigherDev/ScoutReport/pull/32#issuecomment-6148594790),
confirmed in the [inline-capture instruction](https://github.com/GoHigherDev/ScoutReport/pull/32#issuecomment-6148857196).
The four caveats below are unchanged and are not wired into UI by this spike.

> ScoutReport is not affiliated with Socios. Rewards Optimizer shows available
> on-chain data; it cannot verify your Socios Reward Points or forecast RP yields.

> Staking from an external wallet does not earn Socios Reward Points. We cannot
> reliably verify whether this address is a Socios Wallet or qualifies for RP.

> To vote, you must own and stake at least one Fan Token of that team. Some polls
> require more or have additional conditions. Check the poll's requirements in
> Socios; an on-chain balance does not guarantee eligibility.

> Poll coverage may be incomplete. Times and balances reflect the stated capture
> block and may change. Pending unstake is not a liquid wallet balance.

**AC7 is met on the recorded approval.** This approves the four caveats as
worded, not a wallet-brand detection method, live RP feed or extra UI copy.
No extra user-facing product names or copy constants are added.

## Go / no-go / fallback: R-02–R-08 and SR-61

Source: exact Jira ACs in the
[maintainer answer](https://github.com/GoHigherDev/ScoutReport/pull/32#issuecomment-6148508386),
13 October 2026. All stories are **To Do**, not implemented here. GO below means
the stated data dependency is supported, not permission to start parked work,
change scope or bypass the R-01 completion gate. The four caveats are now
approved; any new or altered user-facing wording still requires approval.

| Story / supplied scope                                 | Data decision and remaining gate                                                                                                                                             | AC-backed implementation boundary / fallback                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R-02 / SR-51 — Held/Staked/Unstaked checklist          | **GO for confirmed fields and approved caveats**                                                                                                                             | Per configured token, `balanceOf` = Held and existing Unstaked (liquid balance, not pending); `totalStake` = Staked; Scout Rating = Held + Staked. Format with on-chain decimals; DATA_CHAIN Mainnet even with APP_CHAIN Spicy; network badge. SR-56 supersedes the staking prompt: at least one whole liquid token and Staked = 0 shows a neutral held-but-unstaked reminder, not a buy/stake CTA or eligibility promise. Use approved `NAMES.optimiser` (“Rewards Optimizer”), not Jira's stale placeholder; neutral `/optimiser`. No official RP/day, £/RP, APY or pool-size figures. |
| R-03 / SR-52 — Unstaking cooldown                      | **GO for pending/cooldown evidence**, not Won't Do: SR-30 has non-zero pending amounts and `Unstake.claimableAt`; SR-50 repeats successful reads and seven-day global period | Read-only per-token pending/cooling state and event-derived release in Europe/London; offline fixtures from recorded SR-30 samples. Global period is known, per-token overrides remain UNKNOWN: do not present global period as a verified effective override. Reconcile Unstake/Claim history for current releases; no invented deadline from the tuple. Display unknown/unavailable when history or effective period cannot be resolved, rather than promise a release.                                                                                                                |
| R-04 / SR-53 — Socios Wallet RP caveat                 | **GO for approved caveats/account-code context; NO-GO for brand identification**                                                                                             | Persistent RpCaveat must explain external-wallet stake ≠ Socios RP and Socios Wallet staking earns RP, with cited Help/Connect links and snapshot tests. EOA vs contract-account notes must be contextual, not proof of Socios brand/eligibility; account code can include delegation. Never assert IS Socios Wallet. Use the four approved caveats; additional or changed wording needs approval.                                                                                                                                                                                       |
| R-05 / SR-54 — Curated poll registry                   | **GO for curated strategy; PARKED until after Brave's test**                                                                                                                 | Survey3 view validation on DATA_CHAIN; `poll_registry` CRUD at `/admin/polls` under SIWE + allowlist, audited changes, required `source_note`. Public `GET /api/polls` must have cache or rate limit before exposure. No Partner API/scraping; no evidenced factory to mandate an indexer. Sample token/team associations remain UNKNOWN: curate/verify rather than infer them from question text.                                                                                                                                                                                       |
| R-06 / SR-55 — Poll watchlist + getUserAnswers         | **GO for views and on-chain close times; PARKED until after Brave's test**                                                                                                   | Voted/Not voted/Unknown from successful/failed user-answer reads; hash-match IDs; close time from `endDate`. Eligibility hint ≥1 whole staked token uses decimals and a verified team-token association, with higher-threshold/additional-condition caveat. If token mapping/read is missing, show Unknown, not eligibility. Qualitative RP note only; no Partner API required. Inline evidence supplies one matched answer and one empty user-answer list for offline fixtures.                                                                                                         |
| R-07 / SR-56 — Dashboard coverage/actions/empty states | **GO for spike-backed information only**; dependent stories and scheduling still gate delivery                                                                               | Coverage widget, ordered actions and empty states must distinguish curated/unknown coverage and failed reads. Midnight UTC note is a supplied accounting-mechanism statement, not a computed credit: UK equivalent is 00:00 GMT / 01:00 BST depending on date. No yields, Token Hunt or games; no assumed earn routes or RP balance. The four caveats are approved, not all future dashboard wording.                                                                                                                                                                                    |
| R-08 / SR-57 — Partner API dossier + disabled adapter  | **GO for dossier and source abstraction/stub; NO-GO for live Partner API access**                                                                                            | `docs/partner-api/application.md` checklist; `PollsSource`, active `CuratedRegistrySource`, `PartnerApiSource` stub behind `FEATURE_PARTNER_API=false`; environment names with empty values. No fake Socios responses, signup, credentials or unapproved live calls. Indie access remains UNKNOWN; actual adapter activation requires confirmed access/terms.                                                                                                                                                                                                                            |
| SR-61 — Point-efficiency route flags                   | **GO only for independently source-confirmed route flags; NO-GO for unconfirmed Fan Zone/other earn routes or numerical efficiency**                                         | Actual AC asks for confirmed flags, not live RP calculations. Cite R-01 or official Socios/Chiliz evidence per route. No confirming Fan Zone source was supplied, so do not flag it as confirmed; no guessed Token Hunt/game/CHZ RP routes. External-wallet staking must not be presented as RP earning. Omit/mark unconfirmed routes; no fabricated RP figures.                                                                                                                                                                                                                         |

No scope reduction is implied by these fallback states. Any unresolved input
needed to meet an AC remains a delivery gate, not permission to silently omit
that AC. Re-open the research/ADR when authoritative evidence changes.

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
does not establish their precise cause. These failed sandbox attempts remain
recorded alongside the successful maintainer capture above.

The maintainer supplied the detailed inline capture after gist access failed,
and supplied exact downstream Jira ACs. The evidence-access QUESTION is
resolved; no RPC rerun is needed. Brave approved all four caveats unchanged,
with approval provenance above. Successful reads remain maintainer-run, not
sandbox-run; only log counts, not raw log payloads, were supplied inline.

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

### Local validation, 13 October 2026

- `pnpm --filter @scoutreport/chain test`: **140 tests passed**, including five
  new offline spike tests; chain lint/typecheck also passed.
- `pnpm turbo run lint typecheck test build`: **18 tasks successful**.
  Initial attempts were blocked downloading solc/Matchstick; installing the
  same official pinned tools locally resolved this without repository changes.
- `forge fmt --check`, `forge build`, `forge test -vvv`: passed, **11 Solidity
  tests passed**.
- Changed-file secret scan: no secrets. CodeQL JavaScript scan: **zero alerts**.
  Separate read-only code review: no significant issues (the bundled review
  executable was unavailable).
- [PR CI run 38417673675](https://github.com/GoHigherDev/ScoutReport/actions/runs/38417673675):
  `action_required`, awaiting GitHub approval when checked; no jobs ran.
  Local success is not a claim that all four remote checks have run.

Follow-up after the maintainer answer: the five offline spike tests passed,
and `pnpm turbo run lint typecheck test build` again completed all **18 tasks**.
Only this research doc and ADR were updated; scripts, ABIs and network-free
tests are unchanged. Documentation formatting and docs-only review passed.
[CI run 38418190440](https://github.com/GoHigherDev/ScoutReport/actions/runs/38418190440)
still required GitHub approval with no jobs when checked.

After the detailed inline capture and copy approval, the five offline spike
tests and all **18 workspace lint/typecheck/test/build tasks passed again**.
Both changed docs passed formatting checks; the transcription review found
no significant issues and the changed-file secret scan was clean. Scripts,
ABIs and offline tests remain unchanged. [CI run 38420069190](https://github.com/GoHigherDev/ScoutReport/actions/runs/38420069190)
required GitHub approval with no jobs when checked.

Resolved on the maintainer's evidence: successful Mainnet capture, detailed
non-log read transcription, actual downstream Jira scopes and Brave's approval
of the four caveats (AC7). Raw logs remain captured, not transcribed (counts
only); token/team mapping, reliable wallet-brand detection, RP feeds and indie
Partner API access remain UNKNOWN. SR-54/SR-55 remain parked and remote CI
approval is still required. No sandbox live read or inferred value is claimed.

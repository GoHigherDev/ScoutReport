# SR-30 [C-01]: Socios staking read spike

ScoutReport is a third-party dapp, not affiliated with Socios. Mainnet access
is read-only; no Partner API, private wallet data or Reward Point (RP) estimates
are used.

## Timebox and outcome

Timebox: **at most two working days**, starting 13 October 2026. This initial
investigation was performed on 13 October; blocked checks are handed off below,
not treated as successful or extended indefinitely.

**GO for local mock-interface development; NO-GO for verified live chat gating.**
The verified ABI is already present from F-06 / SR-11. Mocks and a Spicy-only
deployment script are ready, but **no deployment was broadcast**. Per the
[maintainer's 13 October update](https://github.com/GoHigherDev/ScoutReport/pull/20#issuecomment-6141508687),
Brave reworded AC4 in Jira: the mocks, tests, Spicy-only deploy script and null
deployment placeholders satisfy SR-30; actual deployment moves to **F-11** and
is not a blocker for this spike. Maintainer-run code reads are recorded below.
The [maintainer's live Mainnet reads](https://github.com/GoHigherDev/ScoutReport/pull/20#issuecomment-6141549590)
now verify two configured tokens, the seven-day period and pending/cooldown
amounts. These checks are met on maintainer-run evidence, not sandbox reads.
No live non-zero claimable amount was observed. Sandbox RPC/explorer access
still fails DNS.

## Evidence and provenance

| Evidence                | Source / date                                                                                                                                                                                                                                                                             | Result and limitation                                                                                                                                                                                                          |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Complete Staking3 ABI   | [`packages/chain/abis/staking.json`](../../packages/chain/abis/staking.json), supplied in [SR-11 / issue #17](https://github.com/GoHigherDev/ScoutReport/issues/17), retrieved 13 October 2026                                                                                            | Reused unchanged; no independently observed ABI difference.                                                                                                                                                                    |
| Verified implementation | [Routescan source API](https://api.routescan.io/v2/network/mainnet/evm/88888/etherscan/api?module=contract&action=getsourcecode&address=0xed9331b504cd498ec04613d621a92c8e28bb8417), [Chiliscan implementation](https://chiliscan.com/address/0xed9331b504cd498ec04613d621a92c8e28bb8417) | F-06 records Staking3, Solidity 0.8.23, UUPS implementation `0xed9331b504cd498ec04613d621a92c8e28bb8417`. Independent source re-fetch failed DNS on 13 October. Recheck the implementation before relying on a future capture. |
| Mainnet proxy           | [Chiliscan proxy](https://chiliscan.com/address/0x5ff7f9724fd477d9a07dcdb894d0ca7f8fae1501), [SR-30 pipeline notes](https://github.com/GoHigherDev/ScoutReport/issues/19)                                                                                                                 | `0x5ff7f9724fd477d9a07dcdb894d0ca7f8fae1501`; supplied verified address, not a testnet deployment.                                                                                                                             |
| Spicy `eth_getCode` | [Maintainer-run read](https://github.com/GoHigherDev/ScoutReport/pull/20#issuecomment-6141508687), 13 October 2026, `https://spicy-rpc.chiliz.com` | Returned `0x` for `0x5ff7f9724fd477d9a07dcdb894d0ca7f8fae1501`: no staking contract at that address on Spicy. Not reproduced in the sandbox; block number UNKNOWN. |
| Mainnet `eth_getCode` | [Maintainer-run read](https://github.com/GoHigherDev/ScoutReport/pull/20#issuecomment-6141508687), 13 October 2026, `https://rpc.chiliz.com` | The same address returns an ERC-1967 proxy according to the maintainer. Raw bytecode and block number were not supplied; not reproduced in the sandbox. |
| `unstakePeriod()` | [Maintainer-run Mainnet reads](https://github.com/GoHigherDev/ScoutReport/pull/20#issuecomment-6141549590), 13 October 2026, block 38370307 | **604800 seconds (7 days)** on both RPCs. Contract-wide, not proof of any token override; sandbox call failed DNS. |
| Token catalogue         | [Chiliz token contract addresses](https://docs.chiliz.com/quick-start/token-contract-addresses), [`FAN_TOKENS`](../../packages/chain/src/tokens.config.ts)                                                                                                                                | NAVI and AFC Mainnet V2 proxies are configured; no Spicy address is configured. Pipeline notes report on-chain decimals of 18 for both; independent reads remain blocked.                                                      |

Official pages discovered in indexed search results:

- [Socios Connect: Working with Staking](https://connect.socios.com/interact-with-chiliz-chain/working-with-staking)
- [Socios Connect: Testnet Fan Token addresses](https://connect.socios.com/interact-with-chiliz-chain/working-with-tokens/testnet-fan-token-addresses)
- [Chiliz: Smart Contract Addresses](https://docs.chiliz.com/quick-start/smart-contract-addresses)

The staking results reference a `stakingABI.json` attachment and testnet/mainnet
staking links, but page bodies, the exact attachment URL and linked deployment
tables could not be independently retrieved. Alternative official Spicy staking
deployments remain **UNKNOWN**, not evidence that none exists anywhere.
The maintainer-run Spicy empty-code observation supports the **mock + Mainnet
read-only verification** strategy. Whether Spicy has other official Fan Token
contracts is **UNKNOWN**; absence from `FAN_TOKENS` is not a chain-wide search.

### Attempts in this environment

On 13 October 2026, JSON-RPC requests for `eth_chainId`, `eth_getCode` and
`eth_blockNumber` were attempted against:

- `https://spicy-rpc.chiliz.com/`
- `https://rpc.ankr.com/chiliz`
- `https://rpc.chiliz.com`
- `https://chiliz-rpc.publicnode.com`

All failed before receiving an RPC response:
`No address associated with hostname` (`Errno -5` in the Python HTTP client).
Direct `cast code` on Spicy, `cast call ... unstakePeriod()` on Mainnet and
`cast logs ... Stake(...)` on Mainnet also failed DNS. Routescan failed with the
same lookup error. No block, public staker, stake amount or explorer comparison
was obtained; none is invented below.

## Exact read interface

Decoded from the existing verified ABI, not the abbreviated docs sample:

```solidity
struct StakeDataResponse {
    uint256 totalStake;
    uint256 totalUnstakable;
    uint256 totalLocked;
    uint256 totalLockedFlexible;
    uint256 totalClaimable;
    uint256 totalPendingUnstake;
    uint256 totalExemptFromCooldownPeriod;
    uint256[] totalLockedPerEventType;
}

getStakeData(address staker, address token, bool perEventType)
    external view returns (StakeDataResponse);
getStakeDataLatest(address staker, address token, bool perEventType)
    external returns (StakeDataResponse); // nonpayable in the ABI
unstakePeriod() external view returns (uint256);
```

Both stake readers return **one tuple**, not eight separate outputs.
Its verified ABI internal type is `struct IStaking2aTypes.StakeDataResponse`.
`staker` is the public wallet being queried; `token` is the Fan Token proxy,
not its implementation. `perEventType` is a boolean; its exact branch behaviour,
array indexing and event-type identifiers are **UNKNOWN** without verified
source or empirical comparison. Do not assume that `false` necessarily returns
an empty array or invent event-type names.

F-06's `readStakeDataLatest` passes `false` through `simulateContract` (`eth_call`).
The latest reader refreshes accounting in simulation according to the supplied
F-06 findings; simulated changes are not persisted. **Never send a transaction
to it**, even though the ABI labels it nonpayable. The view reader is also
available, but equivalence after time-dependent accounting is UNKNOWN.

| Return field                    | Proven ABI type / units                          | Meaning and outstanding verification                                                                     |
| ------------------------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| `totalStake` | `uint256`; raw token units confirmed for sampled NAVI/AFC | Matches `getStake` in all five samples; pending-only AFC samples have zero totalStake. General locked/cooldown overlap rules remain UNKNOWN. |
| `totalUnstakable` | `uint256`; sampled values match raw totalStake | Equals totalStake in the samples; exact lock/exemption rules UNKNOWN. |
| `totalLocked`                   | `uint256`; token-unit interpretation UNKNOWN     | Lock aggregate definition and overlap with other totals UNKNOWN.                                         |
| `totalLockedFlexible`           | `uint256`; token-unit interpretation UNKNOWN     | Flexible-lock definition and overlap UNKNOWN.                                                            |
| `totalClaimable` | `uint256`; token-unit interpretation not verified by a non-zero sample | Zero in all five samples, matching `getClaimableStake`; non-zero matured claimable behaviour UNKNOWN. |
| `totalPendingUnstake` | `uint256`; raw token units confirmed for sampled AFC | 600 and 300 AFC in cooldown, matching Unstake events; treatment after maturity remains UNKNOWN. |
| `totalExemptFromCooldownPeriod` | `uint256`; token-unit interpretation UNKNOWN     | Exemption scope and aggregation UNKNOWN.                                                                 |
| `totalLockedPerEventType`       | `uint256[]`; element-unit interpretation UNKNOWN | Per-event-type ordering, length, flag behaviour and overlap UNKNOWN.                                     |

The ABI alone proves types, **not accounting semantics or units**. Once source
arithmetic/live evidence confirms token amounts, scale each with that token's
on-chain `decimals()`, never a hardcoded 18. Do not sum these fields:
they may overlap. `unstakePeriod` is seconds, not scaled by token decimals.
Token-specific overrides appear in the ABI (`setUnstakePeriodForToken`);
the no-argument getter does not prove their effective values.

**Pending claimable:** pending amounts in cooldown are verified live below.
`totalClaimable` and `getClaimableStake(address,address)` both returned zero
for every sampled staker; **a live non-zero claimable value is UNKNOWN (not
observed)**. The latter is nonpayable and must also use `eth_call`, never a
transaction. Whether either counts towards Bronze/Silver/Gold is **C-03's product
decision**, not made by this spike. The existing helper only exposes
`totalStake`; its `unstaked` alias means liquid `balanceOf`, not cooldown.
The tuple has no timestamp/deadline field, so these readers alone do not
directly give a wallet's remaining cooldown duration.

## Mainnet verification: two configured tokens

| Token | Mainnet proxy / explorer                                                                                                 | Decimals evidence                                             | Public staker / block / staked amount / explorer comparison |
| ----- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------- | ----------------------------------------------------------- |
| NAVI | [`0x02728748392F1875682940681F4C936Fc683A68e`](https://chiliscan.com/token/0x02728748392F1875682940681F4C936Fc683A68e) | Maintainer read decimals=18 and symbol=NAVI at block 38370307 | 2 and 1 NAVI; matches source Stake events below. |
| AFC | [`0x76088F3eD5dC655De9295D93868ec1EeC654A615`](https://chiliscan.com/token/0x76088F3eD5dC655De9295D93868ec1EeC654A615) | Maintainer read decimals=18 and symbol=AFC at block 38370307 | 3044.41 AFC staked; 600/300 AFC pending in separate wallets. Full stake-history reconciliation UNKNOWN. |

The F-06 zero-wallet fixture is not evidence for a real public staker and is
not substituted for the two-token verification. A recent `Stake` log search
was attempted in the sandbox but failed DNS. The following public-wallet
evidence was instead obtained by the maintainer.

### Maintainer-run block-pinned capture

Source: [PR comment 6141549590](https://github.com/GoHigherDev/ScoutReport/pull/20#issuecomment-6141549590),
13 October 2026. `eth_chainId` confirmed **88888**. All values were read at
**block 38370307**, reported timestamp **08:30:20 UTC / 09:30:20 BST**.
`https://rpc.chiliz.com` and `https://chiliz-rpc.publicnode.com` returned
identical results. The ERC-1967 implementation storage slot read returned
`0xed9331b504cd498ec04613d621a92c8e28bb8417`, matching F-06's Staking3 provenance.
The maintainer used this branch's ABI with ethers v6; nonpayable
`getStakeDataLatest` and `getClaimableStake` were called via `eth_call`
(`staticCall`). No transactions or keys were used.

The table uses **token amounts**, scaled by on-chain decimals (18 for each
sampled token). Tuple order is `totalStake | totalUnstakable | totalLocked |
totalLockedFlexible | totalClaimable | totalPendingUnstake |
totalExemptFromCooldownPeriod | totalLockedPerEventType`.

| Token / public staker | Source event / explorer evidence | Decoded `getStakeDataLatest(staker, token, true)` |
| --- | --- | --- |
| NAVI [`0x2bda90268064f289df62dd48c9b7a48fb9d9383b`](https://chiliscan.com/address/0x2bda90268064f289df62dd48c9b7a48fb9d9383b) | [Stake 2 NAVI](https://chiliscan.com/tx/0x59eaaba56813e00d089ec4821e8cc98fcfab2300f9e5ce08f5ef7498e67a0adb), block 32917730 | `2 / 2 / 0 / 0 / 0 / 0 / 0 / [0,0]` |
| NAVI [`0xb8832b8028c4d64b491bfaf4ae25b2beb34b9e52`](https://chiliscan.com/address/0xb8832b8028c4d64b491bfaf4ae25b2beb34b9e52) | [Stake 1 NAVI](https://chiliscan.com/tx/0xba976607259282aa89af6bc31152cfe291f0a8bbbc59e63dafa2bf223fa2f027), block 32907545 | `1 / 1 / 0 / 0 / 0 / 0 / 0 / [0,0]` |
| AFC [`0xf2f267Dbe597eb029E44359cA4e14eC991c88Cc2`](https://chiliscan.com/address/0xf2f267Dbe597eb029E44359cA4e14eC991c88Cc2) | [Stake 2790.41 AFC](https://chiliscan.com/tx/0x512c06f0fea2b43ad9c268ffc8affd5175e3136dfd7986d6794263ef280770f7), block 38358809 | `3044.41 / 3044.41 / 0 / 0 / 0 / 0 / 0 / [0,0]` |
| AFC [`0xfea00bddbf1dd40300f9739b933c0070b004049d`](https://chiliscan.com/address/0xfea00bddbf1dd40300f9739b933c0070b004049d) | [Unstake 600 AFC](https://chiliscan.com/tx/0xfa486c86ec1b77bf06961d45a9fb1be4b514a560b7f4f0ce65030c6f05ca59e2), block 38347946, `claimableAt=1792417420` | `0 / 0 / 0 / 0 / 0 / 600 / 0 / [0,0]` |
| AFC [`0xe57316b95c3b2f1daac76e907705469e30af57e9`](https://chiliscan.com/address/0xe57316b95c3b2f1daac76e907705469e30af57e9) | [Unstake 300 AFC](https://chiliscan.com/tx/0xd8fe210133c9bfadb98c257cc8763ed6cf864d0a81e53c3bde4b070db696c1cd), block 38308614, `claimableAt=1792296717` | `0 / 0 / 0 / 0 / 0 / 300 / 0 / [0,0]` |

`getStakeData(staker, token, true)` matched the latest reader for all five
samples; `getStake(staker, token)` matched `totalStake`. This does not prove
equivalence for all time-dependent states, nor establish `false` flag behaviour
or the meaning of the two event-type array positions.

Public stakers came from Routescan Stake/Unstake log queries (proxy address,
event topic and indexed token filter), supplemented by AFC `eth_getLogs` on
the primary RPC. Routescan event amounts match NAVI's 2/1 staked amounts and
AFC's 600/300 pending amounts. The 3044.41 AFC total exceeds its latest single
2790.41 stake; earlier stakes are plausible, but the full history was not
summed, so reconciliation remains **UNKNOWN**. An explorer UI per-user staked
balance comparison is also **UNKNOWN**: the maintainer reports that these
explorers do not expose it for this contract.

`unstakePeriod()` was **604800 seconds (7 days)** and
`MAX_UNSTAKE_PERIOD_SEC()` was **1209600 seconds (14 days)**. The ABI has no
per-token period getter; NAVI/AFC overrides remain UNKNOWN. Override events or
Unstake `claimableAt` versus block time were not analysed for this purpose.

Both AFC unstakes were still in cooldown at the capture block, confirming
readable pending amounts. `totalClaimable` and `getClaimableStake` were zero
for every sample. Re-read after the recorded `claimableAt`, or sample a matured
Unstake without a later Claim, to observe a non-zero claimable case. Per-unstake
unlock time comes from the `Unstake` event's `claimableAt`, not the response tuple.

The two-token read-only verification, live seven-day period and pending/cooldown
readability checks are **MET on maintainer-run evidence**. The maintainer labels
the period check “AC5” and pending/cooldown “AC6”; the original ticket groups
two-token verification under AC5 and the period/pending checks under AC6.
No non-zero claimable result or complete accounting formula is claimed.

### Read-only hand-off commands

Run from the repository root with Foundry and pnpm available. No key is needed.
Use a bounded log range; widen it backwards if no public staker is found.
The event signature below comes from the verified ABI.

```sh
export RPC_URL_MAINNET=https://rpc.ankr.com/chiliz
STAKING=0x5ff7f9724fd477d9a07dcdb894d0ca7f8fae1501
cast chain-id --rpc-url "$RPC_URL_MAINNET" # must be 88888
BLOCK=$(cast block-number --rpc-url "$RPC_URL_MAINNET")
FROM=$((BLOCK - 1000))
cast logs --address "$STAKING" --from-block "$FROM" --to-block "$BLOCK" \
  'Stake(address indexed staker,address indexed token,uint256 amount)' \
  --rpc-url "$RPC_URL_MAINNET"
cast chain-id --rpc-url https://spicy-rpc.chiliz.com/ # must be 88882
cast code "$STAKING" --rpc-url https://spicy-rpc.chiliz.com/
```

Set `PUBLIC_STAKER` from an actual log's indexed `staker`, never a made-up
wallet. A historical stake event does not establish a current non-zero balance.
Record the block hash/time and raw results; use a staker for each token if needed.

```sh
for TOKEN in 0x02728748392F1875682940681F4C936Fc683A68e \
             0x76088F3eD5dC655De9295D93868ec1EeC654A615; do
  cast call "$TOKEN" 'decimals()(uint8)' --block "$BLOCK" --rpc-url "$RPC_URL_MAINNET"
  cast call "$TOKEN" 'balanceOf(address)(uint256)' "$PUBLIC_STAKER" \
    --block "$BLOCK" --rpc-url "$RPC_URL_MAINNET"
  for FLAG in false true; do
    for READER in getStakeData getStakeDataLatest; do
      cast call "$STAKING" \
        "$READER(address,address,bool)((uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256[]))" \
        "$PUBLIC_STAKER" "$TOKEN" "$FLAG" --block "$BLOCK" --rpc-url "$RPC_URL_MAINNET"
    done
  done
done
cast call "$STAKING" 'unstakePeriod()(uint256)' \
  --block "$BLOCK" --rpc-url "$RPC_URL_MAINNET"
pnpm --filter @scoutreport/chain read-stake "$PUBLIC_STAKER" NAVI
pnpm --filter @scoutreport/chain read-stake "$PUBLIC_STAKER" AFC
```

The existing CLI reads latest state, not the pinned block. Use the pinned tuple
calls for reproducible comparisons. Compare explorer read-contract results
where available; record explorer failures separately, without blocking RPC
verification. Confirm the ERC-1967 implementation against F-06 provenance.

## Spicy mock strategy and deployment hand-off

- `MockSociosStaking` matches the two readers' selectors, parameters, tuple
  field names/order/types and mutability, plus `unstakePeriod()`.
- Immutable, non-zero owner sets complete fixtures independently for each
  `(staker, token, perEventType)` and the period in seconds. Unset fixtures are
  zero. It **does not** stake, hold tokens, accrue RP or model cooldown time;
  independent flag fixtures deliberately avoid guessing live branch behaviour.
- `MockFanToken` is a test-only ERC-20 with immutable configurable decimals
  and owner-only minting. The script deploys 18- and 6-decimal tokens with
  bracketed test labels. No live Fan Token is impersonated.
- Foundry tests cover both readers, every tuple field, fixture isolation,
  dynamic-array replacement, owner restrictions, decimals, transfers,
  allowances and rejection of Mainnet deployment before reading any key.
  Compiled read ABI parity was checked against `staking.json`, excluding only
  Solidity-internal struct namespaces.

[`deployments/88882.json`](../../deployments/88882.json) is deliberately
**PENDING**, with null addresses and transaction hashes, not usable config.
This satisfies revised **AC4 for SR-30**; populating real addresses and deploying
the mocks are **F-11 deliverables**, not outstanding SR-30 acceptance work.
The following command is a **key-holder hand-off only**, to be integrated with
F-11, not executed by this spike. The authorised runner supplies
`SPICY_DEPLOYER_PRIVATE_KEY` through its secret environment; do not put it in a
command, file, issue, log or commit. No key is requested here.

```sh
cd packages/contracts
forge script script/DeployChatMocks.s.sol:DeployChatMocks \
  --rpc-url https://spicy-rpc.chiliz.com/ --broadcast
```

The script rejects every chain except 88882. All three owners are the
environment key's address; the initial period and balances are zero. The key
holder must seed explicitly synthetic fixtures and a period, verify code and
on-chain decimals, exercise both read signatures on Spicy, and record real
addresses, transaction hashes and verification date in the manifest. Keep
Foundry broadcast artefacts ignored.

Deployment is deferred to F-11; this spike does not wait for it or request a key.
The maintainer-run live Mainnet evidence for AC5/AC6 is recorded above.

## Proposed env/config shape (not implemented tier logic)

| Setting / config                                     | Real-data mode                         | Test-fixture mode                                             |
| ---------------------------------------------------- | -------------------------------------- | ------------------------------------------------------------- |
| `NEXT_PUBLIC_APP_CHAIN_ID`                           | 88882 until go-live                    | 88882                                                         |
| `NEXT_PUBLIC_DATA_CHAIN_ID`                          | 88888, read-only                       | Keep real-data helpers on 88888                               |
| `CHAT_DATA_CHAIN_ID` (proposed server-only selector) | 88888                                  | 88882, explicit mock adapter                                  |
| staking address keyed by chain ID                    | Verified Mainnet proxy above           | Verified `MockSociosStaking` manifest address, currently null |
| token addresses keyed by chain ID                    | Existing NAVI/AFC `FAN_TOKENS` proxies | Separate mock entries from manifest, currently null           |
| RPC transport                                        | Existing `RPC_URL_MAINNET` / fallback  | Existing `RPC_URL_SPICY`                                      |

`CHAT_DATA_CHAIN_ID` is a proposal for follow-up stories, not a working env
switch in this PR. The F-06 reader intentionally rejects Spicy; do not weaken
that guard or silently substitute mock amounts in real-data mode. A future
server adapter must validate chain/address configuration, reject null
deployments, label mock data and read decimals on-chain. Mock tokens must not
be added to the official Mainnet token catalogue.

## Go/no-go and hand-offs

Ticket scopes beyond the supplied C-03 decision are unavailable here; this is
a **staking-dependency gate**, not a claim to know every ticket's requirements.
“Mock GO” means local interface fixtures only, not deployed Spicy evidence.

| Story | Local staking dependency   | Live staking dependency / remaining gate                                                                |
| ----- | -------------------------- | ------------------------------------------------------------------------------------------------------- |
| C-02 | Mock GO | Two-token Mainnet read interface verified; confirm story scope and remaining semantics. Spicy deployment is a separate F-11 dependency, not an SR-30 AC. |
| C-03  | Mock GO for test scenarios | NO-GO: verified totals/cooldown semantics and owner decision on pending amounts; no tier policy chosen. |
| C-04  | Mock GO                    | NO-GO for live staking-dependent behaviour; confirm scope and complete evidence/deployment.             |
| C-05  | Mock GO                    | NO-GO for live staking-dependent behaviour; confirm scope and complete evidence/deployment.             |
| C-06  | Mock GO                    | NO-GO for live staking-dependent behaviour; confirm scope and complete evidence/deployment.             |
| C-07  | Mock GO                    | NO-GO for live staking-dependent behaviour; confirm scope and complete evidence/deployment.             |
| C-08  | Mock GO                    | NO-GO for live staking-dependent behaviour; confirm scope and complete evidence/deployment.             |
| C-09  | Mock GO                    | NO-GO for live staking-dependent behaviour; confirm scope and complete evidence/deployment.             |
| C-10  | Mock GO                    | NO-GO for live staking-dependent behaviour; confirm scope and complete evidence/deployment.             |
| C-11  | Mock GO                    | NO-GO for live staking-dependent behaviour; confirm scope and complete evidence/deployment.             |

**F-06:** no ABI update needed on current evidence. Preserve simulation-only
latest reads and the Mainnet guard. Source semantics, per-token periods and
non-zero claimable behaviour remain open. Maintainer-run block-pinned captures
now verify two tokens and pending amounts; helpers currently discard all tuple
fields except `totalStake`.

**F-11:** deploy and verify mocks using the authorised secret-bearing workflow;
return public evidence only. Actual deployment is deferred to F-11 under
revised AC4; **SR-30's mock scaffold acceptance is met**.

**R-01:** this is a balance interface, not an RP/yield oracle. External-wallet
staking does not earn Socios RP according to F-06. No Partner credentials,
live RP pool sizes or yields are available; do not infer optimiser returns
from mock balances, lock arrays or the seven-day supplied period.

Remaining UNKNOWNs: official Spicy deployments/token availability, source
accounting and flag semantics, full AFC history reconciliation, explorer UI
balance comparison, non-zero claimable behaviour and token overrides.
The proxy code checks have maintainer-run evidence; other official Spicy
deployment/token availability remains UNKNOWN. AC5/AC6 now have maintainer-run
evidence as detailed above. Actual mock deployment does not block revised
SR-30 acceptance.

## Validation

- `pnpm turbo run lint typecheck test build`: all 15 tasks passed locally.
- `forge fmt --check` and Foundry tests: passed (11 tests, including 10 new
  focused mock tests). Local toolchain: Forge 1.7.1, Solidity 0.8.30.
- Changed-file secret scan: no secrets found. No transactions broadcast.
- Separate read-only code review: no significant issues found. The automated
  review binary was unavailable; CodeQL did not analyse Solidity.
- Initial CI required maintainer approval and had no jobs/logs.
  [CI run 38369768121](https://github.com/GoHigherDev/ScoutReport/actions/runs/38369768121)
  subsequently **passed all four checks** on head `845120e` after approval.
  This is the latest verified green run before this documentation-only update,
  not a claim that a later head has already passed CI.

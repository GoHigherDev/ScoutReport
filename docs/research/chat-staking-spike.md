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
**AC5 and AC6 remain pending the maintainer's separate live Mainnet read
comment**; their sections are not finalised. Sandbox RPC/explorer access still
fails DNS.

## Evidence and provenance

| Evidence                | Source / date                                                                                                                                                                                                                                                                             | Result and limitation                                                                                                                                                                                                          |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Complete Staking3 ABI   | [`packages/chain/abis/staking.json`](../../packages/chain/abis/staking.json), supplied in [SR-11 / issue #17](https://github.com/GoHigherDev/ScoutReport/issues/17), retrieved 13 October 2026                                                                                            | Reused unchanged; no independently observed ABI difference.                                                                                                                                                                    |
| Verified implementation | [Routescan source API](https://api.routescan.io/v2/network/mainnet/evm/88888/etherscan/api?module=contract&action=getsourcecode&address=0xed9331b504cd498ec04613d621a92c8e28bb8417), [Chiliscan implementation](https://chiliscan.com/address/0xed9331b504cd498ec04613d621a92c8e28bb8417) | F-06 records Staking3, Solidity 0.8.23, UUPS implementation `0xed9331b504cd498ec04613d621a92c8e28bb8417`. Independent source re-fetch failed DNS on 13 October. Recheck the implementation before relying on a future capture. |
| Mainnet proxy           | [Chiliscan proxy](https://chiliscan.com/address/0x5ff7f9724fd477d9a07dcdb894d0ca7f8fae1501), [SR-30 pipeline notes](https://github.com/GoHigherDev/ScoutReport/issues/19)                                                                                                                 | `0x5ff7f9724fd477d9a07dcdb894d0ca7f8fae1501`; supplied verified address, not a testnet deployment.                                                                                                                             |
| Spicy `eth_getCode` | [Maintainer-run read](https://github.com/GoHigherDev/ScoutReport/pull/20#issuecomment-6141508687), 13 October 2026, `https://spicy-rpc.chiliz.com` | Returned `0x` for `0x5ff7f9724fd477d9a07dcdb894d0ca7f8fae1501`: no staking contract at that address on Spicy. Not reproduced in the sandbox; block number UNKNOWN. |
| Mainnet `eth_getCode` | [Maintainer-run read](https://github.com/GoHigherDev/ScoutReport/pull/20#issuecomment-6141508687), 13 October 2026, `https://rpc.chiliz.com` | The same address returns an ERC-1967 proxy according to the maintainer. Raw bytecode and block number were not supplied; not reproduced in the sandbox. |
| `unstakePeriod()`       | SR-30 pipeline notes and [F-06](https://github.com/GoHigherDev/ScoutReport/pull/18), 13 October 2026                                                                                                                                                                                      | Supplied live observation: **604800 seconds (7 days)**. Independent call failed DNS; block number UNKNOWN. It is contract-wide, not proof of any token override.                                                               |
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
| `totalStake`                    | `uint256`; F-06 interprets as raw token units    | F-06's chosen staked balance. Inclusion/exclusion of cooldown and locked amounts is UNKNOWN empirically. |
| `totalUnstakable`               | `uint256`; token-unit interpretation UNKNOWN     | Name suggests unstakable total; exact lock/exemption rules UNKNOWN.                                      |
| `totalLocked`                   | `uint256`; token-unit interpretation UNKNOWN     | Lock aggregate definition and overlap with other totals UNKNOWN.                                         |
| `totalLockedFlexible`           | `uint256`; token-unit interpretation UNKNOWN     | Flexible-lock definition and overlap UNKNOWN.                                                            |
| `totalClaimable`                | `uint256`; token-unit interpretation UNKNOWN     | Candidate matured unstake amount; eligibility and relationship to pending amounts UNKNOWN.               |
| `totalPendingUnstake`           | `uint256`; token-unit interpretation UNKNOWN     | Candidate cooldown amount; whether it includes already-claimable amounts UNKNOWN.                        |
| `totalExemptFromCooldownPeriod` | `uint256`; token-unit interpretation UNKNOWN     | Exemption scope and aggregation UNKNOWN.                                                                 |
| `totalLockedPerEventType`       | `uint256[]`; element-unit interpretation UNKNOWN | Per-event-type ordering, length, flag behaviour and overlap UNKNOWN.                                     |

The ABI alone proves types, **not accounting semantics or units**. Once source
arithmetic/live evidence confirms token amounts, scale each with that token's
on-chain `decimals()`, never a hardcoded 18. Do not sum these fields:
they may overlap. `unstakePeriod` is seconds, not scaled by token decimals.
Token-specific overrides appear in the ABI (`setUnstakePeriodForToken`);
the no-argument getter does not prove their effective values.

**Pending claimable:** both named candidate fields can be returned by the same
tuple interface; cooldown versus matured-claimable semantics are not yet
verified. Whether either counts towards Bronze/Silver/Gold is **C-03's product
decision**, not made by this spike. The existing helper only exposes
`totalStake`; its `unstaked` alias means liquid `balanceOf`, not cooldown.
The tuple has no timestamp/deadline field, so these readers alone do not
directly give a wallet's remaining cooldown duration.

## Mainnet verification: two configured tokens

| Token | Mainnet proxy / explorer                                                                                                 | Decimals evidence                                             | Public staker / block / staked amount / explorer comparison |
| ----- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------- | ----------------------------------------------------------- |
| NAVI  | [`0x02728748392F1875682940681F4C936Fc683A68e`](https://scan.chiliz.com/token/0x02728748392F1875682940681F4C936Fc683A68e) | Supplied on-chain observation: 18; not independently repeated | **UNKNOWN — RPC/explorer DNS blocked**                      |
| AFC   | [`0x76088F3eD5dC655De9295D93868ec1EeC654A615`](https://scan.chiliz.com/token/0x76088F3eD5dC655De9295D93868ec1EeC654A615) | Supplied on-chain observation: 18; not independently repeated | **UNKNOWN — RPC/explorer DNS blocked**                      |

The F-06 zero-wallet fixture is not evidence for a real public staker and is
not substituted for the two-token verification. A recent `Stake` log search
was attempted but failed DNS.

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
The maintainer will supply the separate live Mainnet evidence for AC5/AC6.

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
| C-02  | Mock GO                    | NO-GO: two-token Mainnet capture pending; confirm story scope. Spicy deployment is a separate F-11 dependency, not an SR-30 AC. |
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
block-pinned captures remain open; helpers currently discard all tuple fields
except `totalStake`.

**F-11:** deploy and verify mocks using the authorised secret-bearing workflow;
return public evidence only. Actual deployment is deferred to F-11 under
revised AC4; **SR-30's mock scaffold acceptance is met**.

**R-01:** this is a balance interface, not an RP/yield oracle. External-wallet
staking does not earn Socios RP according to F-06. No Partner credentials,
live RP pool sizes or yields are available; do not infer optimiser returns
from mock balances, lock arrays or the seven-day supplied period.

Remaining UNKNOWNs: official Spicy deployments/token availability, source
accounting and flag semantics, two real staker captures, explorer comparisons,
token overrides and sandbox period reads. The proxy code checks have
maintainer-run evidence; other official Spicy deployment/token availability
remains UNKNOWN. AC5/AC6 await the promised maintainer comment. Actual mock
deployment does not block revised SR-30 acceptance.

## Validation

- `pnpm turbo run lint typecheck test build`: all 15 tasks passed locally.
- `forge fmt --check` and Foundry tests: passed (11 tests, including 10 new
  focused mock tests). Local toolchain: Forge 1.7.1, Solidity 0.8.30.
- Changed-file secret scan: no secrets found. No transactions broadcast.
- Separate read-only code review: no significant issues found. The automated
  review binary was unavailable; CodeQL did not analyse Solidity.
- Initial CI required maintainer approval and had no jobs/logs.
  [CI run 38368820202](https://github.com/GoHigherDev/ScoutReport/actions/runs/38368820202)
  subsequently **passed all four checks** on reviewed head `2be616f` after approval.
  This is the latest verified green run before this documentation-only update,
  not a claim that a later head has already passed CI.

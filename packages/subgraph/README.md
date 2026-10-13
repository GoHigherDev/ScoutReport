# Scout Rating indexing (SR-15)

The separate [predictions subgraph (SR-43)](predictions/README.md) indexes
APP_CHAIN match, pick and points events without changing this holdings index.

ScoutReport is a third-party SportFi dapp on Chiliz Chain, not affiliated with
Socios. This subgraph reads **DATA_CHAIN = Chiliz Mainnet (88888)** independently
of **APP_CHAIN = Spicy (88882)** until Mainnet go-live. It uses no Partner API,
Reward Point fields or scraping. Live hosting is SR-16, not this ticket.

For SR-16's protected preview/staging setup, dispatch-only Goldsky deployment,
server-only query URL and rollback, see the
[deployment runbook](../../docs/runbooks/deploy.md). Goldsky supports Mainnet
`chiliz`; Spicy remains documented only.

## Scope and accounting

Only NAVI and AFC from `packages/chain/src/tokens.config.ts` are indexed.
`subgraph.yaml` initialises one `FanToken` ERC-20 template instance per token
at its start block. The template indexes `Transfer`, including mint and burn.
Template creation includes events in the creation block, so the first Transfer
is included. `symbol()` and `decimals()` are read through the contract binding
when each Token is first encountered; failed metadata calls stop indexing
rather than inventing a value.

- `Token`: lower-case contract address ID, on-chain symbol and decimals.
- `Account`: lower-case wallet address ID, with derived holdings.
- `Holding`: `<token-address>-<account-address>` ID, liquid, staked,
  `scoutRating = liquid + staked`, `firstAcquiredAt`, `updatedAt`, `isExcluded`.
  Amounts are raw `BigInt` token units; format using the Token's on-chain decimals,
  never config expectations or JavaScript floating-point arithmetic.
- `firstAcquiredAt` is the timestamp of the first observed positive rating for a
  non-excluded account; it remains unchanged after disposal/reacquisition.
  It is null for accounts with no positive acquisition and excluded accounts.
  `updatedAt` is the latest handled Transfer/Stake/Unstake timestamp.
- The zero address and staking proxy holdings have `isExcluded: true`. Mint/burn
  never changes the zero address's liquid amount. Proxy liquid is tracked for
  accounting but must not appear in rankings; always filter `isExcluded: false`.
- Missing transfer or stake history that would produce a negative balance stops
  indexing rather than publishing an invalid ranking. Do not move start blocks
  forward without a verified opening-balance migration.

Staking uses the verified ABI directly from `packages/chain/abis/staking.json`
and proxy `0x5ff7f9724fd477d9a07dcdb894d0ca7f8fae1501`. Event signatures are:

```text
Stake(indexed address,indexed address,uint256)
Unstake(indexed address,indexed address,uint256,uint256)
```

Both identify staker, token and amount. `Stake` increases `Holding.staked`;
`Unstake` decreases it immediately, without restoring liquid until an ERC-20
Transfer back to the wallet. Events for other tokens are ignored.
`staked` represents `getStakeDataLatest`'s **totalStake**, not `totalLocked`.
The [maintainer's accounting confirmation](https://github.com/GoHigherDev/ScoutReport/pull/26#issuecomment-6144403223)
states that `LockStake` / `LockReleased` only move amounts between unstakable and
locked within an existing stake: neither changes totalStake or Scout Rating.
They therefore have no balance-mutating handlers. `Claim` clears pending
unstake; pending/claimable are out of scope and are not added to staked.
The corresponding token Transfer updates liquid without double-counting Claim.

### S-01 RPC reconciliation

Stake/Unstake events expose the required fields, so no event-field gap remains
for this MVP. Event-derived balances are not a substitute for reconciling
residual drift, historical ABI changes or future proxy upgrades. S-01 should
compare each wallet/token's indexed liquid with ERC-20 `balanceOf`, and indexed
staked with `getStakeDataLatest(wallet, token, false).totalStake` at a consistent
indexed block. Do not add locked, pending or claimable values again.

Reuse SR-11's `readStakeDataLatest` in `packages/chain/src/staking.ts`.
`getStakeDataLatest` is **nonpayable**, but must be simulated using `eth_call`
(`simulateContract`), never sent as a transaction: it refreshes accounting only
within the simulation. For a block-pinned reconciliation, pass the same
`blockNumber` to both RPC reads; the existing convenience helper reads latest.
Document/disclose differences in S-01's reconciled read layer; an RPC caller
cannot directly edit this subgraph's entities. Re-verify the ABI and event
semantics on proxy upgrades. No reconciliation service is implemented in SR-15.

## Networks and start-block evidence

`networks.json` uses Graph CLI's network configuration format; its Mainnet
addresses/start blocks match `subgraph.yaml`. The provenance below was supplied
by the maintainer on **13 October 2026** in
[PR #26](https://github.com/GoHigherDev/ScoutReport/pull/26#issuecomment-6144403223).
Explorer DNS blocked an independent sandbox re-fetch; these are supplied verified
first-event results, not guessed blocks or the earlier contract creation blocks.

| Data source                                          | First indexed event / startBlock | First-event transaction                                                                                                                                                                                                         | Earlier creation block                                                                                    |
| ---------------------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| NAVI `0x02728748392F1875682940681F4C936Fc683A68e`    | Transfer / **31150409**          | [Chiliz explorer](https://scan.chiliz.com/tx/0xe1640ca2df265b0591d39f3f1ce51a60cb9a649b8a77f1d11a148c3c87e2926f), [Routescan](https://88888.routescan.io/tx/0xe1640ca2df265b0591d39f3f1ce51a60cb9a649b8a77f1d11a148c3c87e2926f) | [30918299](https://scan.chiliz.com/tx/0x96996ae4f599c8dcaa7d7b7acbd00fa9fc91c7de9570932f78b631cbbc455407) |
| AFC `0x76088F3eD5dC655De9295D93868ec1EeC654A615`     | Transfer / **32619372**          | [Chiliz explorer](https://scan.chiliz.com/tx/0xf6b85bf0cfac6bb0a6132f10f6f8af0e52e3e507a39290d7be03c1fd952016eb), [Routescan](https://88888.routescan.io/tx/0xf6b85bf0cfac6bb0a6132f10f6f8af0e52e3e507a39290d7be03c1fd952016eb) | [32559729](https://scan.chiliz.com/tx/0x1dc84ebf70aee26d79ed5f9a0870524830abdee3af4755b9a1a911882255f6cd) |
| Staking `0x5ff7f9724fd477d9a07dcdb894d0ca7f8fae1501` | Stake / **20901330**             | [Chiliz explorer](https://scan.chiliz.com/tx/0xe8f82ce6dd6e2a9898e60c9094116c694dec3b60bd1c0153b86d1db2923fa45b), [Routescan](https://88888.routescan.io/tx/0xe8f82ce6dd6e2a9898e60c9094116c694dec3b60bd1c0153b86d1db2923fa45b) | [20248272](https://scan.chiliz.com/tx/0x97998b862ce3f871e5bd02f2ba99b76aeb5bcc0f698b31c23b0b5739a07d2e44) |

Method: query the
[Routescan etherscan-compatible API](https://api.routescan.io/v2/network/mainnet/evm/88888/etherscan/api)
with `module=logs`, `action=getLogs`, `fromBlock=0`, `toBlock=latest`,
the configured `address`, and `topic0 = keccak256("Transfer(address,address,uint256)")`
or `keccak256("Stake(address,address,uint256)")`. Check ascending block/log order,
paginate or narrow block ranges as needed, verify there are no earlier matching
logs, and cross-check the first result's transaction receipt/explorer block.
The first Unstake (20905288) and LockStake (22054953) are later than the first
Stake, so the staking start covers them too.

`subgraph.testnet.yaml` is an intentionally inert `chiliz-testnet` manifest
variant, not a working Fan Token/staking index. No verified NAVI/AFC Spicy
addresses exist in config, and SR-11 found no staking deployment at the Mainnet
proxy address on Spicy. Hence `networks.json`'s `chiliz-testnet` entry is empty;
its no-op scaffold starts at genesis (0), not an invented deployment block.
Do not apply `--network chiliz-testnet` to the Mainnet manifest: switching a
network alone would leave Mainnet addresses in place. Use the separate variant.
Live Spicy token/staking validation is not applicable until verified deployments
are configured; both manifests compile and mappings are exercised offline.

## Build and tests

From the repository root:

```sh
pnpm install --frozen-lockfile
pnpm --filter @scoutreport/subgraph lint
pnpm --filter @scoutreport/subgraph typecheck
pnpm --filter @scoutreport/subgraph test
pnpm --filter @scoutreport/subgraph build
```

Typecheck compiles both Mainnet and testnet WASM. Matchstick 0.6.0 runs on
supported Ubuntu 22/24 or macOS hosts and downloads its pinned binary on first
use; tests mock events and metadata calls, require no live RPC and no secrets.
Coverage includes template creation, mint/burn, self-transfers, BigInt precision,
token separation, acquisition timestamps, staking/cooldown transfers, exclusions,
unsupported tokens, metadata failures and incomplete-history failures.

With Foundry installed, the full required local check is
`pnpm turbo run lint typecheck test`; CI's `web+packages` also runs `build`.
Required check names remain `web+packages`, `contracts`, `subgraph`, `secret-scan`.
The dedicated subgraph job runs lint, both manifest builds and Matchstick.

## Deployment (SR-16)

No environment variables or credentials are needed for codegen/build/tests.
Deploy only from a trusted operator machine. Use locally selected
`SUBGRAPH_NAME`, `VERSION` (and `SUBGRAPH_SLUG` for Studio); these are deployment
identifiers, not approved user-facing product names. Store provider credentials
outside the repository, never in a manifest, command committed with a real key,
or CI log. A hosted indexer's RPC configuration must provide Mainnet archive
state for metadata calls at historical blocks; no RPC key belongs in this package.

Goldsky: install its CLI using the provider's documentation, authenticate
interactively, then deploy the compiled **Mainnet** output:

```sh
cd packages/subgraph
pnpm build
goldsky login
goldsky subgraph deploy "$SUBGRAPH_NAME/$VERSION" --path ./build
```

The Graph Studio alternative: first confirm Studio supports `chiliz` for the
target deployment (do not substitute an Ethereum network). Create the subgraph
in Studio and authenticate with its locally supplied deploy key:

```sh
cd packages/subgraph
pnpm build
pnpm exec graph auth
pnpm exec graph deploy "$SUBGRAPH_SLUG" \
  --node https://api.studio.thegraph.com/deploy/ --version-label "$VERSION"
```

Do not enable shell tracing or share the real deploy key. No live deploy is part
of SR-15. Wait for full sync and check `_meta.hasIndexingErrors` before exposing
rankings; an incomplete index is not an authoritative leaderboard.

## Sample GraphQL

Query the provider-issued endpoint after deployment; none is invented here.
All token/account IDs and query variables must be lower-case addresses.
Results are raw-unit strings. Rankings are per token, not across tokens with
different decimals.

Top 100 for NAVI (replace the token ID with
`0x76088f3ed5dc655de9295d93868ec1eec654a615` for AFC):

```graphql
query Top100 {
  holdings(
    first: 100
    orderBy: scoutRating
    orderDirection: desc
    where: {
      token: "0x02728748392f1875682940681f4c936fc683a68e" # gitleaks:allow
      isExcluded: false
      scoutRating_gt: "0"
    }
  ) {
    account {
      id
    }
    token {
      id
      symbol
      decimals
    }
    liquid
    staked
    scoutRating
    firstAcquiredAt
    updatedAt
  }
  _meta {
    block {
      number
    }
    hasIndexingErrors
  }
}
```

Single-wallet holdings; supply `wallet` as the wallet's lower-case address in
your GraphQL client's variables (no example wallet is invented):

```graphql
query WalletHoldings($wallet: ID!) {
  account(id: $wallet) {
    id
    holdings {
      token {
        id
        symbol
        decimals
      }
      liquid
      staked
      scoutRating
      firstAcquiredAt
      updatedAt
      isExcluded
    }
  }
}
```

An account without indexed activity returns null. A wallet that only has pending
unstake does not gain Scout Rating from that pending amount.

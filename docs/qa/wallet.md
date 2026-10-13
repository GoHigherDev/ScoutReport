# SR-12 wallet QA

Set `NEXT_PUBLIC_REOWN_PROJECT_ID` in the ignored `apps/web/.env.local` to
your Reown project ID and allow the app origin in the Reown dashboard. Never
commit the ID. Restart the dev server after changing public environment values.
APP_CHAIN defaults to Spicy (88882); DATA_CHAIN must remain Mainnet (88888).
No SIWE, typed-data signing, transactions or Partner API calls are part of
this shell.

## Manual matrix

| Scenario             | Steps                                                                              | Expected                                                                                                                                         |
| -------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| No project ID        | Leave the ID empty; build and visit the app                                        | Page renders, connect is disabled with a configuration notice; no wallet/holdings RPC reads                                                      |
| MetaMask desktop     | Choose the injected MetaMask wallet; approve connection                            | Truncated address `0x1234…abcd`, disconnect button and current network badge                                                                     |
| WalletConnect QR     | Open Connect wallet; scan QR in a compatible mobile wallet and approve             | Same connected header and holdings as injected connection                                                                                        |
| Socios Wallet mobile | Check recommended wallets; choose Socios.com Wallet and approve on mobile          | Socios.com Wallet is featured; connection succeeds without requesting typed-data signatures                                                      |
| Reject connect       | Reject MetaMask request, reject mobile request or close modal                      | Remains disconnected; no holdings shown and connection can be retried                                                                            |
| Switch network       | Connect on Mainnet or another network with APP_CHAIN=88882; select Switch to Spicy | Approval changes to Spicy; amber chip and banner disappears; holdings still read Mainnet                                                         |
| Reject switch        | Reject the switch request                                                          | Banner remains with a retryable rejection message                                                                                                |
| Add network          | Connect using a wallet without Spicy configured and select Switch to Spicy         | `ensureChain` asks to add the verified chain then switches after approval                                                                        |
| Mainnet APP_CHAIN    | Set NEXT_PUBLIC_APP_CHAIN_ID=88888, restart and connect on Spicy                   | Switch to Mainnet offered; Mainnet uses an accent chip with dark text                                                                            |
| Positive holdings    | Connect a wallet holding or staking configured Fan Tokens                          | Only non-zero tokens appear; on-chain symbol, Held, Staked and Scout Rating are shown; rating = held + staked, formatted using on-chain decimals |
| Empty holdings       | Connect a wallet with no configured tokens held or staked                          | Explicit Mainnet empty state, not a blank strip                                                                                                  |
| Loading / RPC error  | Throttle then block public Mainnet RPC endpoints in browser developer tools        | Skeleton while loading; RPC-error state, not fabricated zeros; Try again recovers after restoring RPC                                            |
| Account change       | Change the selected account while reads are pending or complete                    | Previous account's holdings disappear; only the new account's results appear                                                                     |
| Disconnect           | Select Disconnect or disconnect from the mobile wallet                             | Address and holdings disappear immediately; no further holdings reads                                                                            |
| Contract account     | Use an account with code on Mainnet; inspect `useWalletKind()`                     | `kind=contract`, `isContractAccount=true`; no claim it is Socios Wallet                                                                          |
| EOA / code RPC error | Use an EOA, then block its getCode read                                            | EOA gives `kind=eoa`; failed read leaves kind unknown rather than asserting EOA                                                                  |

In developer tools, confirm Mainnet holdings calls use Multicall3 `eth_call`
batches across the configured list, rather than a staking RPC per token.
Metadata reads are cached by chain/address. Staking refreshes are simulated
inside multicalls; no state is persisted and no transaction approval is asked.
The strip explains that staked amounts are not Reward Points and
external-wallet staking does not earn Socios Reward Points.

The featured wallet ID is sourced in
`apps/web/src/wallet/config.ts` from the Socios/Chiliz prerequisites documentation
(retrieved 13 October 2026), not inferred from account code.
Unit tests mock wagmi and the RPC client and need neither a live network nor
a real project ID. Real-wallet/mobile checks require a configured Reown project
and a tester's wallet; do not record credentials or private keys in QA evidence.

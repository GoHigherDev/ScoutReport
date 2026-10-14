# ADR 0002: Gas sponsorship

- Ticket: SR-18 / F-13
- Status: Accepted for the MVP; sponsorship and account abstraction are **LATER**
- Date: 14 October 2026

## Decision

The MVP has no paymaster, gas sponsorship or account-abstraction integration.
Wallets pay native CHZ gas for writes on APP_CHAIN. Before a write, the client
checks the connected wallet's network, reads its CHZ balance and estimates gas
and fees. Insufficient balance blocks submission with neutral guidance.
SIWE sign-in uses a message signature: it does not cost gas or move funds.
Staking and unstaking transactions are outside this decision's scope.

On Spicy, guidance links only to the verified Spicy and Tatum testnet faucets
configured in `apps/web/src/copy/names.ts`. On Mainnet, it explains that a small
amount of CHZ is needed for gas, without exchange, purchase or swap links.
There is no promise of rewards.

## Consequences

The guard is an estimate, not a guarantee: balances, network fees and contract
state can change, and the wallet may adjust fees before signing. Wallets remain
responsible for transaction approval. Known ABI custom errors use reviewed
copy; unknown errors never expose provider messages, revert data or stacks.
There is no new server endpoint or sponsored service to abuse.

## Revisit later

Before proposing a paymaster or account abstraction, re-check **current**
Chiliz account-abstraction and Biconomy guidance, supported networks and
wallet compatibility. This ticket does not verify that guidance or claim
present support. Assess funding, abuse controls, spending caps, monitoring
and failure behaviour before approving any sponsorship.

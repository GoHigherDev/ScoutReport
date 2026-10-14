# SIWE authentication (SR-14 / F-09)

ScoutReport is an independent third-party dapp, not affiliated with Socios.
Authentication signs an EIP-4361 plain-text message using `personal_sign`.
It requires no gas, transactions, EIP-712 signing or server-held private keys.
The wallet modal remains Socios.com Wallet only; verification also accepts EOAs.

## Configuration

- Set `NEXT_PUBLIC_SITE_URL` to the actual trusted deployment origin, including
  the port when applicable. It is required, must be HTTPS in production and
  must not contain a path, query, credentials or fragment. SIWE domain and URI
  are checked against this configured origin, never forwarded host headers.
- Set `SESSION_SECRET` server-side to a maintainer-generated secret of at least
  32 characters. Missing or shorter values fail closed before nonce DB work.
  Use separate secrets per environment. Never commit or expose this value.
- Use the existing `DATABASE_URL` and migrations; `siwe_nonces` needs no schema
  change. RPCs use `getPublicClient` from `packages/chain` and its existing
  server-side `RPC_URL_MAINNET`, fallback and `RPC_URL_SPICY` configuration.
- As for other auth/write routes, production remains disabled until deployment
  wiring supplies **both** a shared `RateLimiter` and trusted `rateLimitKey` to
  `createAuthRoutes` in `apps/web/src/server/auth.ts`. The default route exports
  intentionally fail closed in production. Never use untrusted forwarded-IP
  headers as the identity source. The existing development limiter is not a
  production substitute.

Secure cookies are always enabled, including development; use a browser's
trusted localhost environment or local HTTPS. Every auth response is `no-store`.

## Flow

1. `GET /api/auth/nonce` goes through the rate-limited `handler`, generates a
   cryptographically random nonce and stores it with a ten-minute expiry.
   It returns `{ nonce, expiresAt }` and binds the nonce to an encrypted,
   httpOnly browser cookie. The nonce alone is not an authenticated session.
   Each new challenge replaces that browser's outstanding challenge.
2. Call `signIn()` from `apps/web/src/wallet/sign-in.ts` with a connected wallet.
   It builds the domain, origin URI, address, version `1`, DATA_CHAIN chain ID,
   nonce, issued-at and server-provided expiry. The copy comes from
   `NAMES.auth.statement` in `apps/web/src/copy/names.ts`, exactly:

   > Sign in to ScoutReport. This does not cost gas or move funds.

   wagmi's `signMessage` requests `personal_sign`. The helper neither switches
   APP_CHAIN nor sends a transaction. It adds no sign-in button or claim UI.

3. `POST /api/auth/verify` accepts `{ message, signature }`. The limiter runs
   first; the body is bounded to 16 KiB, with smaller field limits. Malformed
   bodies and invalid message fields are rejected before DB or RPC work.
   Same-origin POSTs and the issuing browser cookie are required. Domain, URI,
   version, statement, chain, nonce, issued-at, expiry and not-before are checked.
   Only chain IDs **88888** and **88882** are accepted.
4. Verification uses the public client for the **message's chain**, not APP_CHAIN.
   Account code is read and viem's `verifySiweMessage` validates EOA signatures
   by recovery and smart-account signatures via ERC-1271. viem also tolerates
   ERC-6492 wrappers through read-only simulation. No transaction is broadcast.
   Invalid signatures do not consume the nonce. Successful signatures consume
   it with a conditional DB update requiring an unused, unexpired row. Only
   one concurrent request can succeed, and expiry is rechecked at consumption.
5. The encrypted iron-session cookie stores `{ address, chainId, isContract,
issuedAt }` (issued-at is Unix milliseconds). It is httpOnly, Secure,
   SameSite=Lax, host-only, path `/`, with a seven-day expiry.
   Session and auth JSON addresses use the lowercase `toStoredAddress` form;
   checksum formatting belongs only at display edges.
   `isContract` records code presence or a counterfactual signature wrapper;
   it does not identify Socios Wallet or establish Reward Point eligibility.
6. `GET /api/auth/me` returns `{ session }`, with `null` when unauthenticated.
   Server callers use `getVerifiedSession(request)` from
   `apps/web/src/server/session.ts` and may pass its result to `requireAdmin`.
   Never construct an admin session from user-supplied JSON.
   `POST /api/auth/logout` requires the same origin and clears the cookie.

Socios Wallet is a smart account on Chiliz Mainnet. Its ERC-1271 signature must
be checked on **DATA_CHAIN 88888**, even while ScoutReport's **APP_CHAIN is Spicy
88882**. Mainnet is read-only. A client explicitly constructing a Spicy EOA
message is still accepted and verified on 88882.

Replay, missing, used or expired nonces and invalid messages return 401;
malformed bodies return 400, oversized bodies 413, and throttling 429.
Configuration/provider errors return a redacted 500. Signatures, messages,
nonces and session cookies are never logged.

## Retention and tests

Nonce issuance deletes rows whose expiry has passed, including consumed rows.
Expiry is enforced independently of cleanup. Without further issuance, expired
rows remain in the database: this is opportunistic disposal, not a scheduled
retention policy. F-12 still owns production retention and erasure.
Logout clears the browser cookie; stateless cookies cannot revoke an already
stolen copy before expiry. No profile or admin pages are added.

Run `pnpm turbo run lint typecheck test` with Foundry installed, as in CI.
Focused tests are in `apps/web/src/server/auth.test.ts`,
`apps/web/src/server/http.test.ts` and
`apps/web/src/wallet/sign-in.test.ts`. Web auth tests are self-contained: they
use a viem public client with a mocked RPC transport and nonce storage. EOA
signatures use real recovery; the mocked ERC-1271 owner check returns the magic
value only for valid owner signatures, including ERC-6492 wrappers. Signing
keys and the throwaway session secret are generated in memory per test run.
No hosted DB, live RPC, Anvil, Forge or compiler download is needed for
`pnpm --filter @scoutreport/web test`.

`packages/contracts/test/utils/MockERC1271.sol` and its Foundry tests remain
validated by the GitHub `contracts` CI job. That job passed on head `87215bf`;
local Solidity compiler download access is not a prerequisite for web auth
validation. Full workspace validation still includes Foundry, as configured
in CI.

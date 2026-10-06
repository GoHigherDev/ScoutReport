# Instructions for GitHub Copilot (coding agent and chat)

- This repo is ScoutReport, a third-party dapp on Chiliz Chain (Mainnet 88888, Spicy testnet 88882). It is not affiliated with Socios.
- Each task comes from a Jira ticket in project SR. Its GitHub issue title starts with the Jira key (e.g. `SR-2`). Always start your pull request title with that same key, and mention it in commit messages.
- Do exactly what the ticket's prompt and acceptance criteria say. Keep to its scope; later tickets cover the rest.
- Use en-GB spelling in UI copy, comments and docs.
- Never invent contract or token addresses, API keys, endpoint responses or Reward Point figures. Never commit secrets.
- User-facing product names that are not yet approved stay as [BRACKETED] placeholders read from a copy/config file. Do not invent names.
- If anything is unclear or blocked (missing access, an ambiguous requirement, a decision only the product owner can make), ask in a comment on your pull request starting with `QUESTION:` and explain what you need. Do not guess on product decisions.
- Before finishing, make sure lint, typecheck and tests pass.

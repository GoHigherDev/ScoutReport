## Summary

Jira ticket: SR-<!-- number --> (start the PR title with this key)

## Validation

- [ ] CI checks are green: web+packages, contracts, subgraph and secret-scan.
- [ ] UI copy, comments and documentation use en-GB spelling.
- [ ] No secrets, API keys or private keys are included.
- [ ] Fan Token `decimals()` is read on-chain; decimals are not hardcoded.
- [ ] Chain-facing changes have been tested on Spicy before Mainnet (or are not applicable).

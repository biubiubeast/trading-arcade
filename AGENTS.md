# Self-hosted deployment contract

- `main` is the source for the self-hosted `/tradegames/` deployment. `ubuntu/deploy.sh` verifies and publishes static files.
- `dist/` is authored static source. Keep entry assets relative so root previews and subpath hosting both work. Preserve fragment routing, share links, storage keys and import/export rules.
- Run `node --test tests/*.test.js` and `node scripts/check.mjs` for production behavior changes. No npm dependencies or compilation are needed.
- Serve only each release's `site/` directory; never expose the repository root or runtime configuration.
- Runtime hostnames, account names, directories and credentials belong in environment variables and configuration outside Git. Public documentation must use generic examples.
- Preserve existing release archives. Follow `docs/GOVERNANCE.md` and distinguish inherited reports from new test evidence.
- Preserve the original Sites identity and audience; self-hosted deployment does not authorize publishing changes to Sites.
- Preserve unrelated reverse-proxy routes and applications.

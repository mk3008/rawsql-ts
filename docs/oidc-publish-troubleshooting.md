# OIDC npm publishing troubleshooting

This repo publishes packages to npm using GitHub Actions OIDC (npm Trusted Publishing).
When publishing fails, the most important clue is **which authentication path npm actually used**.

`scripts/ci-publish.mjs` prints:
- GitHub context (`GITHUB_*`) and OIDC availability (`ACTIONS_ID_TOKEN_REQUEST_*`)
- A small, safe subset of OIDC token **claims** (not the token)
- Minimal npm auth diagnostics (`npm whoami`, `npm config get userconfig`, etc.)
- On OIDC auth-related failures, a small `npm view` summary (latest version + dist-tags) to confirm the package exists on the public registry

## Common failure modes

### `ENEEDAUTH` in OIDC mode

Symptoms:
- `npm publish ... --provenance` fails with `ENEEDAUTH` / `need auth`
- OIDC variables are set and the workflow is running from `refs/heads/main`

Most likely causes:
- npm **Trusted Publishers is not configured** for this package and this workflow file in this repository, or the configuration doesn't match the workflow/ref used for the run.
- The package name / scope in npm Trusted Publishers doesn't match the package being published.

What to do:
- Check the OIDC claim logs in the workflow output (issuer, audience, subject, repository, ref, workflow).
- Check `npm view diagnostics` in the logs. If `npm view` succeeds but `npm publish` fails with `ENEEDAUTH`, it strongly suggests a Trusted Publisher configuration mismatch rather than a missing package.
- Update npm Trusted Publishers configuration to match the workflow context.

### Token fallback fails with "Access token expired or revoked"

Symptoms:
- A retry using token auth fails with messages like `Access token expired or revoked`
- npm reports `E404` / not found or permission errors right after that message

Most likely causes:
- The npm token stored in secrets is expired/revoked (classic tokens may be revoked; rotate to a valid token).
- The token does not have publish permissions for the package.

What to do:
- Rotate the token secret and ensure it has publish access to the package.
- Prefer fixing OIDC Trusted Publishing instead of relying on long-lived tokens.

## Notes

- `publish.yml` is intended to run from the default branch (`main`). Running from feature branches can cause OIDC Trusted Publishing to fail depending on npm configuration.

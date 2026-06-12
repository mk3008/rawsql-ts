# OIDC npm publishing troubleshooting

This repo publishes packages to npm using GitHub Actions OIDC (npm Trusted Publishing).
When publishing fails, the most important clue is **which authentication path npm actually used**.
The same publish workflow also applies npm deprecation messages for versions whose package metadata declares a `rawsqlTs.deprecationMessage`.

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

### `TLOG_CREATE_ENTRY_ERROR` / "equivalent entry already exists in the transparency log"

Symptoms:
- `npm publish ... --provenance` fails with `TLOG_CREATE_ENTRY_ERROR`
- npm reports `error creating tlog entry`
- npm reports `(409) an equivalent entry already exists in the transparency log`

Most likely causes:
- npm provenance / Sigstore transparency-log state already contains an equivalent attestation for the attempted package artifact.
- A previous publish attempt may have failed after creating provenance-related transparency-log state, leaving the package version absent from the registry while the transparency-log entry still blocks an identical retry.
- This is not the same failure class as a missing npm Trusted Publisher configuration.

What to do:
- Check the workflow's `npm view diagnostics` for the target package version.
- If the target package version is visible on npm, treat the publish as already completed and do not republish that version.
- If the target package version is not visible on npm, prefer bumping the package version and rerunning the publish workflow.
- Do not repeatedly retry the same version with the same provenance artifact; it can hit the same transparency-log duplicate.
- Use token/no-provenance publish only as an explicit emergency release decision, because it changes the release's provenance guarantees.

## Notes

- `publish.yml` is intended to run from the default branch (`main`). Running from feature branches can cause OIDC Trusted Publishing to fail depending on npm configuration.
- Version-specific npm deprecations are applied after publish during the same workflow run. If deprecation fails, treat it as a publish-operations issue rather than a docs-only issue.

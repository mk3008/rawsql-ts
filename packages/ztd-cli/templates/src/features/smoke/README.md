# Smoke Feature

`smoke` is the smallest removable teaching feature in the scaffold.
It lives at `src/features/smoke` and shows how a real feature should be laid out.

Use it as a pattern for the next real feature:

- start from the `domain` rule
- wire the `application` flow
- keep the `persistence` unit small and local
- place the feature tests next to the feature

Once the project has a real feature of its own, `smoke` can be deleted without extra shared cleanup.

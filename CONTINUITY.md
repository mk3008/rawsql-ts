Goal (including success criteria):
- Align `packages/sql-contract/README.md` with the PR feedback by removing the unused `entity` declaration from the Minimal CRUD sample so readers see only the APIs actually used.
- Success: the Minimal CRUD sample imports only the mapper helper and writer helpers that appear in the snippet, the SELECT block uses `createMapperFromExecutor` without the stray `entity`, and the documentation matches the existing implementation.

Constraints / Assumptions:
- Replies must remain in Japanese; documentation and code comments must stay English.
- README edits should not touch other packages or files beyond what the feedback requests.

Key decisions:
- Drop the unused `entity` import/declaration and keep the sample focused on executor-based mapper usage plus writer helpers.
- Keep the sample concise so it demonstrates connecting a mapper to an executor without extra model wiring that the reader might misinterpret as required.

State:
- Returning option in the writer remains implemented and documented; README now reflects that (historical work preserved).
- Minimal CRUD sample imports only `createMapperFromExecutor`, `simpleMapPresets`, and the writer helpers; no unused entities remain.

Done:
- Removed the unused entity declaration from `packages/sql-contract/README.md`.
- Updated the Minimal CRUD example so only the shown APIs are imported and exercised.

Now:
- README minimal sample mirrors the actual mapper and writer usage without stray declarations.

Next:
- Await confirmation or additional review guidance before concluding the PR.

Open questions (mark as UNCONFIRMED if needed):
- None.

Working set (files, ids, commands):
```
CONTINUITY.md
packages/sql-contract/README.md
```

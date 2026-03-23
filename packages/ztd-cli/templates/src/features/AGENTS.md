# Package Scope
- Applies to `packages/ztd-cli/templates/src/features`.
- Defines the feature-first scaffold guidance used by generated projects.

# Policy
## REQUIRED
- Feature folders MUST be the default change unit.
- Feature-local tests, SQL, and specs MUST stay close to the feature they support.
- `smoke` MUST stay as the removable starter sample when the starter flow is generated.
- `users` SHOULD be the first tutorial feature that follows `smoke`.
- Role names SHOULD stay short and practical: `domain`, `application`, `persistence`, and `tests`.
- Feature-specific explanations SHOULD live in feature-local `README.md` files.
- Important SQL authoring conventions SHOULD be demonstrated through template SQL, sample specs, and tests.

## PROHIBITED
- Reintroducing layered top-level folders as the default teaching surface.
- Treating `src/catalog` as the user-facing standard place for handwritten contracts.
- Adding `AGENTS.md` files under individual features as the default VSA teaching path.

# Mandatory Workflow
- Keep the generated scaffold understandable without reading repo internals first.

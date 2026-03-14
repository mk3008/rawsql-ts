# Package Scope
- Applies to `packages/ztd-cli/templates/src/presentation/http`.
- Defines HTTP-specific transport behavior for WebAPI-oriented scaffolds.

# Policy
## REQUIRED
- HTTP adapters MUST translate transport concerns into application-layer inputs and outputs.
- Handler code MUST keep status codes, headers, and serialization explicit.

## PROHIBITED
- Direct SQL execution.
- Embedding persistence-specific retries or ZTD workflow rules in handlers.

# Mandatory Workflow
- HTTP adapter changes MUST run transport-focused tests.

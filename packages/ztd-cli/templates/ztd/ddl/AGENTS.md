# Package Scope
- Applies to `packages/ztd-cli/templates/ztd/ddl`.
- Defines contract rules for human-owned physical schema definitions.

# Policy
## REQUIRED
- DDL semantics MUST remain human-owned.
- Table and column comments MUST be included for important schema elements.
- DDL naming and file organization MUST stay consistent within the selected strategy.

## ALLOWED
- AI MAY assist with mechanical DDL edits when explicitly requested.
- Foreign keys MAY be used when intentional and documented.

## PROHIBITED
- Inventing domain rules without explicit instruction.
- Inconsistent schema splitting strategy within this subtree.

# Mandatory Workflow
- DDL changes MUST preserve comment statements and naming conventions.

# Hygiene
- Maintain explicit NOT NULL and unique constraints where contract semantics require them.

# References
- Parent ZTD policy: [../AGENTS.md](../AGENTS.md)

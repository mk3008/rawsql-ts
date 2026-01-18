# ZTD Definitions

This directory hosts the schema definitions (`ztd/ddl/`) that feed native ZTD workflows, while `ztd/domain-specs/` and `ztd/enums/` are optional documentation spaces used when humans maintain behavioral or vocabulary notes.

## DDL Definitions

The ztd/ddl/ directory stores **Data Definition Language (DDL)** files that describe the database schema. These files include CREATE TABLE, ALTER TABLE, index declarations, and constraint definitions. ZTD treats the SQL files here as the single source of truth for schemas, so both humans and AI must reference this directory when evolving the structure.

### Allowed Content and Structure

- **Schema Definition Files:** Core table structures live in ztd/ddl/ using CREATE TABLE statements, but you may also add related DDL such as ALTER TABLE commands or explicit index declarations that contribute to the schema contract.
- **Semantic Flexibility:** The directory supports multiple ways to describe schema changes (e.g., altering tables inline or via subsequent ALTER TABLE statements). The key is clarity and correctness so the CLI tooling can interpret the intended shape.

### File Format and Execution

- **Executable SQL Scripts:** Every file should be valid PostgreSQL with semicolon-terminated statements and a consistent dependency ordering.
- **Integration with ZTD CLI:** The CLI parses these files to understand schema shapes. Treat this directory as authoritative: every schema change should be captured here as if it were applied to a clean database.

### Maintenance Guidelines

- **Human-Maintained Schema:** Developers own the schema structure; AI tooling may only assist with targeted edits.
- **Conventions:** Follow the established naming, formatting, and typing patterns. Include comments to explain non-obvious schema choices.

### Relationships

- Optional documentation under `/ztd/domain-specs` and `/ztd/enums` explains behavior or vocabulary when humans choose to include it, but the DDL remains authoritative.

## Domain Specifications

The ztd/domain-specs/ directory optionally documents key domain behaviors as human-readable specifications.
If the directory does not exist, treat the DDL definitions as the canonical behavior and refer to these specs only when humans have provided them.

### Purpose

Each Markdown file describes one business concept, explains it in natural language, and pairs it with an example SELECT query inside a fenced SQL block. These specifications help AI agents understand **what** the domain logic should do without prescribing implementation details.

### Format and Best Practices

- One file per concept with a prose explanation followed by an example SELECT.
- Keep exactly one executable SQL block per file (one file = one behavior).
- Named parameters (e.g., :as_of) signal intent; you may translate them into positional placeholders when generating code.
- Focus on semantics—use Markdown structuring (tables, bullets, etc.) to clarify the behavior.
- Always update the description before touching the SQL when the behavior evolves.

### Relationships

- /ztd/ddl: Supplies the physical schema that backs the behavior.
- /ztd/enums: Provides the vocabularies referenced in the domain logic.

## Domain Enums

The ztd/enums/ directory optionally contains enumerated value sets such as statuses, tiers, or lifecycle states for documentation purposes.
If the folder is missing, rely on the DDL and fixtures for enumeration knowledge; treat these files as optional, explanatory references when they exist.

### Purpose

These enums are human-maintained and support:

- AI-assisted SQL/code generation
- TypeScript constant generation
- Schema enforcement (e.g., CHECK constraints)
- Frontend label rendering via display names

### Format and Structure

- The folder uses Markdown to keep the definitions readable.
- Each enum is documented in a single file using SELECT ... FROM (VALUES ...) blocks with explicit column aliases.

### Required Structure

- Each row must include at least key and value columns.
- Optional metadata like display_name, 
ranking, or sort_order may be added for UI/logic purposes.

### Guidelines

- Keep naming conventions consistent and avoid duplicate value identifiers across unrelated enums.
- When optional reference notes exist, ensure they stay compatible with `/ztd/ddl` as enums evolve.
- Preserve human-readable display_name values as needed for front-end contexts.

### Relationships

- /ztd/ddl: Referenced by constraints or lookup tables.
- /ztd/domain-specs (when present): Provides the vocabulary for behavioral rules.
- src/: Maps enums to generated constants or query logic.

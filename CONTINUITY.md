Goal (incl. success criteria):
- Fix issue #330 so SQL parser accepts CREATE/DROP SCHEMA statements
- Ensure coverage via parser tests for relevant variants

Constraints/Assumptions:
- Working branch 330-sqlparser-does-not-support-create-schema-drop-schema-statements is active
- Responses must be in Japanese, docs/comments in English

Key decisions:
- Extend parser to recognize SCHEMA DDL statements and add tokenizer support if needed
- Document progress in ledger and produce Japanese summary report + changelog-style message

State:
- Now: schema DDL support implemented, tests added, preparing final summary/diff/changelog
- Done:
  - Recorded issue expectations and planned parser/tokenizer adjustments
  - Added schema AST/parsers/token reader/formatting updates and regression tests
  - Ran `pnpm --filter rawsql-ts test -- tests/parsers/DDLParsers.test.ts tests/parsers/SqlParser.test.ts`
- Next: finalize documentation, diff review, and release note/commit messaging

Open questions (UNCONFIRMED if needed):
- None

Working set (files/ids/commands):
- CONTINUITY.md
- packages/core/src/parsers/CreateSchemaParser.ts
- packages/core/src/parsers/DropSchemaParser.ts
- packages/core/src/parsers/SqlParser.ts
- packages/core/src/models/DDLStatements.ts
- packages/core/src/parsers/SqlPrintTokenParser.ts
- packages/core/src/models/SqlPrintToken.ts
- packages/core/src/tokenReaders/CommandTokenReader.ts
- packages/core/tests/parsers/DDLParsers.test.ts
- packages/core/tests/parsers/SqlParser.test.ts
- git status -sb
- issue #330 description (turn0view0)
- pnpm --filter rawsql-ts test -- tests/parsers/DDLParsers.test.ts tests/parsers/SqlParser.test.ts

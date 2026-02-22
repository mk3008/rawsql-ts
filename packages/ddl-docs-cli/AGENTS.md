# ddl-docs-cli Package Notes

- This package is a development CLI tool and is not intended for runtime use from application `src/` code.
- Keep SQL parsing AST-first via `rawsql-ts`; only use regex for guarded fallback cases that AST does not support.
- Keep dependencies minimal.

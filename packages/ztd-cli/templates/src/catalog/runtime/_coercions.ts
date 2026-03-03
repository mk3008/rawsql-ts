// Runtime coercions run BEFORE validator schemas.
// See docs/recipes/mapping-vs-validation.md for pipeline details.
export { timestampFromDriver as normalizeTimestamp } from '@rawsql-ts/sql-contract';

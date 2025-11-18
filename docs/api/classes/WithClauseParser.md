<div v-pre>
# Class: WithClauseParser

Defined in: [packages/core/src/parsers/WithClauseParser.ts:22](https://github.com/mk3008/rawsql-ts/blob/20e77930050634d1683aacac0cbdcebfe1978871/packages/core/src/parsers/WithClauseParser.ts#L22)

Parser for SQL WITH clauses (Common Table Expressions - CTEs).
Parses only the WITH clause portion of SQL, not the entire query.

**Note**: For most use cases, use `SelectQueryParser` which provides more comprehensive SQL parsing.
This parser should only be used for the special case where you need to analyze only the WITH clause portion.

## Example

```typescript
// Parses only the WITH clause, not the following SELECT
const sql = "WITH recursive_cte AS (SELECT 1 as n UNION SELECT n+1 FROM recursive_cte WHERE n < 10)";
const withClause = WithClauseParser.parse(sql);
console.log(withClause.recursive); // true
console.log(withClause.tables.length); // 1
```

## Constructors

### Constructor

> **new WithClauseParser**(): `WithClauseParser`

#### Returns

`WithClauseParser`

## Methods

### parse()

> `static` **parse**(`query`): `WithClause`

Defined in: [packages/core/src/parsers/WithClauseParser.ts:41](https://github.com/mk3008/rawsql-ts/blob/20e77930050634d1683aacac0cbdcebfe1978871/packages/core/src/parsers/WithClauseParser.ts#L41)

Parses a SQL string containing only a WITH clause into a WithClause AST.
The input should contain only the WITH clause, not the subsequent main query.

#### Parameters

##### query

`string`

The SQL string containing only the WITH clause

#### Returns

`WithClause`

The parsed WithClause object

#### Throws

Error if the syntax is invalid or there are unexpected tokens after the WITH clause

#### Example

```typescript
// Correct: Only the WITH clause
const sql = "WITH users_data AS (SELECT id, name FROM users)";
const withClause = WithClauseParser.parse(sql);

// Error: Contains SELECT after WITH clause
// const badSql = "WITH users_data AS (SELECT id, name FROM users) SELECT * FROM users_data";
```

***

### parseFromLexeme()

> `static` **parseFromLexeme**(`lexemes`, `index`): `object`

Defined in: [packages/core/src/parsers/WithClauseParser.ts:73](https://github.com/mk3008/rawsql-ts/blob/20e77930050634d1683aacac0cbdcebfe1978871/packages/core/src/parsers/WithClauseParser.ts#L73)

Parses a WITH clause from an array of lexemes starting at the specified index.

#### Parameters

##### lexemes

[`Lexeme`](../interfaces/Lexeme.md)[]

Array of lexemes to parse from

##### index

`number`

Starting index in the lexemes array

#### Returns

`object`

Object containing the parsed WithClause and the new index position

##### value

> **value**: `WithClause`

##### newIndex

> **newIndex**: `number`

##### headerComments

> **headerComments**: `null` \| `string`[]

#### Throws

Error if the syntax is invalid or WITH keyword is not found

#### Example

```typescript
const tokenizer = new SqlTokenizer("WITH cte AS (SELECT 1)");
const lexemes = tokenizer.readLexmes();
const result = WithClauseParser.parseFromLexeme(lexemes, 0);
console.log(result.value.tables.length); // 1
console.log(result.newIndex); // position after the WITH clause
```
</div>

<div v-pre>
# Class: CTERegionDetector

Defined in: [packages/core/src/utils/CTERegionDetector.ts:85](https://github.com/mk3008/rawsql-ts/blob/ba0d5a5f2250835b8b10e16a23b02b837e358b03/packages/core/src/utils/CTERegionDetector.ts#L85)

Utility class for detecting CTE (Common Table Expression) regions and extracting executable SQL.

Designed for SQL editor features where users want to execute specific CTE parts based on cursor position.
This enables editors to provide "run current section" functionality that intelligently executes
either the CTE the cursor is in, or the main query.

## Examples

```typescript
const sql = `
  WITH users_cte AS (
    SELECT id, name FROM users WHERE active = true
  )
  SELECT * FROM users_cte ORDER BY name
`;

const cursorPosition = 50; // Inside the CTE
const analysis = CTERegionDetector.analyzeCursorPosition(sql, cursorPosition);

if (analysis.isInCTE) {
  console.log(`Execute CTE: ${analysis.cteRegion.name}`);
  executeSQL(analysis.executableSQL); // Runs just the CTE SELECT
}
```

```typescript
const positions = CTERegionDetector.getCTEPositions(sql);
// Returns: [
//   { name: 'users_cte', startPosition: 17, type: 'CTE' },
//   { name: 'MAIN_QUERY', startPosition: 120, type: 'MAIN_QUERY' }
// ]
```

## Constructors

### Constructor

> **new CTERegionDetector**(): `CTERegionDetector`

#### Returns

`CTERegionDetector`

## Methods

### analyzeCursorPosition()

> `static` **analyzeCursorPosition**(`sql`, `cursorPosition`): [`CursorPositionInfo`](../interfaces/CursorPositionInfo.md)

Defined in: [packages/core/src/utils/CTERegionDetector.ts:110](https://github.com/mk3008/rawsql-ts/blob/ba0d5a5f2250835b8b10e16a23b02b837e358b03/packages/core/src/utils/CTERegionDetector.ts#L110)

Analyze cursor position and return information about the current context.

This is the main method for SQL editor integration. It determines whether the cursor
is inside a CTE or the main query, and provides the appropriate executable SQL.

#### Parameters

##### sql

`string`

The complete SQL string to analyze

##### cursorPosition

`number`

The cursor position (0-based character offset)

#### Returns

[`CursorPositionInfo`](../interfaces/CursorPositionInfo.md)

Analysis result containing context information and executable SQL

#### Example

```typescript
const sql = `WITH users AS (SELECT * FROM table) SELECT * FROM users`;
const analysis = CTERegionDetector.analyzeCursorPosition(sql, 25);

if (analysis.isInCTE) {
  console.log(`Cursor is in CTE: ${analysis.cteRegion.name}`);
  executeSQL(analysis.executableSQL); // Execute just the CTE
} else {
  console.log('Cursor is in main query');
  executeSQL(analysis.executableSQL); // Execute the full query
}
```

***

### getCursorCte()

> `static` **getCursorCte**(`sql`, `cursorPosition`): `null` \| `string`

Defined in: [packages/core/src/utils/CTERegionDetector.ts:158](https://github.com/mk3008/rawsql-ts/blob/ba0d5a5f2250835b8b10e16a23b02b837e358b03/packages/core/src/utils/CTERegionDetector.ts#L158)

Get the CTE name at the specified cursor position (simplified interface).

This method provides a simple interface for retrieving just the CTE name
without additional context information.

#### Parameters

##### sql

`string`

The SQL string to analyze

##### cursorPosition

`number`

The cursor position (0-based character offset)

#### Returns

`null` \| `string`

The CTE name if cursor is in a CTE, null otherwise

#### Example

```typescript
const sql = `WITH users AS (SELECT * FROM table) SELECT * FROM users`;
const cteName = CTERegionDetector.getCursorCte(sql, 25);
console.log(cteName); // "users"
```

***

### getCursorCteAt()

> `static` **getCursorCteAt**(`sql`, `line`, `column`): `null` \| `string`

Defined in: [packages/core/src/utils/CTERegionDetector.ts:185](https://github.com/mk3008/rawsql-ts/blob/ba0d5a5f2250835b8b10e16a23b02b837e358b03/packages/core/src/utils/CTERegionDetector.ts#L185)

Get the CTE name at the specified 2D coordinates (line, column).

This method provides a convenient interface for editor integrations
that work with line/column coordinates instead of character positions.

#### Parameters

##### sql

`string`

The SQL string to analyze

##### line

`number`

The line number (1-based)

##### column

`number`

The column number (1-based)

#### Returns

`null` \| `string`

The CTE name if cursor is in a CTE, null otherwise

#### Example

```typescript
const sql = `WITH users AS (\n  SELECT * FROM table\n) SELECT * FROM users`;
const cteName = CTERegionDetector.getCursorCteAt(sql, 2, 5);
console.log(cteName); // "users"
```

***

### positionToLineColumn()

> `static` **positionToLineColumn**(`text`, `position`): `null` \| \{ `line`: `number`; `column`: `number`; \}

Defined in: [packages/core/src/utils/CTERegionDetector.ts:237](https://github.com/mk3008/rawsql-ts/blob/ba0d5a5f2250835b8b10e16a23b02b837e358b03/packages/core/src/utils/CTERegionDetector.ts#L237)

Convert character position to line/column coordinates.

#### Parameters

##### text

`string`

The text to analyze

##### position

`number`

The character position (0-based)

#### Returns

`null` \| \{ `line`: `number`; `column`: `number`; \}

Object with line and column (1-based), or null if invalid position

***

### extractCTERegions()

> `static` **extractCTERegions**(`sql`): [`CTERegion`](../interfaces/CTERegion.md)[]

Defined in: [packages/core/src/utils/CTERegionDetector.ts:276](https://github.com/mk3008/rawsql-ts/blob/ba0d5a5f2250835b8b10e16a23b02b837e358b03/packages/core/src/utils/CTERegionDetector.ts#L276)

Extract all CTE regions from SQL text with their boundaries and executable content.

Parses the SQL to identify all Common Table Expressions and their locations,
providing the information needed for syntax highlighting, code folding, and selective execution.

#### Parameters

##### sql

`string`

The SQL string to analyze

#### Returns

[`CTERegion`](../interfaces/CTERegion.md)[]

Array of CTE regions with their boundaries and content

#### Example

```typescript
const sql = `
  WITH 
    users AS (SELECT * FROM people),
    orders AS (SELECT * FROM purchases)
  SELECT * FROM users JOIN orders
`;

const regions = CTERegionDetector.extractCTERegions(sql);
// Returns: [
//   { name: 'users', startPosition: 23, endPosition: 45, sqlContent: 'SELECT * FROM people' },
//   { name: 'orders', startPosition: 55, endPosition: 80, sqlContent: 'SELECT * FROM purchases' }
// ]
```

***

### getCTEPositions()

> `static` **getCTEPositions**(`sql`): `object`[]

Defined in: [packages/core/src/utils/CTERegionDetector.ts:507](https://github.com/mk3008/rawsql-ts/blob/ba0d5a5f2250835b8b10e16a23b02b837e358b03/packages/core/src/utils/CTERegionDetector.ts#L507)

Get a list of all executable sections (CTEs and main query) with their start positions.

This method is particularly useful for building editor UI features such as:
- Dropdown menus for section selection
- Sidebar navigation for large queries
- Quick jump functionality
- "Run section" buttons

#### Parameters

##### sql

`string`

The SQL string to analyze

#### Returns

`object`[]

Array of executable sections with their names, positions, and types

#### Example

```typescript
const sql = `
  WITH monthly_sales AS (SELECT ...), 
       yearly_summary AS (SELECT ...)
  SELECT * FROM yearly_summary
`;

const positions = CTERegionDetector.getCTEPositions(sql);
// Returns: [
//   { name: 'monthly_sales', startPosition: 17, type: 'CTE' },
//   { name: 'yearly_summary', startPosition: 55, type: 'CTE' },
//   { name: 'MAIN_QUERY', startPosition: 120, type: 'MAIN_QUERY' }
// ]

// Use for editor UI
positions.forEach(section => {
  addMenuItem(`${section.type}: ${section.name}`, () => {
    jumpToPosition(section.startPosition);
  });
});
```
</div>

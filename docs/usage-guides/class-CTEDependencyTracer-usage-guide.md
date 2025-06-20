# CTEDependencyTracer Usage Guide

## Overview

The `CTEDependencyTracer` class is a powerful debugging and analysis tool for visualizing Common Table Expression (CTE) dependency graphs and tracing column availability through complex SQL queries with multiple CTEs and UNIONs.

## Key Features

- **CTE Dependency Graph Visualization**: Build and display hierarchical dependency relationships between CTEs
- **Column Search Tracing**: Track which CTEs contain specific columns and identify where columns are lost in the dependency chain
- **Complex Query Analysis**: Handle nested CTEs, UNIONs, and multi-level dependencies
- **Debug-Friendly Output**: Pretty-printed graphs and traces for easy debugging

## Installation & Import

```typescript
import { CTEDependencyTracer } from 'rawsql-ts/transformers/CTEDependencyTracer';
import { SelectQueryParser } from 'rawsql-ts/parsers/SelectQueryParser';
```

## Basic Usage

### 1. Building CTE Dependency Graphs

```typescript
const sql = `
  WITH 
    root_data AS (
      SELECT id, name, client_id FROM customers
    ),
    filtered_data AS (
      SELECT id, name FROM root_data WHERE active = true
    ),
    final_result AS (
      SELECT name FROM filtered_data
    )
  SELECT name FROM final_result
`;

const query = SelectQueryParser.parse(sql);
const tracer = new CTEDependencyTracer();

// Build the dependency graph
const graph = tracer.buildGraph(query);

// Display the graph structure
tracer.printGraph(graph);
```

**Output:**
```
=== CTE Dependency Graph ===

Level 0:
  root_data (3 cols)

Level 1:
  filtered_data (2 cols)
    depends on: root_data

Level 2:
  final_result (1 cols)
    depends on: filtered_data
```

### 2. Tracing Column Availability

```typescript
// Trace where a specific column exists in the CTE chain
const columnTrace = tracer.traceColumnSearch(query, 'client_id');

// Display the trace results
tracer.printColumnTrace('client_id', columnTrace);
```

**Output:**
```
=== Column Search Trace for "client_id" ===
Search path: MAIN_QUERY → final_result → filtered_data → root_data
Found in: root_data
Not found in: MAIN_QUERY, final_result, filtered_data

--- Details of CTEs containing the column ---
root_data:
  All columns: id, name, client_id
  Dependencies: none
```

## Advanced Usage Scenarios

### 1. Complex UNION Queries

```typescript
const complexSQL = `
  WITH 
    customers_cte AS (
      SELECT id, name, email, customer_type FROM customers
    ),
    orders_cte AS (
      SELECT customer_id as id, order_date, amount FROM orders
    ),
    combined_data AS (
      SELECT id, name FROM customers_cte
      UNION ALL
      SELECT id, 'Order Record' as name FROM orders_cte
    )
  SELECT * FROM combined_data
`;

const query = SelectQueryParser.parse(complexSQL);
const tracer = new CTEDependencyTracer();

// Analyze the complex structure
const graph = tracer.buildGraph(query);
console.log(`Found ${graph.nodes.size} CTEs`);
console.log(`Root CTEs: ${graph.rootNodes.join(', ')}`);
console.log(`Leaf CTEs: ${graph.leafNodes.join(', ')}`);

// Check multiple columns
const columnsToCheck = ['email', 'customer_type', 'order_date', 'amount'];
columnsToCheck.forEach(col => {
  const trace = tracer.traceColumnSearch(query, col);
  console.log(`\n${col}: Found in ${trace.foundIn.length} CTEs`);
});
```

### 2. Debugging Column Loss in UNIONs

When working with UNION operations, columns can be "lost" if they don't exist in all branches:

```typescript
const unionSQL = `
  WITH 
    branch_a AS (
      SELECT id, name, special_column FROM table_a
    ),
    branch_b AS (
      SELECT id, name FROM table_b  -- special_column missing!
    ),
    union_result AS (
      SELECT id, name FROM branch_a
      UNION
      SELECT id, name FROM branch_b  -- special_column lost here
    )
  SELECT * FROM union_result
`;

const query = SelectQueryParser.parse(unionSQL);
const tracer = new CTEDependencyTracer();

// This will show exactly where special_column gets lost
const trace = tracer.traceColumnSearch(query, 'special_column');
tracer.printColumnTrace('special_column', trace);

// Expected output will show:
// Found in: branch_a
// Not found in: union_result, branch_b, MAIN_QUERY
```

## API Reference

### `buildGraph(query: SelectQuery): DependencyGraph`

Builds a complete dependency graph for all CTEs in the query.

**Returns:**
- `nodes`: Map of CTE names to their metadata
- `dependencies`: Map of CTE dependencies  
- `rootNodes`: CTEs with no dependencies
- `leafNodes`: CTEs not used by others
- `levels`: CTEs organized by dependency depth

### `traceColumnSearch(query: SelectQuery, columnName: string): ColumnTrace`

Traces where a specific column exists throughout the CTE dependency chain.

**Parameters:**
- `query`: Parsed SQL query
- `columnName`: Name of column to trace

**Returns:**
- `searchPath`: Order of CTEs searched
- `foundIn`: CTEs containing the column
- `notFoundIn`: CTEs missing the column
- `details`: Detailed info for CTEs containing the column

### `printGraph(graph: DependencyGraph): void`

Pretty-prints the dependency graph in a hierarchical format.

### `printColumnTrace(columnName: string, trace: ColumnTrace): void`

Pretty-prints the column trace results with detailed information.

## Common Use Cases

### 1. Debugging "Column not found" Errors

```typescript
// When SqlParamInjector fails to find a column
const tracer = new CTEDependencyTracer();
const trace = tracer.traceColumnSearch(query, 'problematic_column');

if (trace.foundIn.length === 0) {
  console.log('Column does not exist anywhere in the query');
} else if (!trace.foundIn.includes('MAIN_QUERY')) {
  console.log('Column exists in CTEs but not accessible in main query');
  console.log(`Available in: ${trace.foundIn.join(', ')}`);
}
```

### 2. Query Optimization Analysis

```typescript
// Identify unnecessary CTE levels
const graph = tracer.buildGraph(query);
const singleColumnCTEs = Array.from(graph.nodes.entries())
  .filter(([name, info]) => info.columns.length === 1)
  .map(([name]) => name);

console.log('Single-column CTEs (potential optimization targets):', singleColumnCTEs);
```

### 3. Validating Complex Refactoring

```typescript
// Before and after refactoring comparison
const beforeTrace = tracer.traceColumnSearch(originalQuery, 'important_column');
const afterTrace = tracer.traceColumnSearch(refactoredQuery, 'important_column');

const sameAvailability = beforeTrace.foundIn.length === afterTrace.foundIn.length;
console.log('Column availability preserved:', sameAvailability);
```

## Best Practices

1. **Use for Complex Queries**: Most valuable for queries with 3+ CTEs or UNION operations
2. **Debug Before Fixing**: Always trace the issue before attempting fixes
3. **Combine with Tests**: Use in unit tests to validate complex query behavior
4. **Performance Consideration**: This is a debugging tool - don't use in production code paths

## Integration with Other Tools

The CTEDependencyTracer works seamlessly with other rawsql-ts components:

```typescript
// Combined with UpstreamSelectQueryFinder for comprehensive analysis
import { UpstreamSelectQueryFinder } from 'rawsql-ts/transformers/UpstreamSelectQueryFinder';

const finder = new UpstreamSelectQueryFinder();
const tracer = new CTEDependencyTracer();

// First trace to understand the structure
const trace = tracer.traceColumnSearch(query, 'target_column');
console.log('Column trace:', trace);

// Then find upstream sources
const upstreamSources = finder.find(query, ['target_column']);
console.log('Upstream sources found:', upstreamSources.length);
```

## Troubleshooting

### Issue: Empty dependency graph
**Solution**: Ensure your query contains WITH clauses. Simple queries without CTEs won't generate meaningful graphs.

### Issue: Column trace shows no results
**Solution**: Verify column name spelling and check if the column exists in any SELECT clauses within CTEs.

### Issue: Unexpected dependency relationships
**Solution**: Complex subqueries within CTEs may not be fully analyzed. Consider simplifying or using explicit column mappings.

# CTE Management API Usage Guide

This guide provides comprehensive instructions for using the CTE Management API in rawsql-ts. The API enables programmatic manipulation of Common Table Expressions (CTEs), providing powerful capabilities for building complex SQL queries dynamically.

## Overview

The CTE Management API allows you to:
- Add, remove, and replace CTEs programmatically
- Query CTE existence and retrieve CTE names
- Control PostgreSQL-specific optimization with MATERIALIZED hints
- Build complex multi-step data transformation pipelines
- Handle errors gracefully with custom error types

## API Reference

### Core Methods

#### `addCTE(name: string, query: SelectQuery, options?: CTEOptions): this`

Adds a new CTE to the query.

```typescript
const query = SelectQueryParser.parse('SELECT * FROM users').toSimpleQuery();
const summaryQuery = SelectQueryParser.parse('SELECT COUNT(*) as total FROM orders');

// Add a basic CTE
query.addCTE('order_summary', summaryQuery.toSimpleQuery());

// Add with PostgreSQL materialization hint
query.addCTE('expensive_calc', complexQuery.toSimpleQuery(), { materialized: true });
```

**Parameters:**
- `name`: CTE name (must be non-empty)
- `query`: The SELECT query for the CTE
- `options`: Optional configuration
- `materialized`: `true` (MATERIALIZED), `false` (NOT MATERIALIZED), or `null` (default)

**Throws:**
- `InvalidCTENameError`: If name is empty or whitespace
- `DuplicateCTEError`: If CTE with same name already exists

#### `removeCTE(name: string): this`

Removes an existing CTE from the query.

```typescript
query.removeCTE('order_summary');
```

**Throws:**
- `CTENotFoundError`: If CTE doesn't exist

#### `hasCTE(name: string): boolean`

Checks if a CTE with the given name exists.

```typescript
if (query.hasCTE('order_summary')) {
    console.log('CTE exists');
}
```

#### `getCTENames(): string[]`

Returns an array of all CTE names in the query.

```typescript
const cteNames = query.getCTENames();
// Returns: ['order_summary', 'user_stats', 'product_data']
```

#### `replaceCTE(name: string, query: SelectQuery, options?: CTEOptions): this`

Replaces an existing CTE with a new query.

```typescript
const updatedQuery = SelectQueryParser.parse('SELECT COUNT(*) as total, AVG(amount) as avg FROM orders');
query.replaceCTE('order_summary', updatedQuery.toSimpleQuery());
```

**Throws:**
- `CTENotFoundError`: If CTE doesn't exist

### Converting Query Types

The CTE Management API is available on `SimpleSelectQuery`. Use `toSimpleQuery()` to convert other query types:

```typescript
// From parser result
const parsed = SelectQueryParser.parse('SELECT * FROM users');
const query = parsed.toSimpleQuery();

// From BinarySelectQuery (UNION, INTERSECT, EXCEPT)
const unionQuery = SelectQueryParser.parse('SELECT id FROM users UNION SELECT id FROM customers');
const simpleQuery = unionQuery.toSimpleQuery();

// From ValuesQuery
const valuesQuery = SelectQueryParser.parse('VALUES (1, 2), (3, 4)');
const simpleQuery = valuesQuery.toSimpleQuery();
```

## PostgreSQL MATERIALIZED Optimization

PostgreSQL 12+ supports optimization hints for CTEs. Use the `materialized` option to control query execution:

### When to Use MATERIALIZED

**Force materialization (`materialized: true`):**
- Expensive computations used multiple times
- Queries with side effects
- When you need consistent results across references

```typescript
const expensiveCalc = SelectQueryParser.parse(`
    SELECT user_id, 
           complex_aggregation(data) as result
    FROM large_table
    WHERE expensive_condition(data)
`);

query.addCTE('cached_results', expensiveCalc.toSimpleQuery(), { 
    materialized: true 
});
```

**Prevent materialization (`materialized: false`):**
- Simple filters or projections
- Queries used only once
- When you want the optimizer to inline the CTE

```typescript
const simpleFilter = SelectQueryParser.parse(`
    SELECT * FROM products WHERE category = 'electronics'
`);

query.addCTE('electronics', simpleFilter.toSimpleQuery(), { 
    materialized: false 
});
```

**Let PostgreSQL decide (default):**
- Most common case
- Allows query planner to optimize

```typescript
query.addCTE('standard_cte', someQuery.toSimpleQuery());
// or explicitly: { materialized: null }
```

## Common Patterns

### Building Data Pipelines

Create multi-step data transformation pipelines:

```typescript
import { SelectQueryParser, SqlFormatter } from 'rawsql-ts';

function buildSalesAnalysisPipeline(startDate: string) {
    const pipeline = SelectQueryParser.parse('SELECT * FROM final_analysis').toSimpleQuery();
    
    // Step 1: Extract raw data
    const rawDataQuery = SelectQueryParser.parse(`
        SELECT 
            sale_id,
            customer_id,
            product_id,
            sale_date,
            quantity,
            unit_price,
            quantity * unit_price as total_amount
        FROM sales
        WHERE sale_date >= '${startDate}'
    `);
    
    pipeline.addCTE('raw_sales', rawDataQuery.toSimpleQuery(), { materialized: true });
    
    // Step 2: Join with customer data
    const enrichedQuery = SelectQueryParser.parse(`
        SELECT 
            rs.*,
            c.customer_name,
            c.customer_segment,
            c.region
        FROM raw_sales rs
        JOIN customers c ON rs.customer_id = c.customer_id
    `);
    
    pipeline.addCTE('enriched_sales', enrichedQuery.toSimpleQuery());
    
    // Step 3: Aggregate by segment and region
    const aggregateQuery = SelectQueryParser.parse(`
        SELECT 
            customer_segment,
            region,
            COUNT(DISTINCT customer_id) as customer_count,
            COUNT(*) as transaction_count,
            SUM(total_amount) as revenue,
            AVG(total_amount) as avg_transaction_value
        FROM enriched_sales
        GROUP BY customer_segment, region
    `);
    
    pipeline.addCTE('segment_analysis', aggregateQuery.toSimpleQuery());
    
    // Final query uses all CTEs
    const finalQuery = SelectQueryParser.parse(`
        SELECT 
            sa.*,
            sa.revenue / sa.customer_count as revenue_per_customer,
            RANK() OVER (PARTITION BY customer_segment ORDER BY revenue DESC) as region_rank
        FROM segment_analysis sa
        WHERE customer_count >= 10
        ORDER BY customer_segment, revenue DESC
    `);
    
    // Replace the placeholder with actual final query
    pipeline.replaceCTE('final_analysis', finalQuery.toSimpleQuery());
    
    return pipeline;
}

// Use the pipeline
const analysisQuery = buildSalesAnalysisPipeline('2024-01-01');
const formatter = new SqlFormatter();
const { formattedSql, params } = formatter.format(analysisQuery);
```

### Recursive CTEs

Build recursive queries for hierarchical data:

```typescript
const hierarchyQuery = SelectQueryParser.parse('SELECT * FROM category_tree').toSimpleQuery();

// Anchor: top-level categories
const anchorQuery = SelectQueryParser.parse(`
    SELECT 
        category_id,
        category_name,
        parent_id,
        0 as level,
        ARRAY[category_id] as path
    FROM categories
    WHERE parent_id IS NULL
`);

// Recursive part
const recursiveQuery = SelectQueryParser.parse(`
    SELECT 
        c.category_id,
        c.category_name,
        c.parent_id,
        ct.level + 1,
        ct.path || c.category_id
    FROM categories c
    JOIN category_tree ct ON c.parent_id = ct.category_id
`);

// Combine with UNION ALL for recursion
const recursiveCTE = anchorQuery.toUnion(recursiveQuery);
hierarchyQuery.addCTE('category_tree', recursiveCTE.toSimpleQuery());

// Use the recursive CTE
const treeQuery = SelectQueryParser.parse(`
    SELECT 
        category_id,
        REPEAT('  ', level) || category_name as indented_name,
        path
    FROM category_tree
    ORDER BY path
`);

hierarchyQuery.replaceCTE('category_tree', treeQuery.toSimpleQuery());
```

### Dynamic CTE Generation

Generate CTEs based on runtime conditions:

```typescript
interface FilterConfig {
    includeInactive?: boolean;
    regions?: string[];
    minRevenue?: number;
}

function buildDynamicReport(config: FilterConfig) {
    const report = SelectQueryParser.parse('SELECT * FROM report_data').toSimpleQuery();
    
    // Base customer CTE
    let customerFilter = 'WHERE 1=1';
    if (!config.includeInactive) {
        customerFilter += ' AND status = \'active\'';
    }
    if (config.regions && config.regions.length > 0) {
        const regionList = config.regions.map(r => `'${r}'`).join(',');
        customerFilter += ` AND region IN (${regionList})`;
    }
    
    const customerQuery = SelectQueryParser.parse(`
        SELECT customer_id, customer_name, region, status
        FROM customers
        ${customerFilter}
    `);
    
    report.addCTE('filtered_customers', customerQuery.toSimpleQuery());
    
    // Add revenue CTE if threshold specified
    if (config.minRevenue) {
        const revenueQuery = SelectQueryParser.parse(`
            SELECT 
                c.customer_id,
                c.customer_name,
                SUM(o.total_amount) as total_revenue
            FROM filtered_customers c
            JOIN orders o ON c.customer_id = o.customer_id
            GROUP BY c.customer_id, c.customer_name
            HAVING SUM(o.total_amount) >= ${config.minRevenue}
        `);
        
        report.addCTE('high_value_customers', revenueQuery.toSimpleQuery());
        
        // Update final query to use revenue filter
        const finalQuery = SelectQueryParser.parse(`
            SELECT * FROM high_value_customers
            ORDER BY total_revenue DESC
        `);
        report.replaceCTE('report_data', finalQuery.toSimpleQuery());
    } else {
        // Use basic customer list
        const finalQuery = SelectQueryParser.parse(`
            SELECT * FROM filtered_customers
            ORDER BY customer_name
        `);
        report.replaceCTE('report_data', finalQuery.toSimpleQuery());
    }
    
    return report;
}
```

## Error Handling

The CTE Management API provides specific error types for different scenarios:

### Error Types

```typescript
import { 
    DuplicateCTEError, 
    CTENotFoundError, 
    InvalidCTENameError 
} from 'rawsql-ts';
```

### Handling Duplicate CTEs

```typescript
function safeCTEAdd(query: SimpleSelectQuery, name: string, cteQuery: SelectQuery) {
    try {
        query.addCTE(name, cteQuery.toSimpleQuery());
        console.log(`CTE '${name}' added successfully`);
    } catch (error) {
        if (error instanceof DuplicateCTEError) {
            console.log(`CTE '${error.cteName}' already exists, replacing...`);
            query.replaceCTE(name, cteQuery.toSimpleQuery());
        } else {
            throw error;
        }
    }
}
```

### Handling Missing CTEs

```typescript
function safeCTERemove(query: SimpleSelectQuery, name: string) {
    try {
        query.removeCTE(name);
        console.log(`CTE '${name}' removed`);
    } catch (error) {
        if (error instanceof CTENotFoundError) {
            console.log(`CTE '${error.cteName}' not found, skipping removal`);
        } else {
            throw error;
        }
    }
}
```

### Validation Helper

```typescript
function validateCTEName(name: string): boolean {
    try {
        if (!name || name.trim() === '') {
            throw new InvalidCTENameError(name, 'CTE name cannot be empty');
        }
        // Additional validation rules
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
            throw new InvalidCTENameError(name, 'CTE name must be a valid identifier');
        }
        return true;
    } catch (error) {
        if (error instanceof InvalidCTENameError) {
            console.error(`Invalid CTE name: ${error.message}`);
            return false;
        }
        throw error;
    }
}
```

## Performance Considerations

### O(1) Name Lookups

The CTE Management API uses an internal Set for name tracking, providing O(1) performance for:
- `hasCTE()` checks
- Duplicate detection in `addCTE()`
- Existence validation in `removeCTE()` and `replaceCTE()`

This makes it efficient even with many CTEs:

```typescript
const query = SelectQueryParser.parse('SELECT 1').toSimpleQuery();

// Add 100 CTEs
for (let i = 0; i < 100; i++) {
    const cte = SelectQueryParser.parse(`SELECT ${i} as num`);
    query.addCTE(`cte_${i}`, cte.toSimpleQuery());
}

// O(1) lookup performance
console.log(query.hasCTE('cte_50')); // Fast lookup
console.log(query.getCTENames().length); // Returns 100
```

### Memory Efficiency

CTEs are stored as references to SelectQuery objects. Consider memory usage when building large pipelines:

```typescript
// Good: Reuse query objects when possible
const baseQuery = SelectQueryParser.parse('SELECT * FROM large_table');
const filtered1 = baseQuery.toSimpleQuery();
const filtered2 = baseQuery.toSimpleQuery();

// Less efficient: Parse same query multiple times
const query1 = SelectQueryParser.parse('SELECT * FROM large_table').toSimpleQuery();
const query2 = SelectQueryParser.parse('SELECT * FROM large_table').toSimpleQuery();
```

## Integration with Other rawsql-ts Features

### With SqlFormatter

Format queries with CTEs using SqlFormatter:

```typescript
const formatter = new SqlFormatter({
    keywordCase: 'upper',
    indentSize: 2
});

const { formattedSql } = formatter.format(queryWithCTEs);
```

#### CTE One-liner Formatting

Use the `cteOneline` option to format CTE parts as one-liners while keeping the main query with normal formatting:

```typescript
const formatter = new SqlFormatter({
    keywordCase: 'upper',
    indentSize: 2,
    newline: '\n',
    cteOneline: true  // Format CTE parts as one-liners
});

const query = SelectQueryParser.parse(`
    WITH user_summary AS (
        SELECT id, name, COUNT(*)
        FROM users
        WHERE active = true
        GROUP BY id, name
    )
    SELECT * FROM user_summary
    ORDER BY name;
`);

const { formattedSql } = formatter.format(query);
console.log(formattedSql);
/*
Output:
WITH
  "user_summary" AS (SELECT "id", "name", COUNT(*) FROM "users" WHERE "active" = TRUE GROUP BY "id", "name")
SELECT
  *
FROM
  "user_summary"
ORDER BY
  "name"
*/
```

**Benefits of CTE One-liner Formatting:**
- Keeps CTE definitions compact while maintaining readability of the main query
- Useful for complex queries with multiple CTEs
- Preserves all other formatting options (keyword case, indentation, etc.)
- Maintains backward compatibility when option is not specified

### With DynamicQueryBuilder

Combine CTE management with dynamic query building:

```typescript
// Start with CTEs
const baseQuery = SelectQueryParser.parse('SELECT * FROM enriched_data').toSimpleQuery();
baseQuery.addCTE('user_segments', segmentQuery.toSimpleQuery());
baseQuery.addCTE('product_categories', categoryQuery.toSimpleQuery());

// Apply dynamic filters
const builder = new DynamicQueryBuilder();
const finalQuery = builder.buildQuery(baseQuery, {
    filter: { segment: 'premium', category: 'electronics' },
    sort: { revenue: { desc: true } },
    paging: { page: 1, pageSize: 20 }
});
```

### With PostgresJsonQueryBuilder

Use CTEs to prepare data for JSON transformation:

```typescript
const query = SelectQueryParser.parse('SELECT * FROM user_data').toSimpleQuery();

// Add CTE to denormalize data
const denormalizedQuery = SelectQueryParser.parse(`
    SELECT 
        u.user_id,
        u.user_name,
        o.order_id,
        o.order_date,
        oi.product_name,
        oi.quantity
    FROM users u
    LEFT JOIN orders o ON u.user_id = o.user_id
    LEFT JOIN order_items oi ON o.order_id = oi.order_id
`);

query.addCTE('denormalized', denormalizedQuery.toSimpleQuery());

// Transform to JSON
const jsonBuilder = new PostgresJsonQueryBuilder();
const jsonQuery = jsonBuilder.buildJson(query, {
    rootName: 'user',
    rootEntity: { 
        id: 'user', 
        name: 'User', 
        columns: { id: 'user_id', name: 'user_name' } 
    },
    nestedEntities: [
        { 
            id: 'orders', 
            parentId: 'user', 
            propertyName: 'orders', 
            relationshipType: 'array',
            columns: { orderId: 'order_id', orderDate: 'order_date' }
        }
    ]
});
```

## Best Practices

### 1. Use Meaningful CTE Names

```typescript
// Good: Descriptive names
query.addCTE('active_users_with_recent_orders', ...);
query.addCTE('monthly_revenue_by_segment', ...);

// Bad: Generic names
query.addCTE('cte1', ...);
query.addCTE('temp', ...);
```

### 2. Order CTEs Logically

Build CTEs in dependency order for clarity:

```typescript
// 1. Base data extraction
query.addCTE('raw_transactions', ...);

// 2. Data enrichment
query.addCTE('enriched_transactions', ...);

// 3. Aggregations
query.addCTE('daily_summaries', ...);

// 4. Final calculations
query.addCTE('trend_analysis', ...);
```

### 3. Use Materialization Hints Wisely

```typescript
// Expensive computation used multiple times: MATERIALIZED
const expensiveAggregation = parseExpensiveQuery();
query.addCTE('cached_aggregates', expensiveAggregation, { materialized: true });

// Simple filter used once: NOT MATERIALIZED
const simpleFilter = parseSimpleFilter();
query.addCTE('filtered_data', simpleFilter, { materialized: false });

// Let optimizer decide for moderate complexity
const standardQuery = parseStandardQuery();
query.addCTE('processed_data', standardQuery);
```

### 4. Handle Errors Gracefully

```typescript
function buildQuerySafely(ctes: Array<{ name: string; sql: string }>) {
    const query = SelectQueryParser.parse('SELECT 1').toSimpleQuery();
    const added: string[] = [];
    
    for (const cte of ctes) {
        try {
            const cteQuery = SelectQueryParser.parse(cte.sql);
            query.addCTE(cte.name, cteQuery.toSimpleQuery());
            added.push(cte.name);
        } catch (error) {
            console.error(`Failed to add CTE '${cte.name}':`, error.message);
            // Rollback on error
            for (const name of added) {
                query.removeCTE(name);
            }
            throw error;
        }
    }
    
    return query;
}
```

### 5. Document Complex Pipelines

```typescript
/**
 * Builds a customer lifetime value (CLV) analysis pipeline
 * 
 * CTEs created:
 * - customer_transactions: All transactions with customer data
 * - customer_metrics: Per-customer aggregations
 * - clv_segments: CLV calculation and segmentation
 * 
 * @param startDate Analysis start date
 * @param endDate Analysis end date
 * @returns Query with CLV analysis CTEs
 */
function buildCLVPipeline(startDate: string, endDate: string): SimpleSelectQuery {
    // Implementation...
}
```

## Troubleshooting

### Common Issues

1. **"Cannot read property 'toSimpleQuery' of undefined"**
   - Ensure SelectQueryParser.parse() succeeded
   - Check SQL syntax is valid

2. **"CTE 'x' already exists"**
   - Use `hasCTE()` to check before adding
   - Consider using `replaceCTE()` instead

3. **"CTE 'x' not found"**
   - Verify CTE was added successfully
   - Check for typos in CTE names

4. **Materialization hints not appearing in output**
   - Ensure using PostgreSQL SQL formatter preset
   - Verify formatter supports MATERIALIZED syntax

### Debugging Tips

```typescript
// Log CTE state during pipeline building
function debugCTEPipeline(query: SimpleSelectQuery, stage: string) {
    console.log(`=== ${stage} ===`);
    console.log('CTEs:', query.getCTENames());
    query.getCTENames().forEach(name => {
        console.log(`- ${name}: exists = ${query.hasCTE(name)}`);
    });
}

// Use during pipeline construction
const pipeline = SelectQueryParser.parse('SELECT 1').toSimpleQuery();
debugCTEPipeline(pipeline, 'Initial state');

pipeline.addCTE('stage1', stage1Query.toSimpleQuery());
debugCTEPipeline(pipeline, 'After stage 1');

pipeline.addCTE('stage2', stage2Query.toSimpleQuery());
debugCTEPipeline(pipeline, 'After stage 2');
```

This guide provides comprehensive coverage of the CTE Management API, enabling you to build complex, dynamic SQL queries with confidence.
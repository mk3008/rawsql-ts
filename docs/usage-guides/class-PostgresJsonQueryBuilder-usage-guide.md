# PostgresJsonQueryBuilder Usage Guide

The `PostgresJsonQueryBuilder` class is a powerful utility designed to transform relational SQL queries into PostgreSQL JSON queries that return hierarchical JSON structures. It automatically handles complex relationships between entities and generates optimized Common Table Expressions (CTEs) for efficient JSON aggregation.

## Key Features

*   **Hierarchical JSON Generation**: Transforms flat relational data into nested JSON objects and arrays.
*   **Automatic CTE Management**: Generates optimized CTEs with proper dependency ordering.
*   **Flexible Relationship Types**: Supports both object (0..1) and array (1..N) relationships.
*   **NULL Handling**: Properly handles missing relationships with NULL values instead of empty objects.
*   **Depth-Based Processing**: Automatically calculates and processes entities in the correct order.
*   **JSONB Support**: Optional JSONB output for better PostgreSQL performance.

## How It Works

`PostgresJsonQueryBuilder` takes a `SimpleSelectQuery` and a `JsonMapping` configuration, then transforms them into a PostgreSQL query that returns JSON structures. The process involves:

1. **Validation**: Ensures the mapping configuration is valid against the original query
2. **CTE Generation**: Creates hierarchical CTEs for object and array entities
3. **JSON Aggregation**: Builds the final query with appropriate JSON functions

The transformation follows a depth-based processing strategy, ensuring that deeper nested entities are processed before their parents.

## Basic Usage

Here's a simple example of how to use `PostgresJsonQueryBuilder`:

```typescript
import { PostgresJsonQueryBuilder, SimpleSelectQuery, SelectQueryParser } from 'rawsql-ts';

// Parse your base SQL query
const parser = new SelectQueryParser();
const baseQuery = parser.parse(`
    SELECT o.order_id, o.order_date, o.total_amount,
           c.customer_id, c.customer_name, c.email,
           a.address_id, a.street, a.city
    FROM orders o
    LEFT JOIN customers c ON o.customer_id = c.customer_id
    LEFT JOIN addresses a ON c.address_id = a.address_id
`);

// Define the JSON mapping
const mapping = {
    rootName: "order",
    rootEntity: {
        id: "order",
        name: "Order",
        columns: {
            "id": "order_id",
            "date": "order_date", 
            "total": "total_amount"
        }
    },
    nestedEntities: [
        {
            id: "customer",
            name: "Customer",
            parentId: "order",
            propertyName: "customer",
            relationshipType: "object",
            columns: {
                "id": "customer_id",
                "name": "customer_name",
                "email": "email"
            }
        },
        {
            id: "address",
            name: "Address", 
            parentId: "customer",
            propertyName: "address",
            relationshipType: "object",
            columns: {
                "id": "address_id",
                "street": "street",
                "city": "city"
            }
        }
    ],
    resultFormat: "array"
};

// Transform the query
const builder = new PostgresJsonQueryBuilder();
const jsonQuery = builder.buildJson(baseQuery, mapping);

// The result will be a query that returns:
// [
//   {
//     "id": 1,
//     "date": "2024-01-15",
//     "total": 99.99,
//     "customer": {
//       "id": 101,
//       "name": "John Doe",
//       "email": "john@example.com",
//       "address": {
//         "id": 201,
//         "street": "123 Main St",
//         "city": "New York"
//       }
//     }
//   }
// ]
```

## JSON Mapping Configuration

The `JsonMapping` interface defines how your relational data should be transformed into JSON:

### Root Entity
```typescript
rootEntity: {
    id: string;              // Unique identifier for the root entity
    name: string;            // Display name (used for JSON column naming)
    columns: {               // Mapping from JSON keys to SQL column names
        [jsonKey: string]: string;
    };
}
```

### Nested Entities
```typescript
nestedEntities: Array<{
    id: string;                              // Unique identifier
    name: string;                            // Display name
    parentId: string;                        // ID of parent entity
    propertyName: string;                    // Property name in parent JSON
    relationshipType: "object" | "array";   // Relationship type
    columns: {                               // Column mapping
        [jsonKey: string]: string;
    };
}>
```

### Configuration Options
```typescript
{
    resultFormat?: "array" | "single";      // Result format (default: "array")
    emptyResult?: string;                    // Value for empty results
}
```

## Relationship Types

### Object Relationships (0..1)
Use `relationshipType: "object"` for relationships where each parent has at most one child:

```typescript
// Customer → Address (each customer has one address)
{
    id: "address",
    parentId: "customer", 
    relationshipType: "object",
    // ...
}
```

**Result Structure:**
```json
{
    "customer": {
        "name": "John Doe",
        "address": {
            "street": "123 Main St",
            "city": "New York"
        }
    }
}
```

### Array Relationships (1..N)
Use `relationshipType: "array"` for relationships where each parent can have multiple children:

```typescript
// Order → OrderItems (each order has multiple items)
{
    id: "order_items",
    parentId: "order",
    relationshipType: "array", 
    // ...
}
```

**Result Structure:**
```json
{
    "order": {
        "id": 1,
        "items": [
            { "product": "Widget A", "quantity": 2 },
            { "product": "Widget B", "quantity": 1 }
        ]
    }
}
```

## Advanced Examples

### Complex Hierarchical Structure
```typescript
const complexMapping = {
    rootName: "company",
    rootEntity: {
        id: "company",
        name: "Company",
        columns: {
            "id": "company_id",
            "name": "company_name"
        }
    },
    nestedEntities: [
        // Departments (array)
        {
            id: "departments",
            name: "Department",
            parentId: "company",
            propertyName: "departments",
            relationshipType: "array",
            columns: {
                "id": "dept_id",
                "name": "dept_name"
            }
        },
        // Employees in each department (array)
        {
            id: "employees",
            name: "Employee", 
            parentId: "departments",
            propertyName: "employees",
            relationshipType: "array",
            columns: {
                "id": "emp_id",
                "name": "emp_name",
                "position": "position"
            }
        },
        // Employee details (object)
        {
            id: "employee_details",
            name: "EmployeeDetail",
            parentId: "employees", 
            propertyName: "details",
            relationshipType: "object",
            columns: {
                "phone": "phone_number",
                "email": "email_address"
            }
        }
    ],};
```

### Single Object Result
```typescript
const singleResultMapping = {
    // ... entity definitions ...
    resultFormat: "single"  // Returns single object instead of array
};
```

## NULL Handling

The builder automatically handles NULL values for missing relationships:

```sql
-- Input data with missing address
customer_id | customer_name | address_id | street
1          | "John Doe"    | NULL       | NULL

-- JSON Result (address is NULL, not empty object)
{ 
   "customer": {
        "name": "John Doe", 
        "address": null  // ← NULL instead of {"street": null}
    }
}
```

## Performance Considerations

### JSONB vs JSON
```typescript
// For better performance in PostgreSQL
const mapping = {
    // ...};
```

### Query Optimization
The builder automatically:
- Processes entities in dependency order
- Groups entities by depth for fewer CTEs
- Uses proper indexing with depth-based naming

## Error Handling and Validation

The builder validates your mapping configuration and throws descriptive errors:

```typescript
try {
    const jsonQuery = builder.buildJson(baseQuery, mapping);
} catch (error) {
    console.error('Mapping validation failed:', error.message);
    // Examples:
    // "Column 'invalid_column' not found in available columns"
    // "Parent entity 'nonexistent' not found"
    // "Entity 'department' has multiple direct array children"
}
```

## Common Validation Errors

### Missing Column Reference
```
Column 'customer_email' not found in available columns.
Available columns: [customer_id, customer_name, email]
```
**Solution**: Update column mapping to use correct SQL column names.

### Invalid Parent Reference
```
Parent entity 'invalid_parent' not found for entity 'child_entity'
```
**Solution**: Ensure `parentId` references an existing entity ID.

### Multiple Array Children
```
Entity 'order' has multiple direct array children.
PostgreSQL JSON aggregation requires at most one array child per entity.
```
**Solution**: Restructure your hierarchy or use intermediate entities.

## Use Cases

*   **API Development**: Transform database queries into JSON APIs without manual serialization
*   **Reporting Systems**: Generate hierarchical reports from relational data
*   **Data Export**: Export complex relational data as JSON for external systems
*   **GraphQL Backends**: Efficiently resolve nested GraphQL queries
*   **Dashboard Data**: Prepare nested data structures for frontend dashboards

## Best Practices

1. **Keep Hierarchies Shallow**: Deeply nested structures can impact performance
2. **Validate Mappings**: Always test your mapping configurations thoroughly
3. **Handle NULLs**: Consider how NULL relationships should appear in your JSON
4. **Index Appropriately**: Ensure your base query has proper indexes for joins

By using `PostgresJsonQueryBuilder`, you can efficiently transform complex relational queries into clean, hierarchical JSON structures while maintaining optimal database performance.

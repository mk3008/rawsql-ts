# 🎯 Minimal PostgresJsonQueryBuilder Demo

**The World's Most Minimal Repository Code - Thanks to rawsql-ts!** ✨

This demo showcases how `PostgresJsonQueryBuilder` from rawsql-ts makes repository code incredibly minimal by automatically creating hierarchical JSON structures from complex SQL queries, while demonstrating proper `SqlParamInjector` usage for dynamic parameter injection.

## 🚀 What This Demo Shows

- **Zero Manual Object Mapping**: PostgresJsonQueryBuilder handles all JSON-to-TypeScript object conversion
- **Automatic Hierarchical Structures**: Complex nested objects and arrays created automatically  
- **Dynamic Parameter Injection**: SqlParamInjector adds WHERE conditions without hardcoding them in SQL
- **Minimal Repository Code**: Look how little code is needed compared to traditional approaches
- **Type-Safe Results**: Strongly typed TypeScript interfaces with zero boilerplate
- **Flexible Result Patterns**: Both array and single object returns demonstrated

## 📋 Quick Start

### Prerequisites
- Docker and Docker Compose
- Node.js and npm
- PostgreSQL client (for verification)

### Setup & Run

1. **Start the database:**
```bash
docker-compose up -d
```

2. **Install dependencies:**
```bash
npm install
```

3. **Run the minimal demo:**
```bash
npx ts-node minimal-demo.ts
```

## 🎪 Demo Results

### Before: Traditional Manual Mapping
```typescript
// Traditional approach - lots of boilerplate code
async findOrders() {
    const result = await db.query(sql);
    
    // Manual object construction 😫
    return result.rows.map(row => ({
        id: row.order_id,
        date: row.order_date,
        amount: row.total_amount,
        customer: {
            id: row.customer_id,
            name: row.customer_name,
            // ... more manual mapping
        },
        items: [] // Complex array grouping logic needed
    }));
}
```

### After: PostgresJsonQueryBuilder + SqlParamInjector Magic ✨
```typescript
// rawsql-ts approach - ZERO manual mapping + dynamic WHERE injection!
async findOrdersByStatus(status?: string): Promise<Order[]> {
    const sql = this.loadSqlFile('simple-orders-by-status.sql');
    let parsedQuery = SelectQueryParser.parse(sql) as SimpleSelectQuery;
    
    // SqlParamInjector dynamically adds WHERE conditions - no hardcoded params!
    if (status) {
        const injectedQuery = this.paramInjector.inject(parsedQuery, {
            whereConditions: [{ column: 'o.status', operator: '=', value: status }]
        });
        parsedQuery = injectedQuery;
    }
    
    // Define the hierarchical mapping (declarative, not imperative!)
    const mapping: JsonMapping = { /* mapping config */ };
    
    // Magic happens here - automatic hierarchical JSON creation!
    const jsonQuery = this.pgJsonBuilder.buildJson(parsedQuery, mapping);
    const formatted = this.formatter.format(jsonQuery);
    
    const result = await this.dbClient.query(formatted.formattedSql, [status]);
    
    // Already perfectly structured! No manual work needed! 🎉
    return this.extractJsonArrayResult<Order>(result);
}

async findOrdersById(orderId: number): Promise<Order | null> {
    // Same pattern but returns single object instead of array
    const result = await this.dbClient.query(formatted.formattedSql, [orderId]);
    return this.extractJsonObjectResult<Order>(result);
}
```

## 🎯 Key Benefits Demonstrated

1. **Dynamic Parameter Injection**: SQL files contain NO hardcoded WHERE clauses - SqlParamInjector adds them dynamically
2. **Automatic Nested Objects**: Customer data becomes nested object automatically
3. **Automatic Arrays**: Order items grouped into arrays with zero manual code  
4. **Generic Result Extraction**: Helper methods handle both array and single object patterns
5. **Type Safety**: Full TypeScript type safety maintained
6. **Performance**: Single optimized query with CTEs, not N+1 queries
7. **Maintainability**: Declarative mapping vs imperative object construction
8. **SQL Reusability**: Same SQL file works with or without WHERE conditions

## 🔍 What the Demo Output Shows

```
🔍 Demo 1: Finding orders by status (Array Result Pattern)...
Found 1 pending orders with full hierarchy:
- Order #4: John Doe - $99.99 (1 items)
  • Tablet x1 @ $99.99

� Demo 2: Finding single order by ID (Object Result Pattern)...
Found order #1:
- Order #1: John Doe - $158.97 (2 items)
  • Smartphone x1 @ $99.99
  • Wireless Headphones x1 @ $58.98
```

Notice how both demos show the complete hierarchical structure (customer object + items array), but one returns an array while the other returns a single object. PostgresJsonQueryBuilder created that hierarchy automatically with zero manual mapping code!

## 🛠 Files Structure

- `minimal-demo.ts` - The main demo showing minimal repository code with both array and object result patterns
- `queries/simple-orders-by-status.sql` - SQL template with WHERE_PLACEHOLDER for dynamic parameter injection  
- `docker-compose.yml` - PostgreSQL setup with sample data
- `init-db.sql` - Sample e-commerce database schema and data

## 🎉 The Bottom Line

**This is what rawsql-ts makes possible:**
- 90% less repository boilerplate code
- Zero manual JSON parsing or object construction  
- Dynamic WHERE clause injection without hardcoding parameters in SQL
- Automatic handling of complex relationships
- Generic result extraction patterns for both arrays and single objects
- Full type safety maintained
- Single optimized database queries
- SQL files remain reusable across different parameter scenarios

*Now that's what we call minimal! 🎯*

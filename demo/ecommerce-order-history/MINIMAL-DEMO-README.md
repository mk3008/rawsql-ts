# 🎯 Minimal PostgresJsonQueryBuilder Demo

**The World's Most Minimal Repository Code - Thanks to rawsql-ts!** ✨

This demo showcases how `PostgresJsonQueryBuilder` from rawsql-ts makes repository code incredibly minimal by automatically creating hierarchical JSON structures from complex SQL queries.

## 🚀 What This Demo Shows

- **Zero Manual Object Mapping**: PostgresJsonQueryBuilder handles all JSON-to-TypeScript object conversion
- **Automatic Hierarchical Structures**: Complex nested objects and arrays created automatically  
- **Minimal Repository Code**: Look how little code is needed compared to traditional approaches
- **Type-Safe Results**: Strongly typed TypeScript interfaces with zero boilerplate

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

### After: PostgresJsonQueryBuilder Magic ✨
```typescript
// rawsql-ts approach - ZERO manual mapping!
async findOrdersByStatus(status?: string): Promise<Order[]> {
    const sql = this.loadSqlFile('simple-orders-by-status.sql');
    const parsedQuery = SelectQueryParser.parse(sql) as SimpleSelectQuery;
    
    // Define the mapping (declarative, not imperative!)
    const mapping: JsonMapping = { /* mapping config */ };
    
    // Magic happens here - automatic hierarchical JSON creation!
    const jsonQuery = this.pgJsonBuilder.buildJson(parsedQuery, mapping);
    const formatted = this.formatter.format(jsonQuery);
    
    const result = await this.dbClient.query(formatted.formattedSql, [status]);
    
    // Already perfectly structured! No manual work needed! 🎉
    return result.rows[0]?.Orders_array || [];
}
```

## 🎯 Key Benefits Demonstrated

1. **Automatic Nested Objects**: Customer data becomes nested object automatically
2. **Automatic Arrays**: Order items grouped into arrays with zero manual code  
3. **Type Safety**: Full TypeScript type safety maintained
4. **Performance**: Single optimized query with CTEs, not N+1 queries
5. **Maintainability**: Declarative mapping vs imperative object construction

## 🔍 What the Demo Output Shows

```
🔍 Demo 1: Orders with nested customer & items (PostgresJsonQueryBuilder magic!)...
Found 1 pending orders with full hierarchy:
- Order #4: John Doe - $99.99 (1 items)
  • Tablet x1 @ $99.99

📋 Demo 2: Simple order list (regular SQL)...  
Simple order list (5 orders):
- Order #1: John Doe - $158.97
- Order #2: Jane Smith - $79.98
```

Notice how Demo 1 has the complete hierarchical structure (customer object + items array) while Demo 2 is just flat data. PostgresJsonQueryBuilder created that hierarchy automatically!

## 🛠 Files Structure

- `minimal-demo.ts` - The main demo showing minimal repository code
- `queries/simple-orders-by-status.sql` - SQL for hierarchical data  
- `queries/simple-order-list.sql` - SQL for flat comparison
- `docker-compose.yml` - PostgreSQL setup with sample data
- `init-db.sql` - Sample e-commerce database schema and data

## 🎉 The Bottom Line

**This is what rawsql-ts makes possible:**
- 90% less repository boilerplate code
- Zero manual JSON parsing or object construction  
- Automatic handling of complex relationships
- Full type safety maintained
- Single optimized database queries

*Now that's what we call minimal! 🎯*

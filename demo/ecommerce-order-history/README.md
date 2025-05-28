# E-commerce Order History Search Demo

This demo demonstrates how to use `rawsql-ts` to implement a comprehensive search feature for e-commerce order history with **real PostgreSQL database connectivity**. The demo showcases:

1. **Dynamic Parameter Injection** using `SqlParamInjector`
2. **Hierarchical JSON Results** using `PostgresJsonQueryBuilder`
3. **Real Database Operations** with PostgreSQL and Docker
4. **Complex Query Generation** with multiple search patterns
5. **Type-safe SQL Formatting** with PostgreSQL dialect support

## Prerequisites

- Node.js (v14 or higher)
- Docker and Docker Compose
- TypeScript/ts-node for running the demo

## Setup & Running

1. **Start the PostgreSQL database:**

   ```bash
   docker-compose up -d
   ```

   This will start a PostgreSQL instance and automatically initialize it with comprehensive sample data including customers, orders, and order items.

2. **Navigate to the demo directory:**

   ```bash
   cd demo/ecommerce-order-history
   ```

3. **Install demo-specific dependencies:**

   ```bash
   npm install
   ```

4. **Run the interactive demo:**

   ```bash
   npm start
   ```

   This will execute 6 different search scenarios and display both the generated SQL queries and the actual JSON results from the database.

## Database Schema

```
orders
  - order_id (PK)
  - order_date
  - customer_id (FK to customers)
  - total_amount
  - status

customers
  - customer_id (PK)
  - customer_name
  - email
  - address

order_items
  - order_item_id (PK)
  - order_id (FK to orders)
  - product_id
  - product_name
  - category_id
  - price
  - quantity
```

## Demo Features

The demo executes **6 comprehensive search scenarios** that demonstrate various capabilities:

### 🔍 Search Scenarios

1. **Customer ID Search** - Find all orders for a specific customer
2. **Date Range Search** - Find orders within a specific time period
3. **Category Search** - Find orders containing products from specific categories
4. **Amount Range Search** - Find orders within a specific price range
5. **Status Search** - Find orders with specific statuses (shipped, delivered, etc.)
6. **Combined Search** - Complex queries with multiple filters

### 💾 Real Database Integration

- **Actual PostgreSQL connectivity** using `pg` client library
- **Real data retrieval** with hierarchical JSON results
- **Production-ready error handling** and connection management
- **Parameterized queries** for SQL injection prevention

### 🎯 Generated Output

For each search scenario, you'll see:
- **Raw SQL Query** - The generated PostgreSQL query with CTEs
- **Parameters** - The injected parameter values
- **JSON Results** - The actual hierarchical data from the database

## Search Functionality

You can search orders using various filters:

- Customer ID: `{ customer_id: 1 }`
- Date range: `{ order_date: { min: new Date('2024-02-01'), max: new Date('2024-03-31') } }`
- Product category: `{ category_id: 3 }` or `{ category_id: { in: [1, 2, 3] } }`
- Amount range: `{ total_amount: { min: 100, max: 300 } }`
- Order status: `{ status: 'shipped' }` or `{ status: { in: ['shipped', 'delivered'] } }`

You can combine multiple filters in a single search query:

```typescript
const params = {
  customer_id: 1,
  order_date: {
    min: new Date('2024-01-01'),
    max: new Date('2024-03-31')
  },
  status: { in: ['shipped', 'delivered'] }
};
```

## Example Usage

The demo automatically runs through all search scenarios when you execute `npm start`. Here's what each scenario demonstrates:

```typescript
// Example 1: Search by customer ID
const result1 = await searchOrders(client, { customer_id: 1 });

// Example 2: Date range search
const result2 = await searchOrders(client, {
  order_date: {
    min: new Date('2024-02-01'),
    max: new Date('2024-03-31')
  }
});

// Example 3: Category search
const result3 = await searchOrders(client, { category_id: 3 });

// Example 4: Amount range search
const result4 = await searchOrders(client, {
  total_amount: { min: 100, max: 300 }
});

// Example 5: Status search
const result5 = await searchOrders(client, { status: 'shipped' });

// Example 6: Combined search with multiple filters
const result6 = await searchOrders(client, {
  customer_id: 1,
  order_date: {
    min: new Date('2024-01-01'),
    max: new Date('2024-03-31')
  },
  status: { in: ['shipped', 'delivered'] }
});
```

Each result contains:
- `formattedSql`: The generated PostgreSQL query
- `params`: The parameter values used in the query
- `data`: The actual JSON results from the database

## Expected Output

When you run the demo, you'll see detailed output for each search scenario including the complex CTE-based SQL queries and the hierarchical JSON results. The JSON structure includes nested customer and order items data, demonstrating the power of the `PostgresJsonQueryBuilder`.

## Clean Up

To stop the PostgreSQL container:

```bash
docker-compose down
```
# E-c2. **Hierarchical JSON Results** using `PostgresJsonQueryBuilder`mmerce Order History Search Demo

This demo demonstrates how to use `rawsql-ts` to implement a search feature for e-commerce order history. The demo showcases:

1. **Dynamic Parameter Injection** using `SqlParamInjector`
2. **Hierarchical JSON Results** using `PostgresJsonQueryBuilder`
3. **PostgreSQL Database** setup with Docker

## Prerequisites

- Node.js
- Docker and Docker Compose

## Setup

1. Start the PostgreSQL database:

   ```bash
   docker-compose up -d
   ```

   This will start a PostgreSQL instance and initialize it with sample data.

2. Install dependencies (if not already installed):

   ```bash
   npm install
   ```

3. Run the demo:

   ```bash
   npm run build
   node dist/demo/ecommerce-order-history/search-orders.js
   # OR in dev mode
   ts-node demo/ecommerce-order-history/search-orders.ts
   ```

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

Check the `search-orders.ts` file for example implementations.
import {
  SelectQueryParser,
  SqlParamInjector,
  SqlFormatter,
  PostgreJsonQueryBuilder,
  JsonMapping,
  SimpleSelectQuery
} from '../../src';

/**
 * Search orders with dynamic filtering using SqlParamInjector
 * and return results in hierarchical JSON structure using PostgreJsonQueryBuilder
 * 
 * This function demonstrates:
 * 1. Dynamic parameter injection for flexible search conditions
 * 2. Hierarchical JSON result structure with nested objects and arrays
 * 3. Support for various filter types (exact match, ranges, lists)
 * 
 * @param params Search parameters object with filter conditions
 * @returns Object containing formatted SQL and parameters
 */
function searchOrders(params: Record<string, any>) {
  // Base query to get order data
  const baseQuery = `
    SELECT 
      o.order_id,
      o.order_date,
      o.total_amount,
      o.status,
      c.customer_id,
      c.customer_name,
      c.email,
      c.address,
      oi.order_item_id,
      oi.product_id,
      oi.product_name,
      oi.category_id,
      oi.price,
      oi.quantity
    FROM 
      orders o
      LEFT JOIN customers c ON o.customer_id = c.customer_id
      LEFT JOIN order_items oi ON o.order_id = oi.order_id
  `;

  // Create injector and inject params
  const injector = new SqlParamInjector();
  const injectedQuery = injector.inject(baseQuery, params);

  // Build a hierarchical JSON structure using PostgreJsonQueryBuilder
  const builder = new PostgreJsonQueryBuilder();
  const mapping: JsonMapping = {
    rootName: "Orders",
    rootEntity: {
      id: "order",
      name: "Order",
      columns: {
        "id": "order_id",
        "date": "order_date",
        "amount": "total_amount",
        "status": "status"
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
          "email": "email",
          "address": "address"
        }
      },
      {
        id: "items",
        name: "OrderItem",
        parentId: "order",
        propertyName: "items",
        relationshipType: "array",
        columns: {
          "id": "order_item_id",
          "productId": "product_id",
          "productName": "product_name",
          "categoryId": "category_id",
          "price": "price",
          "quantity": "quantity"
        }
      }
    ],
    useJsonb: true
  };

  const jsonQuery = builder.buildJson(injectedQuery as SimpleSelectQuery, mapping);

  // Format the SQL
  const formatter = new SqlFormatter({ preset: 'postgres' });
  return formatter.format(jsonQuery);
}

// Example usage
console.log('Example 1: Search by customer ID');
const example1 = searchOrders({ customer_id: 1 });
console.log(example1.formattedSql);
console.log('Parameters:', example1.params);
console.log('\n');

console.log('Example 2: Search by date range');
const example2 = searchOrders({
  order_date: {
    min: new Date('2024-02-01'),
    max: new Date('2024-03-31')
  }
});
console.log(example2.formattedSql);
console.log('Parameters:', example2.params);
console.log('\n');

console.log('Example 3: Search by category');
const example3 = searchOrders({ category_id: 3 });
console.log(example3.formattedSql);
console.log('Parameters:', example3.params);
console.log('\n');

console.log('Example 4: Search by amount range');
const example4 = searchOrders({
  total_amount: {
    min: 100,
    max: 300
  }
});
console.log(example4.formattedSql);
console.log('Parameters:', example4.params);
console.log('\n');

console.log('Example 5: Search by status');
const example5 = searchOrders({ status: 'shipped' });
console.log(example5.formattedSql);
console.log('Parameters:', example5.params);
console.log('\n');

console.log('Example 6: Combined search');
const example6 = searchOrders({
  customer_id: 1,
  order_date: {
    min: new Date('2024-01-01'),
    max: new Date('2024-03-31')
  },
  status: { in: ['shipped', 'delivered'] }
});
console.log(example6.formattedSql);
console.log('Parameters:', example6.params);
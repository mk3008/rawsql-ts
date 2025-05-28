import {
    SelectQueryParser,
    SqlParamInjector,
    SqlFormatter,
    PostgresJsonQueryBuilder,
    JsonMapping,
    SimpleSelectQuery
} from '../../src';
import { Client } from 'pg';

/**
 * Database configuration for the demo PostgreSQL instance
 */
const DB_CONFIG = {
    host: 'localhost',
    port: 5432,
    database: 'ecommerce',
    user: 'postgres',
    password: 'postgres',
};

/**
 * Create and configure PostgreSQL client
 */
async function createDbClient(): Promise<Client> {
    const client = new Client(DB_CONFIG);
    await client.connect();
    console.log('🔗 Connected to PostgreSQL database');
    return client;
}

/**
 * Execute a query with parameters and return JSON results
 */
async function executeQuery(client: Client, sql: string, params: any[]): Promise<any> {
    try {
        console.log('🔍 Executing query...');
        console.log('SQL:', sql);
        console.log('Parameters:', params);

        const result = await client.query(sql, params);
        return result.rows;
    } catch (error) {
        console.error('❌ Query execution failed:', error);
        throw error;
    }
}

/**
 * Search orders with dynamic filtering using SqlParamInjector
 * and return results in hierarchical JSON structure using PostgresJsonQueryBuilder
 * 
 * This function demonstrates:
 * 1. Dynamic parameter injection for flexible search conditions
 * 2. Hierarchical JSON result structure with nested objects and arrays
 * 3. Support for various filter types (exact match, ranges, lists)
 * 4. Real database execution and JSON data retrieval
 * 
 * @param params Search parameters object with filter conditions
 * @returns Object containing formatted SQL and parameters
 */
async function searchOrders(client: Client, params: Record<string, any>) {
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
    // Build a hierarchical JSON structure using PostgresJsonQueryBuilder
    const builder = new PostgresJsonQueryBuilder();
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

    const jsonQuery = builder.buildJson(injectedQuery as SimpleSelectQuery, mapping);    // Format the SQL
    const formatter = new SqlFormatter({ preset: 'postgres' });
    const formattedQuery = formatter.format(jsonQuery);
    // Execute the query and get actual data
    const results = await executeQuery(client, formattedQuery.formattedSql, Object.values(formattedQuery.params));

    return {
        ...formattedQuery,
        data: results
    };
}

/**
 * Main demo function that demonstrates various search scenarios
 */
async function runDemo() {
    let client: Client | null = null;

    try {
        // Connect to database
        client = await createDbClient();

        console.log('🚀 Starting E-commerce Order History Search Demo\n');

        // Example 1: Search by customer ID
        console.log('📊 Example 1: Search by customer ID');
        console.log('=====================================');
        const example1 = await searchOrders(client, { customer_id: 1 });
        console.log('SQL:', example1.formattedSql);
        console.log('Parameters:', example1.params);
        console.log('Data:', JSON.stringify(example1.data, null, 2));
        console.log('\n');

        // Example 2: Search by date range
        console.log('📊 Example 2: Search by date range');
        console.log('==================================');
        const example2 = await searchOrders(client, {
            order_date: {
                min: new Date('2024-02-01'),
                max: new Date('2024-03-31')
            }
        });
        console.log('SQL:', example2.formattedSql);
        console.log('Parameters:', example2.params);
        console.log('Data:', JSON.stringify(example2.data, null, 2));
        console.log('\n');

        // Example 3: Search by category
        console.log('📊 Example 3: Search by category');
        console.log('================================');
        const example3 = await searchOrders(client, { category_id: 3 });
        console.log('SQL:', example3.formattedSql);
        console.log('Parameters:', example3.params);
        console.log('Data:', JSON.stringify(example3.data, null, 2));
        console.log('\n');

        // Example 4: Search by amount range
        console.log('📊 Example 4: Search by amount range');
        console.log('====================================');
        const example4 = await searchOrders(client, {
            total_amount: {
                min: 100,
                max: 300
            }
        });
        console.log('SQL:', example4.formattedSql);
        console.log('Parameters:', example4.params);
        console.log('Data:', JSON.stringify(example4.data, null, 2));
        console.log('\n');

        // Example 5: Search by status
        console.log('📊 Example 5: Search by status');
        console.log('==============================');
        const example5 = await searchOrders(client, { status: 'shipped' });
        console.log('SQL:', example5.formattedSql);
        console.log('Parameters:', example5.params);
        console.log('Data:', JSON.stringify(example5.data, null, 2));
        console.log('\n');

        // Example 6: Combined search
        console.log('📊 Example 6: Combined search');
        console.log('=============================');
        const example6 = await searchOrders(client, {
            customer_id: 1,
            order_date: {
                min: new Date('2024-01-01'),
                max: new Date('2024-03-31')
            },
            status: { in: ['shipped', 'delivered'] }
        });
        console.log('SQL:', example6.formattedSql);
        console.log('Parameters:', example6.params);
        console.log('Data:', JSON.stringify(example6.data, null, 2));

        console.log('\n🎉 Demo completed successfully!');

    } catch (error) {
        console.error('💥 Demo failed:', error);
        process.exit(1);
    } finally {
        // Close database connection
        if (client) {
            await client.end();
            console.log('🔌 Database connection closed');
        }
    }
}

// Run the demo
runDemo();
import { Client } from 'pg';
import { PostgresJsonQueryBuilder, JsonMapping } from '../../src/transformers/PostgresJsonQueryBuilder';
import { SqlParamInjector } from '../../src/transformers/SqlParamInjector';
import { SqlFormatter } from '../../src/transformers/SqlFormatter';
import { SelectQueryParser } from '../../src/parsers/SelectQueryParser';
import { SimpleSelectQuery } from '../../src/models/SimpleSelectQuery';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Minimal Demo: PostgresJsonQueryBuilder's Auto-Mapping Magic ✨
 * 
 * This demo shows how PostgresJsonQueryBuilder makes repository code
 * extremely minimal by automatically creating hierarchical JSON structures
 * from SQL query results with ZERO manual mapping code!
 */

// Database configuration
const DB_CONFIG = {
    host: 'localhost',
    port: 5432,
    database: 'ecommerce',
    user: 'postgres',
    password: 'postgres',
};

// Domain entities (what we get automatically mapped)
interface Order {
    id: number;
    date: string;
    amount: number;
    status: string;
    customer: Customer;
    items: OrderItem[];
}

interface OrderItem {
    id: number;
    productId: number;
    productName: string;
    categoryId: number;
    price: number;
    quantity: number;
}

interface Customer {
    id: number;
    name: string;
    email: string;
    address: string;
}

/**
 * The World's Most Minimal Repository Class 🎯
 * 
 * Look how little code we need! PostgresJsonQueryBuilder does all the heavy lifting:
 * - Automatic hierarchical JSON structure creation
 * - Zero manual object construction
 * - Complex nested relationships handled automatically
 */
class MinimalOrderRepository {
    private pgJsonBuilder: PostgresJsonQueryBuilder;
    private paramInjector: SqlParamInjector;
    private formatter: SqlFormatter;

    constructor(private dbClient: Client) {
        // Setup the magic builders - they handle ALL the mapping automatically!
        this.pgJsonBuilder = new PostgresJsonQueryBuilder();
        this.paramInjector = new SqlParamInjector();
        this.formatter = new SqlFormatter({ preset: 'postgres' });
    }

    /**
     * Find orders by status - ZERO manual mapping code! 🎉
     * PostgresJsonQueryBuilder automatically creates hierarchical JSON with nested objects and arrays
     */
    async findOrdersByStatus(status?: string): Promise<Order[]> {
        const sql = this.loadSqlFile('simple-orders-by-status.sql');        // First, use SqlParamInjector to dynamically inject WHERE conditions! 🎯
        // This is the rawsql-ts way - no hardcoded parameters in SQL files!
        const params = status ? { status } : {};
        const parsedQuery = SelectQueryParser.parse(sql) as SimpleSelectQuery;
        const injectedQuery = this.paramInjector.inject(parsedQuery, params) as SimpleSelectQuery;

        // Define the hierarchical mapping - this is where the magic happens! ✨
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

        // PostgresJsonQueryBuilder transforms the query to create hierarchical JSON! ✨
        const jsonQuery = this.pgJsonBuilder.buildJson(injectedQuery, mapping);
        const formatted = this.formatter.format(jsonQuery); console.log('🔍 Executing SQL with dynamic parameters:', formatted.formattedSql);
        console.log('📊 Parameters:', Object.values(formatted.params || {}));

        // Execute with dynamically injected parameters from SqlParamInjector!
        const result = await this.dbClient.query(formatted.formattedSql, Object.values(formatted.params || {}));

        // The result is already perfectly structured JSON! No manual mapping needed! 🎉
        return result.rows[0]?.Orders_array || [];
    }

    /**
     * Simple order search - just a basic flat structure example
     */
    async getSimpleOrders(): Promise<any[]> {
        const sql = this.loadSqlFile('simple-order-list.sql');

        console.log('📋 Executing simple SQL:', sql);
        const result = await this.dbClient.query(sql);

        return result.rows;
    }

    /**
     * Load SQL file helper
     */
    private loadSqlFile(filename: string): string {
        const filePath = path.join(__dirname, 'queries', filename);
        return fs.readFileSync(filePath, 'utf-8');
    }
}

/**
 * Demo execution - showing the magic in action! 🎪
 */
async function runMinimalDemo() {
    console.log('🚀 Starting Minimal PostgresJsonQueryBuilder Demo');
    console.log('================================================\n');

    const client = new Client(DB_CONFIG);

    try {
        await client.connect();
        console.log('✅ Connected to PostgreSQL\n');

        const repository = new MinimalOrderRepository(client);

        // Demo 1: Hierarchical JSON structure with auto-mapping
        console.log('🔍 Demo 1: Orders with nested customer & items (PostgresJsonQueryBuilder magic!)...');
        console.log('------------------------------------------------------------------------------');
        const pendingOrders = await repository.findOrdersByStatus('pending');

        console.log(`Found ${pendingOrders.length} pending orders with full hierarchy:`);
        pendingOrders.forEach(order => {
            console.log(`- Order #${order.id}: ${order.customer.name} - $${order.amount} (${order.items.length} items)`);
            order.items.forEach(item => {
                console.log(`  • ${item.productName} x${item.quantity} @ $${item.price}`);
            });
        });
        console.log('');

        // Demo 2: Simple flat structure  
        console.log('� Demo 2: Simple order list (regular SQL)...');
        console.log('----------------------------------------------');
        const simpleOrders = await repository.getSimpleOrders();

        console.log(`Simple order list (${simpleOrders.length} orders):`);
        simpleOrders.forEach(order => {
            console.log(`- Order #${order.order_id}: ${order.customer_name} - $${order.total_amount}`);
        });

        console.log('\n🎉 Demo completed! Notice the difference:');
        console.log('💡 PostgresJsonQueryBuilder created the hierarchical structure automatically:');
        console.log('   • Nested customer object with all fields');
        console.log('   • Array of order items automatically grouped');
        console.log('   • Zero manual JSON parsing or object construction!');
        console.log('   • Complex relationships handled seamlessly');

    } catch (error) {
        console.error('❌ Demo failed:', error);
    } finally {
        await client.end();
        console.log('\n🔌 Database connection closed');
    }
}

// Run the demo
if (require.main === module) {
    runMinimalDemo().catch(console.error);
}

export { runMinimalDemo, MinimalOrderRepository };

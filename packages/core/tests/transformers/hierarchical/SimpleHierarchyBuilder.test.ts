import { describe, it, expect } from 'vitest';
import { SelectQueryParser } from '../../../src/parsers/SelectQueryParser';
import { SimpleSelectQuery } from '../../../src/models/SimpleSelectQuery';
import { PostgresJsonQueryBuilder, JsonMapping } from '../../../src/transformers/PostgresJsonQueryBuilder';
import { SqlFormatter } from '../../../src/transformers/SqlFormatter';

// SQL formatting style configuration
const customStyle = {
    identifierEscape: {
        start: "\"",
        end: "\""
    },
    parameterSymbol: ":",
    parameterStyle: "named" as const,
    indentSize: 4,
    indentChar: " " as const,
    newline: "\n" as const,
    keywordCase: "lower" as const,
    commaBreak: "before" as const,
    andBreak: "before" as const
};

describe('SimpleHierarchyBuilder - Upstream (Object) Relationships', () => {

    describe('Flat JSON Array Generation', () => {
        it('should transform a query to a flat JSON array using JsonMapping', () => {
            const sql = "SELECT c.id AS CategoryId, c.name AS CategoryName FROM category AS c";
            const originalQuery = SelectQueryParser.parse(sql) as SimpleSelectQuery;

            const builder = new PostgresJsonQueryBuilder();
            const mapping: JsonMapping = {
                rootName: "Categories",
                rootEntity: {
                    id: "category",
                    name: "Category",
                    columns: {
                        "id": "CategoryId",
                        "name": "CategoryName"
                    }
                },
                nestedEntities: [],
                resultFormat: "array"
            };

            const jsonQuery = builder.buildJson(originalQuery, mapping);
            const formatter = new SqlFormatter(customStyle);
            const formattedSql = formatter.format(jsonQuery).formattedSql;            // jsonb_agg already returns empty array when no data, no coalesce needed
            const expectedSql = [
                `with`,
                `    "origin_query" as (`, // origin_query CTE remains the same
                `        select`,
                `            "c"."id" as "CategoryId"`,
                `            , "c"."name" as "CategoryName"`,
                `        from`,
                `            "category" as "c"`,
                `    )`,
                `    , "cte_root_categories" as (`, // New CTE for root object construction
                `        select`,
                `            jsonb_build_object('id', "CategoryId", 'name', "CategoryName") as "Categories"`,
                `        from`,
                `            "origin_query"`,
                `    )`,
                `select`,
                `    jsonb_agg("Categories") as "Categories_array"`, // Aggregates from the new CTE
                `from`,
                `    "cte_root_categories"`
            ].join('\n');

            expect(formattedSql).toBe(expectedSql);
        });

        it('should transform a query to a single JSON object with JsonMapping', () => {
            const sql = `
                select
                    p.id as ProductId,
                    p.name as ProductName,
                    p.price
                from
                    product as p
                where
                    p.id = 1
            `;
            const originalQuery = SelectQueryParser.parse(sql) as SimpleSelectQuery;

            const builder = new PostgresJsonQueryBuilder();
            const mapping: JsonMapping = {
                rootName: "ProductDetail",
                rootEntity: {
                    id: "product",
                    name: "Product",
                    columns: {
                        "id": "ProductId",
                        "name": "ProductName",
                        "price": "price"
                    }
                },
                nestedEntities: [],
                resultFormat: "single",
                emptyResult: "null"
            };

            const jsonQuery = builder.buildJson(originalQuery, mapping);
            const formatter = new SqlFormatter(customStyle);
            const formattedSql = formatter.format(jsonQuery).formattedSql;            // Single object also doesn't need coalesce - empty result set is fine
            const expectedSql = [
                `with`,
                `    "origin_query" as (`, // origin_query CTE remains the same
                `        select`,
                `            "p"."id" as "ProductId"`,
                `            , "p"."name" as "ProductName"`,
                `            , "p"."price"`,
                `        from`,
                `            "product" as "p"`,
                `        where`,
                `            "p"."id" = 1`,
                `    )`,
                `    , "cte_root_productdetail" as (`, // New CTE for root object construction
                `        select`,
                `            jsonb_build_object('id', "ProductId", 'name', "ProductName", 'price', "price") as "ProductDetail"`,
                `        from`,
                `            "origin_query"`,
                `    )`,
                `select`,
                `    "ProductDetail"`, // Selects directly from the new CTE's column
                `from`,
                `    "cte_root_productdetail"`,
                `limit`,
                `    1`
            ].join('\n');

            expect(formattedSql).toBe(expectedSql);
        });
    });

    describe('Simple Object Relationships', () => {
        it('should handle simple upstream relationship: Order with Customer', () => {
            const sql = `
                select
                    order_id,
                    order_date,
                    order_amount,
                    customer_id,
                    customer_name,
                    customer_email
                from
                    order_customer_view
            `;
            const originalQuery = SelectQueryParser.parse(sql) as SimpleSelectQuery;

            const builder = new PostgresJsonQueryBuilder();
            const mapping: JsonMapping = {
                rootName: "Orders",
                rootEntity: {
                    id: "order",
                    name: "Order",
                    columns: {
                        "id": "order_id",
                        "date": "order_date",
                        "amount": "order_amount"
                    }
                },
                nestedEntities: [
                    {
                        id: "customer",
                        name: "Customer",
                        parentId: "order",
                        propertyName: "customer",
                        relationshipType: "object", // Order has one Customer (upstream)
                        columns: {
                            "id": "customer_id",
                            "name": "customer_name",
                            "email": "customer_email"
                        }
                    }
                ],
            };

            const jsonQuery = builder.buildJson(originalQuery, mapping);
            const formatter = new SqlFormatter(customStyle);
            const formattedSql = formatter.format(jsonQuery).formattedSql;

            const expectedSql = [
                `with`,
                `    "origin_query" as (`, // origin_query CTE remains the same
                `        select`,
                `            "order_id"`,
                `            , "order_date"`,
                `            , "order_amount"`,
                `            , "customer_id"`,
                `            , "customer_name"`,
                `            , "customer_email"`,
                `        from`,
                `            "order_customer_view"`,
                `    )`,
                `    , "cte_object_depth_1" as (`,  // Process Customer (depth 1)
                `        select`,
                `            *`,
                `            , case`,
                `                when "customer_id" is null`,
                `                and "customer_name" is null`,
                `                and "customer_email" is null then`,
                `                    null`,
                `                else`,
                `                    jsonb_build_object('id', "customer_id", 'name', "customer_name", 'email', "customer_email")`,
                `            end as "customer_json_1"`,
                `        from`,
                `            "origin_query"`,
                `    )`,
                `    , "cte_root_orders" as (`,  // Build root Order with Customer
                `        select`,
                `            jsonb_build_object('id', "order_id", 'date', "order_date", 'amount', "order_amount", 'customer', "customer_json_1") as "Orders"`,
                `        from`,
                `            "cte_object_depth_1"`,
                `    )`,
                `select`,
                `    jsonb_agg("Orders") as "Orders_array"`,
                `from`,
                `    "cte_root_orders"`
            ].join('\n');

            expect(formattedSql).toBe(expectedSql);
        });

        it('should handle nested object relationships: Order > Customer > Address', () => {
            const sql = `
                select
                    order_id,
                    order_date,
                    customer_id,
                    customer_name,
                    address_id,
                    address_street,
                    address_city
                from
                    order_customer_address_view
            `;
            const originalQuery = SelectQueryParser.parse(sql) as SimpleSelectQuery;

            const builder = new PostgresJsonQueryBuilder();
            const mapping: JsonMapping = {
                rootName: "Orders",
                rootEntity: {
                    id: "order",
                    name: "Order",
                    columns: {
                        "id": "order_id",
                        "date": "order_date"
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
                            "name": "customer_name"
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
                            "street": "address_street",
                            "city": "address_city"
                        }
                    }
                ],
            };

            const jsonQuery = builder.buildJson(originalQuery, mapping);
            const formatter = new SqlFormatter(customStyle);
            const formattedSql = formatter.format(jsonQuery).formattedSql;

            const expectedSql = [
                `with`,
                `    "origin_query" as (`, // origin_query CTE remains the same
                `        select`,
                `            "order_id"`,
                `            , "order_date"`,
                `            , "customer_id"`,
                `            , "customer_name"`,
                `            , "address_id"`,
                `            , "address_street"`,
                `            , "address_city"`,
                `        from`,
                `            "order_customer_address_view"`,
                `    )`,
                `    , "cte_object_depth_2" as (`,  // Process Address first (deepest level)
                `        select`,
                `            *`,
                `            , case`,
                `                when "address_id" is null`,
                `                and "address_street" is null`,
                `                and "address_city" is null then`,
                `                    null`,
                `                else`,
                `                    jsonb_build_object('id', "address_id", 'street', "address_street", 'city', "address_city")`,
                `            end as "address_json_1"`,
                `        from`,
                `            "origin_query"`,
                `    )`,
                `    , "cte_object_depth_1" as (`,  // Process Customer with Address
                `        select`,
                `            *`,
                `            , case`,
                `                when "customer_id" is null`,
                `                and "customer_name" is null then`,
                `                    null`,
                `                else`,
                `                    jsonb_build_object('id', "customer_id", 'name', "customer_name", 'address', "address_json_1")`,
                `            end as "customer_json_2"`,
                `        from`,
                `            "cte_object_depth_2"`,
                `    )`,
                `    , "cte_root_orders" as (`,  // Build root Order with Customer
                `        select`,
                `            jsonb_build_object('id', "order_id", 'date', "order_date", 'customer', "customer_json_2") as "Orders"`,
                `        from`,
                `            "cte_object_depth_1"`,
                `    )`,
                `select`,
                `    jsonb_agg("Orders") as "Orders_array"`,
                `from`,
                `    "cte_root_orders"`
            ].join('\n');

            expect(formattedSql).toBe(expectedSql);
        });

        it('should handle multiple object relationships: Product with Category and Supplier', () => {
            const sql = `
                select
                    product_id,
                    product_name,
                    product_price,
                    category_id,
                    category_name,
                    supplier_id,
                    supplier_name,
                    supplier_contact
                from
                    product_details_view
            `;
            const originalQuery = SelectQueryParser.parse(sql) as SimpleSelectQuery;

            const builder = new PostgresJsonQueryBuilder();
            const mapping: JsonMapping = {
                rootName: "Products",
                rootEntity: {
                    id: "product",
                    name: "Product",
                    columns: {
                        "id": "product_id",
                        "name": "product_name",
                        "price": "product_price"
                    }
                },
                nestedEntities: [
                    {
                        id: "category",
                        name: "Category",
                        parentId: "product",
                        propertyName: "category",
                        relationshipType: "object",
                        columns: {
                            "id": "category_id",
                            "name": "category_name"
                        }
                    },
                    {
                        id: "supplier",
                        name: "Supplier",
                        parentId: "product",
                        propertyName: "supplier",
                        relationshipType: "object",
                        columns: {
                            "id": "supplier_id",
                            "name": "supplier_name",
                            "contact": "supplier_contact"
                        }
                    }
                ],
            };

            const jsonQuery = builder.buildJson(originalQuery, mapping);
            const formatter = new SqlFormatter(customStyle);
            const formattedSql = formatter.format(jsonQuery).formattedSql;

            const expectedSql = [
                `with`,
                `    "origin_query" as (`, // origin_query CTE remains the same
                `        select`,
                `            "product_id"`,
                `            , "product_name"`,
                `            , "product_price"`,
                `            , "category_id"`,
                `            , "category_name"`,
                `            , "supplier_id"`,
                `            , "supplier_name"`,
                `            , "supplier_contact"`,
                `        from`,
                `            "product_details_view"`,
                `    )`,
                `    , "cte_object_depth_1" as (`,  // Process both Category and Supplier at depth 1
                `        select`,
                `            *`,
                `            , case`,
                `                when "category_id" is null`,
                `                and "category_name" is null then`,
                `                    null`,
                `                else`,
                `                    jsonb_build_object('id', "category_id", 'name', "category_name")`,
                `            end as "category_json_1"`,
                `            , case`,
                `                when "supplier_id" is null`,
                `                and "supplier_name" is null`,
                `                and "supplier_contact" is null then`,
                `                    null`,
                `                else`,
                `                    jsonb_build_object('id', "supplier_id", 'name', "supplier_name", 'contact', "supplier_contact")`,
                `            end as "supplier_json_2"`,
                `        from`,
                `            "origin_query"`,
                `    )`,
                `    , "cte_root_products" as (`,  // Build root Product with Category and Supplier
                `        select`,
                `            jsonb_build_object('id', "product_id", 'name', "product_name", 'price', "product_price", 'category', "category_json_1", 'supplier', "supplier_json_2") as "Products"`,
                `        from`,
                `            "cte_object_depth_1"`,
                `    )`,
                `select`,
                `    jsonb_agg("Products") as "Products_array"`,
                `from`,
                `    "cte_root_products"`
            ].join('\n');

            expect(formattedSql).toBe(expectedSql);
        });
    });
});

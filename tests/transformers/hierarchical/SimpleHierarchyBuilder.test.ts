import { describe, it, expect } from 'vitest';
import { SelectQueryParser } from '../../../src/parsers/SelectQueryParser';
import { SimpleSelectQuery } from '../../../src/models/SimpleSelectQuery';
import { PostgreJsonQueryBuilder, JsonMapping } from '../../../src/transformers/PostgreJsonQueryBuilder';
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

            const builder = new PostgreJsonQueryBuilder();
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
                useJsonb: true,
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

            const builder = new PostgreJsonQueryBuilder();
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
                useJsonb: true,
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

            const builder = new PostgreJsonQueryBuilder();
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
                useJsonb: true
            }; const jsonQuery = builder.buildJson(originalQuery, mapping);
            const formatter = new SqlFormatter(customStyle);
            const formattedSql = formatter.format(jsonQuery).formattedSql;            // Array format doesn't need coalesce either
            const expectedSql = [
                `with`,
                `    "origin_query" as (`,
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
                `    , "cte_customers" as (`,
                `        select`,
                `            "customer_id"`,
                `            , "customer_name"`,
                `            , "customer_email"`,
                `            , jsonb_build_object('id', "customer_id", 'name', "customer_name", 'email', "customer_email") as "customer_json"`,
                `        from`,
                `            "origin_query"`,
                `        group by`,
                `            "customer_id"`,
                `            , "customer_name"`,
                `            , "customer_email"`,
                `    )`,
                `    , "cte_root_orders" as (`,
                `        select`,
                `            case`,
                `                when "order_id" is null`,
                `                and "order_date" is null`,
                `                and "order_amount" is null`,
                `                and "customer_id" is null`,
                `                and "customer_name" is null`,
                `                and "customer_email" is null then`,
                `                    null`,
                `                else`,
                `                    jsonb_build_object('id', "order_id", 'date', "order_date", 'amount', "order_amount", 'customer', "cte_customers"."customer_json")`,
                `            end as "Orders"`,
                `        from`,
                `            "origin_query"`,
                `        left join`,
                `            "cte_customers"`,
                `        on`,
                `            "origin_query"."customer_id" = "cte_customers"."customer_id"`,
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

            const builder = new PostgreJsonQueryBuilder();
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
                useJsonb: true
            };

            const jsonQuery = builder.buildJson(originalQuery, mapping);
            const formatter = new SqlFormatter(customStyle);
            const formattedSql = formatter.format(jsonQuery).formattedSql; const expectedSql = [
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
                `    , "cte_parent_depth_2" as (`,  // Process Address first (deepest level)
                `        select`,
                `            *`,
                `            , case`,
                `                when "address_id" is null`,
                `                and "address_street" is null`,
                `                and "address_city" is null then`,
                `                    null`,
                `                else`,
                `                    jsonb_build_object('id', "address_id", 'street', "address_street", 'city', "address_city")`,
                `            end as "address_json"`,
                `        from`,
                `            "origin_query"`,
                `    )`,
                `    , "cte_parent_depth_1" as (`,  // Process Customer with Address
                `        select`,
                `            *`,
                `            , case`,
                `                when "customer_id" is null`,
                `                and "customer_name" is null then`,
                `                    null`,
                `                else`,
                `                    jsonb_build_object('id', "customer_id", 'name', "customer_name", 'address', "address_json")`,
                `            end as "customer_json"`,
                `        from`,
                `            "cte_parent_depth_2"`,
                `    )`,
                `    , "cte_root_orders" as (`,  // Build root Order with Customer
                `        select`,
                `            jsonb_build_object('id', "order_id", 'date', "order_date", 'customer', "customer_json") as "Orders"`,
                `        from`,
                `            "cte_parent_depth_1"`,
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

            const builder = new PostgreJsonQueryBuilder();
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
                useJsonb: true
            };

            const jsonQuery = builder.buildJson(originalQuery, mapping);
            const formatter = new SqlFormatter(customStyle);
            const formattedSql = formatter.format(jsonQuery).formattedSql; const expectedSql = [
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
                `    , "cte_root_products" as (`, // New CTE for root object construction
                `        select`,
                `            case`,
                `                when "product_id" is null`,
                `                and "product_name" is null`,
                `                and "product_price" is null`,
                `                and "category_id" is null`, // Category fields
                `                and "category_name" is null`,
                `                and "supplier_id" is null`, // Supplier fields
                `                and "supplier_name" is null`,
                `                and "supplier_contact" is null then`,
                `                    null`,
                `                else`,
                `                    jsonb_build_object('id', "product_id", 'name', "product_name", 'price', "product_price", 'category', case`,
                `                        when "category_id" is null`,
                `                        and "category_name" is null then`,
                `                            null`,
                `                        else`,
                `                            jsonb_build_object('id', "category_id", 'name', "category_name")`,
                `                    end, 'supplier', case`,
                `                        when "supplier_id" is null`,
                `                        and "supplier_name" is null`,
                `                        and "supplier_contact" is null then`,
                `                            null`,
                `                        else`,
                `                            jsonb_build_object('id', "supplier_id", 'name', "supplier_name", 'contact', "supplier_contact")`,
                `                    end)`,
                `            end as "Products"`,
                `        from`,
                `            "origin_query"`,
                `    )`,
                `select`,
                `    jsonb_agg("Products") as "Products_array"`,
                `from`,
                `    "cte_root_products"`
            ].join('\n');

            expect(formattedSql).toBe(expectedSql);
        });

        it('should validate parent relationships and throw error for invalid parentId', () => {
            const sql = "SELECT id, name FROM test";
            const originalQuery = SelectQueryParser.parse(sql) as SimpleSelectQuery;

            const builder = new PostgreJsonQueryBuilder();
            const mapping: JsonMapping = {
                rootName: "Test",
                rootEntity: {
                    id: "root",
                    name: "Root",
                    columns: { "id": "id" }
                },
                nestedEntities: [
                    {
                        id: "child",
                        name: "Child",
                        parentId: "nonexistent",
                        propertyName: "child",
                        relationshipType: "object",
                        columns: { "name": "name" }
                    }
                ],
                useJsonb: true
            };

            expect(() => {
                builder.buildJson(originalQuery, mapping);
            }).toThrow('Validation Error: Parent entity with ID "nonexistent" for nested entity "Child" (ID: child) not found.');
        });

        it('should handle 2-level hierarchical structure: Product > Category (upstream)', () => {
            const sql = `
                select
                    product_id,
                    product_name,
                    category_id,
                    category_name
                from
                    catalog_report
            `;
            const originalQuery = SelectQueryParser.parse(sql) as SimpleSelectQuery;

            const builder = new PostgreJsonQueryBuilder();
            const mapping: JsonMapping = {
                rootName: "Products",
                rootEntity: {
                    id: "product",
                    name: "Product",
                    columns: {
                        "id": "product_id",
                        "name": "product_name"
                    }
                },
                nestedEntities: [
                    {
                        id: "category",
                        name: "Category",
                        parentId: "product",
                        propertyName: "category",
                        relationshipType: "object", // Product has one Category
                        columns: {
                            "id": "category_id",
                            "name": "category_name"
                        }
                    }
                ],
                useJsonb: true
            };

            const jsonQuery = builder.buildJson(originalQuery, mapping);
            const formatter = new SqlFormatter(customStyle);
            const formattedSql = formatter.format(jsonQuery).formattedSql; const expectedSql = [
                `with`,
                `    "origin_query" as (`, // origin_query CTE remains the same
                `        select`,
                `            "product_id"`,
                `            , "product_name"`,
                `            , "category_id"`,
                `            , "category_name"`,
                `        from`,
                `            "catalog_report"`,
                `    )`,
                `    , "cte_root_products" as (`, // New CTE for root object construction
                `        select`,
                `            case`,
                `                when "product_id" is null`,
                `                and "product_name" is null`,
                `                and "category_id" is null`, // Category fields
                `                and "category_name" is null then`,
                `                    null`,
                `                else`,
                `                    jsonb_build_object('id', "product_id", 'name', "product_name", 'category', case`,
                `                        when "category_id" is null`,
                `                        and "category_name" is null then`,
                `                            null`,
                `                        else`,
                `                            jsonb_build_object('id', "category_id", 'name', "category_name")`,
                `                    end)`,
                `            end as "Products"`,
                `        from`,
                `            "origin_query"`,
                `    )`,
                `select`,
                `    jsonb_agg("Products") as "Products_array"`,
                `from`,
                `    "cte_root_products"`
            ].join('\n');

            expect(formattedSql).toBe(expectedSql);
        });

        it('should handle 3-level hierarchical structure: Review > Product > Category', () => {
            const sql = `
                select
                    review_id,
                    review_text,
                    rating,
                    product_id,
                    product_name,
                    product_price,
                    category_id,
                    category_name
                from
                    review_details
            `;
            const originalQuery = SelectQueryParser.parse(sql) as SimpleSelectQuery;

            const builder = new PostgreJsonQueryBuilder();
            const mapping: JsonMapping = {
                rootName: "Reviews",
                rootEntity: {
                    id: "review",
                    name: "Review",
                    columns: {
                        "id": "review_id",
                        "text": "review_text",
                        "rating": "rating"
                    }
                },
                nestedEntities: [
                    {
                        id: "product",
                        name: "Product",
                        parentId: "review",
                        propertyName: "product",
                        relationshipType: "object", // Review has one Product
                        columns: {
                            "id": "product_id",
                            "name": "product_name",
                            "price": "product_price"
                        }
                    },
                    {
                        id: "category",
                        name: "Category",
                        parentId: "product",
                        propertyName: "category",
                        relationshipType: "object", // Product has one Category
                        columns: {
                            "id": "category_id",
                            "name": "category_name"
                        }
                    }
                ],
                useJsonb: true
            };

            const jsonQuery = builder.buildJson(originalQuery, mapping);
            const formatter = new SqlFormatter(customStyle);
            const formattedSql = formatter.format(jsonQuery).formattedSql; const expectedSql = [
                `with`,
                `    "origin_query" as (`, // origin_query CTE remains the same
                `        select`,
                `            "review_id"`,
                `            , "review_text"`,
                `            , "rating"`,
                `            , "product_id"`,
                `            , "product_name"`,
                `            , "product_price"`,
                `            , "category_id"`,
                `            , "category_name"`,
                `        from`,
                `            "review_details"`,
                `    )`,
                `    , "cte_root_reviews" as (`, // New CTE for root object construction
                `        select`,
                `            case`,
                `                when "review_id" is null`, // Review fields
                `                and "review_text" is null`,
                `                and "rating" is null`,
                `                and "product_id" is null`, // Product fields
                `                and "product_name" is null`,
                `                and "product_price" is null`,
                `                and "category_id" is null`, // Category fields
                `                and "category_name" is null then`,
                `                    null`,
                `                else`,
                `                    jsonb_build_object('id', "review_id", 'text', "review_text", 'rating', "rating", 'product', case`,
                `                        when "product_id" is null`, // Product fields for product object
                `                        and "product_name" is null`,
                `                        and "product_price" is null`,
                `                        and "category_id" is null`, // Category fields for product object
                `                        and "category_name" is null then`,
                `                            null`,
                `                        else`,
                `                            jsonb_build_object('id', "product_id", 'name', "product_name", 'price', "product_price", 'category', case`,
                `                                when "category_id" is null`, // Category fields for address object
                `                                and "category_name" is null then`,
                `                                    null`,
                `                                else`,
                `                                    jsonb_build_object('id', "category_id", 'name', "category_name")`,
                `                            end)`,
                `                    end)`,
                `            end as "Reviews"`,
                `        from`,
                `            "origin_query"`,
                `    )`,
                `select`,
                `    jsonb_agg("Reviews") as "Reviews_array"`,
                `from`,
                `    "cte_root_reviews"`
            ].join('\n');

            expect(formattedSql).toBe(expectedSql);
        });

        it('should handle LEFT JOIN with null parent objects correctly', () => {
            const sql = `
                select
                    order_id,
                    order_date,
                    order_amount,
                    customer_id,
                    customer_name,
                    customer_email
                from
                    orders o
                left join customers c on o.customer_id = c.id
            `;
            const originalQuery = SelectQueryParser.parse(sql) as SimpleSelectQuery;

            const builder = new PostgreJsonQueryBuilder();
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
                        relationshipType: "object",
                        columns: {
                            "id": "customer_id",
                            "name": "customer_name",
                            "email": "customer_email"
                        }
                    }
                ],
                useJsonb: true
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
                `            "orders" as "o"`,
                `            left join "customers" as "c" on "o"."customer_id" = "c"."id"`,
                `    )`,
                `    , "cte_root_orders" as (`, // New CTE for root object construction
                `        select`,
                `            case`,
                `                when "order_id" is null`,
                `                and "order_date" is null`,
                `                and "order_amount" is null`,
                `                and "customer_id" is null`, // Added for nested object
                `                and "customer_name" is null`, // Added for nested object
                `                and "customer_email" is null then`, // Added for nested object
                `                    null`,
                `                else`,
                `                    jsonb_build_object('id', "order_id", 'date', "order_date", 'amount', "order_amount", 'customer', case`,
                `                        when "customer_id" is null`,
                `                        and "customer_name" is null`,
                `                        and "customer_email" is null then`,
                `                            null`,
                `                        else`,
                `                            jsonb_build_object('id', "customer_id", 'name', "customer_name", 'email', "customer_email")`,
                `                    end)`,
                `            end as "Orders"`,
                `        from`,
                `            "origin_query"`,
                `    )`,
                `select`,
                `    jsonb_agg("Orders") as "Orders_array"`,
                `from`,
                `    "cte_root_orders"`
            ].join('\n');

            expect(formattedSql).toBe(expectedSql);
        });

        it('should demonstrate the null parent object issue', () => {
            // This test demonstrates the current behavior vs desired behavior
            const sql = `
                select
                    1 as order_id,
                    '2024-01-01' as order_date,
                    null::int as customer_id,
                    null::text as customer_name,
                    null::text as customer_email
            `;
            const originalQuery = SelectQueryParser.parse(sql) as SimpleSelectQuery;

            const builder = new PostgreJsonQueryBuilder();
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
                            "name": "customer_name",
                            "email": "customer_email"
                        }
                    }
                ],
                useJsonb: true
            };

            const jsonQuery = builder.buildJson(originalQuery, mapping);
            const formatter = new SqlFormatter(customStyle);
            const formattedSql = formatter.format(jsonQuery).formattedSql;            // Enhanced result will be: {"id": 1, "date": "2024-01-01", "customer": null}
            // This demonstrates the improved null detection logic

            const expectedSql = [
                `with`,
                `    "origin_query" as (`, // origin_query CTE remains the same
                `        select`,
                `            1 as "order_id"`,
                `            , '2024-01-01' as "order_date"`,
                `            , null::int as "customer_id"`,
                `            , null::text as "customer_name"`,
                `            , null::text as "customer_email"`,
                `    )`,
                `    , "cte_root_orders" as (`, // New CTE for root object construction
                `        select`,
                `            case`,
                `                when "order_id" is null`, // Order fields
                `                and "order_date" is null`,
                `                and "customer_id" is null`,
                `                and "customer_name" is null`,
                `                and "customer_email" is null then`,
                `                    null`,
                `                else`,
                `                    jsonb_build_object('id', "order_id", 'date', "order_date", 'customer', case`,
                `                        when "customer_id" is null`, // Customer fields for customer object itself
                `                        and "customer_name" is null`,
                `                        and "customer_email" is null then`,
                `                            null`,
                `                        else`,
                `                            jsonb_build_object('id', "customer_id", 'name', "customer_name", 'email', "customer_email")`,
                `                    end)`,
                `            end as "Orders"`,
                `        from`,
                `            "origin_query"`,
                `    )`,
                `select`,
                `    jsonb_agg("Orders") as "Orders_array"`,
                `from`,
                `    "cte_root_orders"`
            ].join('\n');

            expect(formattedSql).toBe(expectedSql);
        });
    });
});
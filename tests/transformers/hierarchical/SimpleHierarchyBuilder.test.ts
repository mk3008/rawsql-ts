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
            const formattedSql = formatter.format(jsonQuery).formattedSql;

            // jsonb_agg already returns empty array when no data, no coalesce needed
            const expectedSql = [
                `select`,
                `    jsonb_agg(jsonb_build_object('id', "_sub"."CategoryId", 'name', "_sub"."CategoryName")) as "Categories"`,
                `from`,
                `    (`,

                `        select`,
                `            "c"."id" as "CategoryId"`,
                `            , "c"."name" as "CategoryName"`,
                `        from`,
                `            "category" as "c"`,
                `    ) as "_sub"`
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
            const formattedSql = formatter.format(jsonQuery).formattedSql;

            // Single object also doesn't need coalesce - empty result set is fine
            const expectedSql = [
                `select`,
                `    jsonb_build_object('id', "_sub"."ProductId", 'name', "_sub"."ProductName", 'price', "_sub"."price") as "ProductDetail"`,
                `from`,
                `    (`,

                `        select`,
                `            "p"."id" as "ProductId"`,
                `            , "p"."name" as "ProductName"`,
                `            , "p"."price"`,
                `        from`,
                `            "product" as "p"`,
                `        where`,
                `            "p"."id" = 1`,
                `    ) as "_sub"`,
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
            };

            const jsonQuery = builder.buildJson(originalQuery, mapping);
            const formatter = new SqlFormatter(customStyle);
            const formattedSql = formatter.format(jsonQuery).formattedSql;            // Array format doesn't need coalesce either
            const expectedSql = [
                `select`,
                `    jsonb_agg(jsonb_build_object('id', "_sub"."order_id", 'date', "_sub"."order_date", 'amount', "_sub"."order_amount", 'customer', case`,
                `        when "_sub"."customer_id" is null`,
                `        and "_sub"."customer_name" is null`,
                `        and "_sub"."customer_email" is null then`,
                `            null`,
                `        else`,
                `            jsonb_build_object('id', "_sub"."customer_id", 'name', "_sub"."customer_name", 'email', "_sub"."customer_email")`,
                `    end)) as "Orders"`,
                `from`,
                `    (`,
                `        select`,
                `            "order_id"`,
                `            , "order_date"`,
                `            , "order_amount"`,
                `            , "customer_id"`,
                `            , "customer_name"`,
                `            , "customer_email"`,
                `        from`,
                `            "order_customer_view"`,
                `    ) as "_sub"`
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
                `select`,
                `    jsonb_agg(jsonb_build_object('id', "_sub"."order_id", 'date', "_sub"."order_date", 'customer', case`,
                `        when "_sub"."customer_id" is null`,
                `        and "_sub"."customer_name" is null then`,
                `            null`,
                `        else`,
                `            jsonb_build_object('id', "_sub"."customer_id", 'name', "_sub"."customer_name", 'address', case`,
                `                when "_sub"."address_id" is null`,
                `                and "_sub"."address_street" is null`,
                `                and "_sub"."address_city" is null then`,
                `                    null`,
                `                else`,
                `                    jsonb_build_object('id', "_sub"."address_id", 'street', "_sub"."address_street", 'city', "_sub"."address_city")`,
                `            end)`,
                `    end)) as "Orders"`,
                `from`,
                `    (`,
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
                `    ) as "_sub"`
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
                `select`,
                `    jsonb_agg(jsonb_build_object('id', "_sub"."product_id", 'name', "_sub"."product_name", 'price', "_sub"."product_price", 'category', case`,
                `        when "_sub"."category_id" is null`,
                `        and "_sub"."category_name" is null then`,
                `            null`,
                `        else`,
                `            jsonb_build_object('id', "_sub"."category_id", 'name', "_sub"."category_name")`,
                `    end, 'supplier', case`,
                `        when "_sub"."supplier_id" is null`,
                `        and "_sub"."supplier_name" is null`,
                `        and "_sub"."supplier_contact" is null then`,
                `            null`,
                `        else`,
                `            jsonb_build_object('id', "_sub"."supplier_id", 'name', "_sub"."supplier_name", 'contact', "_sub"."supplier_contact")`,
                `    end)) as "Products"`,
                `from`,
                `    (`,
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
                `    ) as "_sub"`
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
            }).toThrow("Parent entity 'nonexistent' not found for entity 'child'");
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
                `select`,
                `    jsonb_agg(jsonb_build_object('id', "_sub"."product_id", 'name', "_sub"."product_name", 'category', case`,
                `        when "_sub"."category_id" is null`,
                `        and "_sub"."category_name" is null then`,
                `            null`,
                `        else`,
                `            jsonb_build_object('id', "_sub"."category_id", 'name', "_sub"."category_name")`,
                `    end)) as "Products"`,
                `from`,
                `    (`,
                `        select`,
                `            "product_id"`,
                `            , "product_name"`,
                `            , "category_id"`,
                `            , "category_name"`,
                `        from`,
                `            "catalog_report"`,
                `    ) as "_sub"`
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
                `select`,
                `    jsonb_agg(jsonb_build_object('id', "_sub"."review_id", 'text', "_sub"."review_text", 'rating', "_sub"."rating", 'product', case`,
                `        when "_sub"."product_id" is null`,
                `        and "_sub"."product_name" is null`,
                `        and "_sub"."product_price" is null then`,
                `            null`,
                `        else`,
                `            jsonb_build_object('id', "_sub"."product_id", 'name', "_sub"."product_name", 'price', "_sub"."product_price", 'category', case`,
                `                when "_sub"."category_id" is null`,
                `                and "_sub"."category_name" is null then`,
                `                    null`,
                `                else`,
                `                    jsonb_build_object('id', "_sub"."category_id", 'name', "_sub"."category_name")`,
                `            end)`,
                `    end)) as "Reviews"`,
                `from`,
                `    (`,
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
                `    ) as "_sub"`
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

            console.log("=== LEFT JOIN BEHAVIOR ===");
            console.log(formattedSql);
            console.log("========================");            // Enhanced behavior: uses CASE statement to detect null parent and use null instead
            const expectedSql = [
                `select`,
                `    jsonb_agg(jsonb_build_object('id', "_sub"."order_id", 'date', "_sub"."order_date", 'amount', "_sub"."order_amount", 'customer', case`,
                `        when "_sub"."customer_id" is null`,
                `        and "_sub"."customer_name" is null`,
                `        and "_sub"."customer_email" is null then`,
                `            null`,
                `        else`,
                `            jsonb_build_object('id', "_sub"."customer_id", 'name', "_sub"."customer_name", 'email', "_sub"."customer_email")`,
                `    end)) as "Orders"`,
                `from`,
                `    (`,
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
                `    ) as "_sub"`
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
                `select`,
                `    jsonb_agg(jsonb_build_object('id', "_sub"."order_id", 'date', "_sub"."order_date", 'customer', case`,
                `        when "_sub"."customer_id" is null`,
                `        and "_sub"."customer_name" is null`,
                `        and "_sub"."customer_email" is null then`,
                `            null`,
                `        else`,
                `            jsonb_build_object('id', "_sub"."customer_id", 'name', "_sub"."customer_name", 'email', "_sub"."customer_email")`,
                `    end)) as "Orders"`,
                `from`,
                `    (`,
                `        select`,
                `            1 as "order_id"`,
                `            , '2024-01-01' as "order_date"`,
                `            , null::int as "customer_id"`,
                `            , null::text as "customer_name"`,
                `            , null::text as "customer_email"`,
                `    ) as "_sub"`
            ].join('\n');

            expect(formattedSql).toBe(expectedSql);
        });
    });
});

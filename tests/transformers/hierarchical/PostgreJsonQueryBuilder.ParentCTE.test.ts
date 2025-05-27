import { PostgreJsonQueryBuilder, JsonMapping } from "../../../src/transformers/PostgreJsonQueryBuilder";
import { SimpleSelectQuery } from "../../../src/models/SimpleSelectQuery";
import { describe, expect, it } from "vitest";
import { SelectQueryParser } from "../../../src/parsers/SelectQueryParser";
import { SqlFormatter } from "../../../src/transformers/SqlFormatter";

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

describe("PostgreJsonQueryBuilder - Parent Entity CTE Generation", () => {
    it("should generate parent CTE for customer entity", () => {
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
            `    , "cte_parent_depth_1" as (`,
            `        select`,
            `            *`,
            `            , case`,
            `                when "customer_id" is null`,
            `                and "customer_name" is null`,
            `                and "customer_email" is null then`,
            `                    null`,
            `                else`,
            `                    jsonb_build_object('id', "customer_id", 'name', "customer_name", 'email', "customer_email")`,
            `            end as "customer_json"`,
            `        from`,
            `            "origin_query"`,
            `    )`,
            `    , "cte_root_orders" as (`,
            `        select`,
            `            jsonb_build_object('id', "order_id", 'date', "order_date", 'amount', "order_amount", 'customer', "customer_json") as "Orders"`,
            `        from`,
            `            "cte_parent_depth_1"`,
            `    )`,
            `select`,
            `    jsonb_agg("Orders") as "Orders_array"`,
            `from`,
            `    "cte_root_orders"`
        ].join('\n');

        // Log for debugging
        console.log("Generated SQL:", formattedSql);

        // Check if the parent CTE exists
        expect(formattedSql).toBe(expectedSql);
    });

    it("should generate parent CTEs for complex hierarchy with multiple branches", () => {
        const sql = `
        select
            order_id,
            order_date,
            order_total,
            customer_id,
            customer_name,
            customer_email,
            address_id,
            address_street,
            address_city,
            address_zip,
            shipping_id,
            shipping_method,
            shipping_fee,
            carrier_id,
            carrier_name,
            carrier_phone
        from
            order_details_view
        `;
        const originalQuery = SelectQueryParser.parse(sql) as SimpleSelectQuery;

        const builder = new PostgreJsonQueryBuilder();
        const mapping: JsonMapping = {
            rootName: "OrderDetails",
            rootEntity: {
                id: "order",
                name: "Order",
                columns: {
                    "id": "order_id",
                    "date": "order_date",
                    "total": "order_total"
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
                        "city": "address_city",
                        "zip": "address_zip"
                    }
                },
                {
                    id: "shipping",
                    name: "ShippingInfo",
                    parentId: "order",
                    propertyName: "shipping",
                    relationshipType: "object",
                    columns: {
                        "id": "shipping_id",
                        "method": "shipping_method",
                        "fee": "shipping_fee"
                    }
                },
                {
                    id: "carrier",
                    name: "Carrier",
                    parentId: "shipping",
                    propertyName: "carrier",
                    relationshipType: "object",
                    columns: {
                        "id": "carrier_id",
                        "name": "carrier_name",
                        "phone": "carrier_phone"
                    }
                }
            ],
            useJsonb: true
        };

        const jsonQuery = builder.buildJson(originalQuery, mapping);
        const formatter = new SqlFormatter(customStyle);
        const formattedSql = formatter.format(jsonQuery).formattedSql;

        // Expected CTE structure:
        // 1. origin_query
        // 2. cte_parent_depth_2 (Address and Carrier)
        // 3. cte_parent_depth_1 (Customer and ShippingInfo)
        // 4. cte_root_orderdetails
        // 5. Final SELECT

        const expectedSql = [
            `with`,
            `    "origin_query" as (`,
            `        select`,
            `            "order_id"`,
            `            , "order_date"`,
            `            , "order_total"`,
            `            , "customer_id"`,
            `            , "customer_name"`,
            `            , "customer_email"`,
            `            , "address_id"`,
            `            , "address_street"`,
            `            , "address_city"`,
            `            , "address_zip"`,
            `            , "shipping_id"`,
            `            , "shipping_method"`,
            `            , "shipping_fee"`,
            `            , "carrier_id"`,
            `            , "carrier_name"`,
            `            , "carrier_phone"`,
            `        from`,
            `            "order_details_view"`,
            `    )`,
            `    , "cte_parent_depth_2" as (`,
            `        select`,
            `            *`,
            `            , case`,
            `                when "address_id" is null`,
            `                and "address_street" is null`,
            `                and "address_city" is null`,
            `                and "address_zip" is null then`,
            `                    null`,
            `                else`,
            `                    jsonb_build_object('id', "address_id", 'street', "address_street", 'city', "address_city", 'zip', "address_zip")`,
            `            end as "address_json"`,
            `            , case`,
            `                when "carrier_id" is null`,
            `                and "carrier_name" is null`,
            `                and "carrier_phone" is null then`,
            `                    null`,
            `                else`,
            `                    jsonb_build_object('id', "carrier_id", 'name', "carrier_name", 'phone', "carrier_phone")`,
            `            end as "carrier_json"`,
            `        from`,
            `            "origin_query"`,
            `    )`,
            `    , "cte_parent_depth_1" as (`,
            `        select`,
            `            *`,
            `            , case`,
            `                when "customer_id" is null`,
            `                and "customer_name" is null`,
            `                and "customer_email" is null then`,
            `                    null`,
            `                else`,
            `                    jsonb_build_object('id', "customer_id", 'name', "customer_name", 'email', "customer_email", 'address', "address_json")`,
            `            end as "customer_json"`,
            `            , case`,
            `                when "shipping_id" is null`,
            `                and "shipping_method" is null`,
            `                and "shipping_fee" is null then`,
            `                    null`,
            `                else`,
            `                    jsonb_build_object('id', "shipping_id", 'method', "shipping_method", 'fee', "shipping_fee", 'carrier', "carrier_json")`,
            `            end as "shippinginfo_json"`,
            `        from`,
            `            "cte_parent_depth_2"`,
            `    )`,
            `    , "cte_root_orderdetails" as (`,
            `        select`,
            `            jsonb_build_object('id', "order_id", 'date', "order_date", 'total', "order_total", 'customer', "customer_json", 'shipping', "shippinginfo_json") as "OrderDetails"`,
            `        from`,
            `            "cte_parent_depth_1"`,
            `    )`,
            `select`,
            `    jsonb_agg("OrderDetails") as "OrderDetails_array"`,
            `from`,
            `    "cte_root_orderdetails"`
        ].join('\n');

        // Log for debugging
        console.log("Generated SQL:", formattedSql);

        // Check if all depth CTEs exist
        expect(formattedSql).toContain('"cte_parent_depth_2"');
        expect(formattedSql).toContain('"cte_parent_depth_1"');
        expect(formattedSql).toContain('"address_json"');
        expect(formattedSql).toContain('"carrier_json"');
        expect(formattedSql).toContain('"customer_json"');
        expect(formattedSql).toContain('"shippinginfo_json"');

        // Full comparison
        expect(formattedSql).toBe(expectedSql);
    });
});
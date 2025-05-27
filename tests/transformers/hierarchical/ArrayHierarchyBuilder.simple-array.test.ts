import { SelectQueryParser } from '../../../src/parsers/SelectQueryParser';
import { PostgreJsonQueryBuilder } from '../../../src/transformers/PostgreJsonQueryBuilder';
import { JsonMapping } from '../../../src/transformers/PostgreJsonQueryBuilder';
import { describe, expect, it } from 'vitest';
import { SqlFormatter } from '../../../src/transformers/SqlFormatter';
import { SimpleSelectQuery } from '../../../src/models/SimpleSelectQuery';


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

describe('ArrayHierarchyBuilder - Simple Array Relationship', () => {
    it('should transform a query with a single array child into a nested JSON array', () => {
        const sql = `
            select
                o.order_id,
                o.order_date,
                i.item_id,
                i.item_name
            from
                orders as o
                left join order_items as i on o.order_id = i.order_id
        `;
        const originalQuery = SelectQueryParser.parse(sql) as SimpleSelectQuery;

        const mapping: JsonMapping = {
            rootName: 'Order',
            rootEntity: {
                id: 'order',
                name: 'Order',
                columns: {
                    "id": "order_id",
                    "date": "order_date"
                }
            },
            nestedEntities: [
                {
                    id: 'item',
                    name: 'Item',
                    parentId: 'order',
                    propertyName: 'items',
                    relationshipType: 'array',
                    columns: {
                        "id": "item_id",
                        "name": "item_name"
                    }
                }
            ],
            useJsonb: true
        }; const builder = new PostgreJsonQueryBuilder();
        const jsonQuery = builder.buildJson(originalQuery, mapping);
        const formatter = new SqlFormatter(customStyle);
        const formattedSql = formatter.format(jsonQuery).formattedSql;

        const expectedSql = [
            `with`,
            `    "origin_query" as (`,
            `        select`,
            `            "o"."order_id"`,
            `            , "o"."order_date"`,
            `            , "i"."item_id"`,
            `            , "i"."item_name"`,
            `        from`,
            `            "orders" as "o"`,
            `            left join "order_items" as "i" on "o"."order_id" = "i"."order_id"`,
            `    )`,
            `    , "cte_array_depth_1" as (`,
            `        select`,
            `            "order_id"`,
            `            , "order_date"`,
            `            , jsonb_agg(jsonb_build_object('id', "item_id", 'name', "item_name")) as "items"`,
            `        from`,
            `            "origin_query"`,
            `        group by`,
            `            "order_id"`,
            `            , "order_date"`,
            `    )`,
            `    , "cte_root_order" as (`,
            `        select`,
            `            jsonb_build_object('id', "order_id", 'date', "order_date", 'items', "items") as "Order"`,
            `        from`,
            `            "cte_array_depth_1"`,
            `    )`,
            `select`,
            `    jsonb_agg("Order") as "Order_array"`,
            `from`,
            `    "cte_root_order"`].join('\n');

        console.log('Expected SQL length:', expectedSql.length);
        console.log('Are they equal?', formattedSql === expectedSql);

        expect(formattedSql).toBe(expectedSql);
    });

    it('should transform a query with nested array relationships (3 levels)', () => {
        const sql = `
            select
                o.order_id,
                o.order_date,
                i.item_id,
                i.item_name,
                d.detail_id,
                d.detail_description,
                d.detail_value
            from
                orders as o
                left join order_items as i on o.order_id = i.order_id
                left join item_details as d on i.item_id = d.item_id
        `;
        const originalQuery = SelectQueryParser.parse(sql) as SimpleSelectQuery;

        const mapping: JsonMapping = {
            rootName: 'Order',
            rootEntity: {
                id: 'order',
                name: 'Order',
                columns: {
                    "id": "order_id",
                    "date": "order_date"
                }
            },
            nestedEntities: [
                {
                    id: 'item',
                    name: 'Item',
                    parentId: 'order',
                    propertyName: 'items',
                    relationshipType: 'array',
                    columns: {
                        "id": "item_id",
                        "name": "item_name"
                    }
                },
                {
                    id: 'detail',
                    name: 'Detail',
                    parentId: 'item',
                    propertyName: 'details',
                    relationshipType: 'array',
                    columns: {
                        "id": "detail_id",
                        "description": "detail_description",
                        "value": "detail_value"
                    }
                }
            ],
            useJsonb: true
        }; const builder = new PostgreJsonQueryBuilder();
        const jsonQuery = builder.buildJson(originalQuery, mapping);
        const formatter = new SqlFormatter(customStyle);
        const formattedSql = formatter.format(jsonQuery).formattedSql;

        // Expected SQL with depth-based processing: deepest first (detail -> item -> order)
        const expectedSql = [
            `with`,
            `    "origin_query" as (`,
            `        select`,
            `            "o"."order_id"`,
            `            , "o"."order_date"`,
            `            , "i"."item_id"`,
            `            , "i"."item_name"`,
            `            , "d"."detail_id"`,
            `            , "d"."detail_description"`,
            `            , "d"."detail_value"`,
            `        from`,
            `            "orders" as "o"`,
            `            left join "order_items" as "i" on "o"."order_id" = "i"."order_id"`,
            `            left join "item_details" as "d" on "i"."item_id" = "d"."item_id"`,
            `    )`,
            `    , "cte_array_depth_2" as (`,
            `        select`,
            `            "order_id"`,
            `            , "order_date"`,
            `            , "item_id"`,
            `            , "item_name"`,
            `            , jsonb_agg(jsonb_build_object('id', "detail_id", 'description', "detail_description", 'value', "detail_value")) as "details"`,
            `        from`,
            `            "origin_query"`,
            `        group by`,
            `            "order_id"`,
            `            , "order_date"`,
            `            , "item_id"`,
            `            , "item_name"`,
            `    )`, `    , "cte_array_depth_1" as (`,
            `        select`,
            `            "order_id"`,
            `            , "order_date"`,
            `            , "details"`,
            `            , jsonb_agg(jsonb_build_object('id', "item_id", 'name', "item_name", 'details', "details")) as "items"`,
            `        from`,
            `            "cte_array_depth_2"`,
            `        group by`,
            `            "order_id"`,
            `            , "order_date"`,
            `            , "details"`,
            `    )`,
            `    , "cte_root_order" as (`,
            `        select`,
            `            jsonb_build_object('id', "order_id", 'date', "order_date", 'items', "items") as "Order"`,
            `        from`,
            `            "cte_array_depth_1"`,
            `    )`,
            `select`,
            `    jsonb_agg("Order") as "Order_array"`,
            `from`,
            `    "cte_root_order"`].join('\n');

        expect(formattedSql).toBe(expectedSql);
    });
});

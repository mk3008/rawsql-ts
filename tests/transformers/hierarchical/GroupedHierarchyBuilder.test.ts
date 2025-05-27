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

describe('GroupedHierarchyBuilder - Downstream (Array) Relationships', () => {

    describe('Simple Array Relationships', () => {
        it('should create true hierarchical structure with GROUP BY aggregation: Category with Products[]', () => {
            const sql = `
                select
                    category_id,
                    category_name,
                    product_id,
                    product_name
                from
                    catalog_report
            `;
            const originalQuery = SelectQueryParser.parse(sql) as SimpleSelectQuery;

            const builder = new PostgreJsonQueryBuilder();
            const mapping: JsonMapping = {
                rootName: "Categories",
                rootEntity: {
                    id: "category",
                    name: "Category",
                    columns: {
                        "id": "category_id",
                        "name": "category_name"
                    }
                },
                nestedEntities: [
                    {
                        id: "products",
                        name: "Products",
                        parentId: "category",
                        propertyName: "products",
                        relationshipType: "array", // Category has multiple Products
                        columns: {
                            "id": "product_id",
                            "name": "product_name"
                        }
                    }
                ],
                useJsonb: true
            };

            const jsonQuery = builder.buildJson(originalQuery, mapping);
            const formatter = new SqlFormatter(customStyle);
            const formattedSql = formatter.format(jsonQuery).formattedSql; const expectedSql = `with
    "origin_query" as (
        select
            "category_id"
            , "category_name"
            , "product_id"
            , "product_name"
        from
            "catalog_report"
    )
    , "cte_products" as (
        select
            "category_id"
            , "category_name"
            , jsonb_agg(case
                when "product_id" is null
                and "product_name" is null then
                    null
                else
                    jsonb_build_object('id', "product_id", 'name', "product_name")
            end) as "products"
        from
            "origin_query"
        group by
            "category_id"
            , "category_name"
    )
    , "cte_root_categories" as (
        select
            case
                when "category_id" is null
                and "category_name" is null then
                    null
                else
                    jsonb_build_object('id', "category_id", 'name', "category_name", 'products', "products")
            end as "Categories"
        from
            "cte_products"
    )
select
    jsonb_agg("Categories") as "Categories_array"
from
    "cte_root_categories"`;

            expect(formattedSql).toBe(expectedSql);
        });

        it('should handle Customer with Orders[]', () => {
            const sql = `
                select
                    customer_id,
                    customer_name,
                    customer_email,
                    order_id,
                    order_date,
                    order_amount
                from
                    customer_orders_view
            `;
            const originalQuery = SelectQueryParser.parse(sql) as SimpleSelectQuery;

            const builder = new PostgreJsonQueryBuilder();
            const mapping: JsonMapping = {
                rootName: "Customers",
                rootEntity: {
                    id: "customer",
                    name: "Customer",
                    columns: {
                        "id": "customer_id",
                        "name": "customer_name",
                        "email": "customer_email"
                    }
                },
                nestedEntities: [
                    {
                        id: "orders",
                        name: "Orders",
                        parentId: "customer",
                        propertyName: "orders",
                        relationshipType: "array",
                        columns: {
                            "id": "order_id",
                            "date": "order_date",
                            "amount": "order_amount"
                        }
                    }
                ],
                useJsonb: true
            };

            const jsonQuery = builder.buildJson(originalQuery, mapping);
            const formatter = new SqlFormatter(customStyle);
            const formattedSql = formatter.format(jsonQuery).formattedSql; const expectedSql = `with
    "origin_query" as (
        select
            "customer_id"
            , "customer_name"
            , "customer_email"
            , "order_id"
            , "order_date"
            , "order_amount"
        from
            "customer_orders_view"
    )
    , "cte_orders" as (
        select
            "customer_id"
            , "customer_name"
            , "customer_email"
            , jsonb_agg(case
                when "order_id" is null
                and "order_date" is null
                and "order_amount" is null then
                    null
                else
                    jsonb_build_object(\'id\', "order_id", \'date\', "order_date", \'amount\', "order_amount")
            end) as "orders"
        from
            "origin_query"
        group by
            "customer_id"
            , "customer_name"
            , "customer_email"
    )
    , "cte_root_customers" as (
        select
            case
                when "customer_id" is null
                and "customer_name" is null
                and "customer_email" is null then
                    null
                else
                    jsonb_build_object(\'id\', "customer_id", \'name\', "customer_name", \'email\', "customer_email", \'orders\', "orders")
            end as "Customers"
        from
            "cte_orders"
    )
select
    jsonb_agg("Customers") as "Customers_array"
from
    "cte_root_customers"`;

            expect(formattedSql).toBe(expectedSql);
        });
    });

    describe('Array with Object Nested Relationships', () => {
        it('should handle mixed regional hierarchy: Region with Countries[] and each Country with Capital (single)', () => {
            const sql = `
                select
                    region_id,
                    region_name,
                    country_id,
                    country_name,
                    country_code,
                    capital_id,
                    capital_name,
                    capital_population
                from
                    region_country_capital_view
            `;
            const originalQuery = SelectQueryParser.parse(sql) as SimpleSelectQuery;

            const builder = new PostgreJsonQueryBuilder();
            const mapping: JsonMapping = {
                rootName: "Regions",
                rootEntity: {
                    id: "region",
                    name: "Region",
                    columns: {
                        "id": "region_id",
                        "name": "region_name"
                    }
                },
                nestedEntities: [
                    {
                        id: "countries",
                        name: "Countries",
                        parentId: "region",
                        propertyName: "countries",
                        relationshipType: "array", // Region has multiple Countries
                        columns: {
                            "id": "country_id",
                            "name": "country_name",
                            "code": "country_code"
                        }
                    },
                    {
                        id: "capital",
                        name: "Capital",
                        parentId: "countries",
                        propertyName: "capital",
                        relationshipType: "object", // Each Country has one Capital
                        columns: {
                            "id": "capital_id",
                            "name": "capital_name",
                            "population": "capital_population"
                        }
                    }
                ],
                useJsonb: true
            };

            const jsonQuery = builder.buildJson(originalQuery, mapping);
            const formatter = new SqlFormatter(customStyle);
            const formattedSql = formatter.format(jsonQuery).formattedSql; const expectedSql = `with
    origin_query as (
        select
            region_id
            , region_name
            , country_id
            , country_name
            , country_code
            , capital_id
            , capital_name
            , capital_population
        from
            region_country_capital_view
    )
    , country_with_capital as (
        select
            region_id
            , region_name
            , country_id
            , country_name
            , country_code
            , case when capital_id is null
            and capital_name is null
            and capital_population is null then null else jsonb_build_object('id', capital_id, 'name', capital_name, 'population', capital_population) end as capital
        from
            origin_query
    )
    , countries_grouped as (
        select
            region_id
            , region_name
            , jsonb_agg(jsonb_build_object('id', country_id, 'name', country_name, 'code', country_code, 'capital', capital)) as countries
        from
            country_with_capital
        group by
            region_id
            , region_name
    )
    , root_regions as (
        select
            jsonb_build_object('id', region_id, 'name', region_name, 'countries', countries) as region
        from
            countries_grouped
    )
select
    jsonb_agg(region) as regions_array
from
    root_regions`;

            expect(formattedSql).toBe(expectedSql);
        });

        it('should handle Sale > SaleDetails[] > Product mixed relationships', () => {
            const sql = `
                select
                    sale_id,
                    sale_date,
                    sale_total,
                    detail_id,
                    detail_quantity,
                    detail_price,
                    product_id,
                    product_name,
                    product_category
                from
                    sale_full_report
            `;
            const originalQuery = SelectQueryParser.parse(sql) as SimpleSelectQuery;

            const builder = new PostgreJsonQueryBuilder();
            const mapping: JsonMapping = {
                rootName: "Sales",
                rootEntity: {
                    id: "sale",
                    name: "Sale",
                    columns: {
                        "id": "sale_id",
                        "date": "sale_date",
                        "total": "sale_total"
                    }
                },
                nestedEntities: [
                    {
                        id: "saleDetails",
                        name: "SaleDetails",
                        parentId: "sale",
                        propertyName: "details",
                        relationshipType: "array", // Sale has multiple SaleDetails (downstream)
                        columns: {
                            "id": "detail_id",
                            "quantity": "detail_quantity",
                            "price": "detail_price"
                        }
                    },
                    {
                        id: "product",
                        name: "Product",
                        parentId: "saleDetails",
                        propertyName: "product",
                        relationshipType: "object", // Each SaleDetail has one Product (upstream)
                        columns: {
                            "id": "product_id",
                            "name": "product_name",
                            "category": "product_category"
                        }
                    }
                ],
                useJsonb: true
            };

            const jsonQuery = builder.buildJson(originalQuery, mapping);
            const formatter = new SqlFormatter(customStyle);
            const formattedSql = formatter.format(jsonQuery).formattedSql; const expectedSql = `with
    origin_query as (
        select
            sale_id,
            sale_date,
            sale_total,
            detail_id,
            detail_quantity,
            detail_price,
            product_id,
            product_name,
            product_category
        from sale_full_report
    ),

    detail_with_product as (
        select
            sale_id,
            sale_date,
            sale_total,
            jsonb_build_object(
                'id', detail_id,
                'quantity', detail_quantity,
                'price', detail_price,
                'product', case
                    when product_id is null
                    and product_name is null
                    and product_category is null then null
                    else jsonb_build_object(
                        'id', product_id,
                        'name', product_name,
                        'category', product_category
                    )
                end
            ) as detail
        from origin_query
        where detail_id is not null
    ),

    details_grouped as (
        select
            sale_id,
            sale_date,
            sale_total,
            jsonb_agg(detail) as details
        from detail_with_product
        group by sale_id, sale_date, sale_total
    ),

    root_sales as (
        select
            jsonb_build_object(
                'id', sale_id,
                'date', sale_date,
                'total', sale_total,
                'details', details
            ) as sale
        from details_grouped
    )

select
    jsonb_agg(sale) as sales_array
from root_sales`;

            expect(formattedSql).toBe(expectedSql);
        });
    });
});

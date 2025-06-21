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

describe('ComplexHierarchyBuilder - Multi-Level and Mixed Relationships', () => {

    describe('Multi-Level Array Hierarchies', () => {
        it('should handle organizational hierarchy: Company with Departments[] and each Department with Employees[]', () => {
            const sql = `
                select
                    company_id,
                    company_name,
                    company_founded,
                    dept_id,
                    dept_name,
                    dept_budget,
                    emp_id,
                    emp_name,
                    emp_position,
                    emp_salary
                from
                    company_org_chart
            `;
            const originalQuery = SelectQueryParser.parse(sql) as SimpleSelectQuery;

            const builder = new PostgresJsonQueryBuilder();
            const mapping: JsonMapping = {
                rootName: "Companies",
                rootEntity: {
                    id: "company",
                    name: "Company",
                    columns: {
                        "id": "company_id",
                        "name": "company_name",
                        "founded": "company_founded"
                    }
                },
                nestedEntities: [
                    {
                        id: "departments",
                        name: "Departments",
                        parentId: "company",
                        propertyName: "departments",
                        relationshipType: "array", // Company has multiple Departments
                        columns: {
                            "id": "dept_id",
                            "name": "dept_name",
                            "budget": "dept_budget"
                        }
                    },
                    {
                        id: "employees",
                        name: "Employees",
                        parentId: "departments",
                        propertyName: "employees",
                        relationshipType: "array", // Each Department has multiple Employees
                        columns: {
                            "id": "emp_id",
                            "name": "emp_name",
                            "position": "emp_position",
                            "salary": "emp_salary"
                        }
                    }
                ],
            };

            const jsonQuery = builder.buildJson(originalQuery, mapping);
            const formatter = new SqlFormatter(customStyle);
            const formattedSql = formatter.format(jsonQuery).formattedSql;
            const expectedSql = [
                `with`,
                `    "origin_query" as (`,
                `        select`,
                `            "company_id"`,
                `            , "company_name"`,
                `            , "company_founded"`,
                `            , "dept_id"`,
                `            , "dept_name"`,
                `            , "dept_budget"`,
                `            , "emp_id"`,
                `            , "emp_name"`,
                `            , "emp_position"`,
                `            , "emp_salary"`,
                `        from`,
                `            "company_org_chart"`,
                `    )`, `    , "cte_array_depth_2" as (`,
                `        select`,
                `            "company_id"`,
                `            , "company_name"`,
                `            , "company_founded"`,
                `            , "dept_id"`,
                `            , "dept_name"`,
                `            , "dept_budget"`,
                `            , jsonb_agg(jsonb_build_object('id', "emp_id", 'name', "emp_name", 'position', "emp_position", 'salary', "emp_salary")) as "employees"`,
                `        from`,
                `            "origin_query"`,
                `        group by`,
                `            "company_id"`,
                `            , "company_name"`,
                `            , "company_founded"`,
                `            , "dept_id"`,
                `            , "dept_name"`,
                `            , "dept_budget"`,
                `    )`, `    , "cte_array_depth_1" as (`,
                `        select`,
                `            "company_id"`,
                `            , "company_name"`,
                `            , "company_founded"`,
                `            , "employees"`,
                `            , jsonb_agg(jsonb_build_object('id', "dept_id", 'name', "dept_name", 'budget', "dept_budget", 'employees', "employees")) as "departments"`,
                `        from`,
                `            "cte_array_depth_2"`,
                `        group by`,
                `            "company_id"`,
                `            , "company_name"`,
                `            , "company_founded"`,
                `            , "employees"`,
                `    )`,
                `    , "cte_root_companies" as (`,
                `        select`,
                `            jsonb_build_object('id', "company_id", 'name', "company_name", 'founded', "company_founded", 'departments', "departments") as "Companies"`,
                `        from`,
                `            "cte_array_depth_1"`,
                `    )`,
                `select`,
                `    jsonb_agg("Companies") as "Companies_array"`,
                `from`,
                `    "cte_root_companies"`
            ].join('\n');// Compare after trimming whitespace to avoid false negatives due to formatting
            const trimmedActual = formattedSql.trim();
            const trimmedExpected = expectedSql.trim();

            expect(trimmedActual).toBe(trimmedExpected);
        });

        it('should handle geographic hierarchy: Region with Countries[] and each Country with Cities[]', () => {
            const sql = `
                select
                    region_id,
                    region_name,
                    region_code,
                    country_id,
                    country_name,
                    country_code,
                    city_id,
                    city_name,
                    city_population
                from
                    geographic_data_view
            `;
            const originalQuery = SelectQueryParser.parse(sql) as SimpleSelectQuery;

            const builder = new PostgresJsonQueryBuilder();
            const mapping: JsonMapping = {
                rootName: "Regions",
                rootEntity: {
                    id: "region",
                    name: "Region",
                    columns: {
                        "id": "region_id",
                        "name": "region_name",
                        "code": "region_code"
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
                        id: "cities",
                        name: "Cities",
                        parentId: "countries",
                        propertyName: "cities",
                        relationshipType: "array", // Each Country has multiple Cities
                        columns: {
                            "id": "city_id",
                            "name": "city_name",
                            "population": "city_population"
                        }
                    }
                ],
            };

            const jsonQuery = builder.buildJson(originalQuery, mapping);
            const formatter = new SqlFormatter(customStyle);
            const formattedSql = formatter.format(jsonQuery).formattedSql; const expectedSql = [
                `with`,
                `    "origin_query" as (`,
                `        select`,
                `            "region_id"`,
                `            , "region_name"`,
                `            , "region_code"`,
                `            , "country_id"`,
                `            , "country_name"`,
                `            , "country_code"`,
                `            , "city_id"`,
                `            , "city_name"`,
                `            , "city_population"`,
                `        from`,
                `            "geographic_data_view"`,
                `    )`,
                `    , "cte_array_depth_2" as (`,
                `        select`,
                `            "region_id"`,
                `            , "region_name"`,
                `            , "region_code"`,
                `            , "country_id"`,
                `            , "country_name"`,
                `            , "country_code"`,
                `            , jsonb_agg(jsonb_build_object('id', "city_id", 'name', "city_name", 'population', "city_population")) as "cities"`,
                `        from`,
                `            "origin_query"`,
                `        group by`,
                `            "region_id"`,
                `            , "region_name"`,
                `            , "region_code"`,
                `            , "country_id"`,
                `            , "country_name"`,
                `            , "country_code"`,
                `    )`,
                `    , "cte_array_depth_1" as (`,
                `        select`,
                `            "region_id"`,
                `            , "region_name"`,
                `            , "region_code"`,
                `            , "cities"`,
                `            , jsonb_agg(jsonb_build_object('id', "country_id", 'name', "country_name", 'code', "country_code", 'cities', "cities")) as "countries"`,
                `        from`,
                `            "cte_array_depth_2"`,
                `        group by`,
                `            "region_id"`,
                `            , "region_name"`,
                `            , "region_code"`,
                `            , "cities"`,
                `    )`,
                `    , "cte_root_regions" as (`,
                `        select`,
                `            jsonb_build_object('id', "region_id", 'name', "region_name", 'code', "region_code", 'countries', "countries") as "Regions"`,
                `        from`,
                `            "cte_array_depth_1"`,
                `    )`,
                `select`,
                `    jsonb_agg("Regions") as "Regions_array"`,
                `from`,
                `    "cte_root_regions"`
            ].join('\n');

            expect(formattedSql).toBe(expectedSql);
        });

        it('should handle deeply nested hierarchy: Division > Departments[] > Teams[] > Employees[]', () => {
            const sql = `
                select
                    division_id,
                    division_name,
                    dept_id,
                    dept_name,
                    team_id,
                    team_name,
                    emp_id,
                    emp_name,
                    emp_role
                from
                    org_full_hierarchy
            `;
            const originalQuery = SelectQueryParser.parse(sql) as SimpleSelectQuery;

            const builder = new PostgresJsonQueryBuilder();
            const mapping: JsonMapping = {
                rootName: "Divisions",
                rootEntity: {
                    id: "division",
                    name: "Division",
                    columns: {
                        "id": "division_id",
                        "name": "division_name"
                    }
                },
                nestedEntities: [
                    {
                        id: "departments",
                        name: "Departments",
                        parentId: "division",
                        propertyName: "departments",
                        relationshipType: "array",
                        columns: {
                            "id": "dept_id",
                            "name": "dept_name"
                        }
                    },
                    {
                        id: "teams",
                        name: "Teams",
                        parentId: "departments",
                        propertyName: "teams",
                        relationshipType: "array",
                        columns: {
                            "id": "team_id",
                            "name": "team_name"
                        }
                    },
                    {
                        id: "employees",
                        name: "Employees",
                        parentId: "teams",
                        propertyName: "employees",
                        relationshipType: "array",
                        columns: {
                            "id": "emp_id",
                            "name": "emp_name",
                            "role": "emp_role"
                        }
                    }
                ],
            };

            const jsonQuery = builder.buildJson(originalQuery, mapping);
            const formatter = new SqlFormatter(customStyle);
            const formattedSql = formatter.format(jsonQuery).formattedSql; const expectedSql = [
                `with`,
                `    "origin_query" as (`,
                `        select`,
                `            "division_id"`,
                `            , "division_name"`,
                `            , "dept_id"`,
                `            , "dept_name"`,
                `            , "team_id"`,
                `            , "team_name"`,
                `            , "emp_id"`,
                `            , "emp_name"`,
                `            , "emp_role"`,
                `        from`,
                `            "org_full_hierarchy"`,
                `    )`,
                `    , "cte_array_depth_3" as (`,
                `        select`,
                `            "division_id"`,
                `            , "division_name"`,
                `            , "dept_id"`,
                `            , "dept_name"`,
                `            , "team_id"`,
                `            , "team_name"`,
                `            , jsonb_agg(jsonb_build_object('id', "emp_id", 'name', "emp_name", 'role', "emp_role")) as "employees"`,
                `        from`,
                `            "origin_query"`,
                `        group by`,
                `            "division_id"`,
                `            , "division_name"`,
                `            , "dept_id"`,
                `            , "dept_name"`,
                `            , "team_id"`,
                `            , "team_name"`,
                `    )`,
                `    , "cte_array_depth_2" as (`,
                `        select`,
                `            "division_id"`,
                `            , "division_name"`,
                `            , "dept_id"`,
                `            , "dept_name"`,
                `            , "employees"`,
                `            , jsonb_agg(jsonb_build_object('id', "team_id", 'name', "team_name", 'employees', "employees")) as "teams"`,
                `        from`,
                `            "cte_array_depth_3"`,
                `        group by`,
                `            "division_id"`,
                `            , "division_name"`,
                `            , "dept_id"`,
                `            , "dept_name"`,
                `            , "employees"`,
                `    )`,
                `    , "cte_array_depth_1" as (`,
                `        select`,
                `            "division_id"`,
                `            , "division_name"`,
                `            , "employees"`,
                `            , "teams"`,
                `            , jsonb_agg(jsonb_build_object('id', "dept_id", 'name', "dept_name", 'teams', "teams")) as "departments"`,
                `        from`,
                `            "cte_array_depth_2"`,
                `        group by`,
                `            "division_id"`,
                `            , "division_name"`,
                `            , "employees"`,
                `            , "teams"`,
                `    )`,
                `    , "cte_root_divisions" as (`,
                `        select`,
                `            jsonb_build_object('id', "division_id", 'name', "division_name", 'departments', "departments") as "Divisions"`,
                `        from`,
                `            "cte_array_depth_1"`,
                `    )`,
                `select`,
                `    jsonb_agg("Divisions") as "Divisions_array"`,
                `from`,
                `    "cte_root_divisions"`
            ].join('\n');

            expect(formattedSql).toBe(expectedSql);
        });
    });

    describe('Complex Mixed Relationships', () => {
        it('should handle complex mixed relationships: Order > OrderLines[] > Product and Order > Customer', () => {
            const sql = `
                select
                    order_id,
                    order_date,
                    order_status,
                    line_id,
                    line_quantity,
                    line_price,
                    product_id,
                    product_name,
                    customer_id,
                    customer_name,
                    customer_email
                from
                    order_details_view
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
                        "status": "order_status"
                    }
                },
                nestedEntities: [
                    {
                        id: "orderLines",
                        name: "OrderLines",
                        parentId: "order",
                        propertyName: "lines",
                        relationshipType: "array", // Order has multiple OrderLines (downstream)
                        columns: {
                            "id": "line_id",
                            "quantity": "line_quantity",
                            "price": "line_price"
                        }
                    },
                    {
                        id: "product",
                        name: "Product",
                        parentId: "orderLines",
                        propertyName: "product",
                        relationshipType: "object", // Each OrderLine has one Product (upstream)
                        columns: {
                            "id": "product_id",
                            "name": "product_name"
                        }
                    },
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
            const formattedSql = formatter.format(jsonQuery).formattedSql; const expectedSql = [
                `with`,
                `    "origin_query" as (`,
                `        select`,
                `            "order_id"`,
                `            , "order_date"`,
                `            , "order_status"`,
                `            , "line_id"`,
                `            , "line_quantity"`,
                `            , "line_price"`,
                `            , "product_id"`,
                `            , "product_name"`,
                `            , "customer_id"`,
                `            , "customer_name"`,
                `            , "customer_email"`,
                `        from`,
                `            "order_details_view"`,
                `    )`,
                `    , "cte_object_depth_1" as (`,
                `        select`,
                `            *`,
                `            , case`,
                `                when "product_id" is null`,
                `                and "product_name" is null then`,
                `                    null`,
                `                else`,
                `                    jsonb_build_object('id', "product_id", 'name', "product_name")`,
                `            end as "product_json"`,
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
                `    , "cte_array_depth_1" as (`,
                `        select`,
                `            "product_json"`,
                `            , "customer_json"`,
                `            , "order_id"`,
                `            , "order_date"`,
                `            , "order_status"`,
                `            , "product_id"`,
                `            , "product_name"`,
                `            , "customer_id"`,
                `            , "customer_name"`,
                `            , "customer_email"`,
                `            , jsonb_agg(jsonb_build_object('id', "line_id", 'quantity', "line_quantity", 'price', "line_price", 'product', "product_json")) as "lines"`,
                `        from`,
                `            "cte_object_depth_1"`,
                `        group by`,
                `            "product_json"`,
                `            , "customer_json"`,
                `            , "order_id"`,
                `            , "order_date"`,
                `            , "order_status"`,
                `            , "product_id"`,
                `            , "product_name"`,
                `            , "customer_id"`,
                `            , "customer_name"`,
                `            , "customer_email"`,
                `    )`,
                `    , "cte_root_orders" as (`,
                `        select`,
                `            jsonb_build_object('id', "order_id", 'date', "order_date", 'status', "order_status", 'lines', "lines", 'customer', "customer_json") as "Orders"`,
                `        from`,
                `            "cte_array_depth_1"`,
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

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

            const builder = new PostgreJsonQueryBuilder();
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
                useJsonb: true
            };

            const jsonQuery = builder.buildJson(originalQuery, mapping);
            const formatter = new SqlFormatter(customStyle);
            const formattedSql = formatter.format(jsonQuery).formattedSql;

            console.log("=== ORGANIZATIONAL HIERARCHY SQL ===");
            console.log(formattedSql);
            console.log("===================================");

            // Expected SQL with multiple CTEs for bottom-up processing
            const expectedSql = [
                `with`,
                `    "stage_0_employees" as (`,
                `        select`,
                `            "dept_id"`,
                `            , "dept_name"`,
                `            , "dept_budget"`,
                `            , jsonb_agg(jsonb_build_object('id', "emp_id", 'name', "emp_name", 'position', "emp_position", 'salary', "emp_salary")) as "employees"`,
                `        from`,
                `            "company_org_chart"`,
                `        group by`,
                `            "dept_id"`,
                `            , "dept_name"`,
                `            , "dept_budget"`,
                `    )`,
                `    , "stage_1_departments" as (`,
                `        select`,
                `            "company_id"`,
                `            , "company_name"`,
                `            , "company_founded"`,
                `            , jsonb_agg(jsonb_build_object('id', "dept_id", 'name', "dept_name", 'budget', "dept_budget", 'employees', "employees")) as "departments"`,
                `        from`,
                `            "stage_0_employees"`,
                `        group by`,
                `            "company_id"`,
                `            , "company_name"`,
                `            , "company_founded"`,
                `    )`,
                `    , "final_result" as (`,
                `        select`,
                `            jsonb_agg(jsonb_build_object('id', "company_id", 'name', "company_name", 'founded', "company_founded", 'departments', "departments")) as "result"`,
                `        from`,
                `            "stage_1_departments"`,
                `    )`,
                `select`,
                `    "result" as "Companies"`,
                `from`,
                `    "final_result"`
            ].join('\n');

            expect(formattedSql).toBe(expectedSql);
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

            const builder = new PostgreJsonQueryBuilder();
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
                useJsonb: true
            };

            const jsonQuery = builder.buildJson(originalQuery, mapping);
            const formatter = new SqlFormatter(customStyle);
            const formattedSql = formatter.format(jsonQuery).formattedSql;

            console.log("=== GEOGRAPHIC HIERARCHY SQL ===");
            console.log(formattedSql);
            console.log("===============================");

            const expectedSql = [
                `with`,
                `    "stage_0_cities" as (`,
                `        select`,
                `            "country_id"`,
                `            , "country_name"`,
                `            , "country_code"`,
                `            , jsonb_agg(jsonb_build_object('id', "city_id", 'name', "city_name", 'population', "city_population")) as "cities"`,
                `        from`,
                `            "geographic_data_view"`,
                `        group by`,
                `            "country_id"`,
                `            , "country_name"`,
                `            , "country_code"`,
                `    )`,
                `    , "stage_1_countries" as (`,
                `        select`,
                `            "region_id"`,
                `            , "region_name"`,
                `            , "region_code"`,
                `            , jsonb_agg(jsonb_build_object('id', "country_id", 'name', "country_name", 'code', "country_code", 'cities', "cities")) as "countries"`,
                `        from`,
                `            "stage_0_cities"`,
                `        group by`,
                `            "region_id"`,
                `            , "region_name"`,
                `            , "region_code"`,
                `    )`,
                `    , "final_result" as (`,
                `        select`,
                `            jsonb_agg(jsonb_build_object('id', "region_id", 'name', "region_name", 'code', "region_code", 'countries', "countries")) as "result"`,
                `        from`,
                `            "stage_1_countries"`,
                `    )`,
                `select`,
                `    "result" as "Regions"`,
                `from`,
                `    "final_result"`
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

            const builder = new PostgreJsonQueryBuilder();
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
                useJsonb: true
            };

            const jsonQuery = builder.buildJson(originalQuery, mapping);
            const formatter = new SqlFormatter(customStyle);
            const formattedSql = formatter.format(jsonQuery).formattedSql;

            console.log("=== DEEPLY NESTED HIERARCHY SQL ===");
            console.log(formattedSql);
            console.log("===================================");

            const expectedSql = [
                `with`,
                `    "stage_0_employees" as (`,
                `        select`,
                `            "team_id"`,
                `            , "team_name"`,
                `            , jsonb_agg(jsonb_build_object('id', "emp_id", 'name', "emp_name", 'role', "emp_role")) as "employees"`,
                `        from`,
                `            "org_full_hierarchy"`,
                `        group by`,
                `            "team_id"`,
                `            , "team_name"`,
                `    )`,
                `    , "stage_1_teams" as (`,
                `        select`,
                `            "dept_id"`,
                `            , "dept_name"`,
                `            , jsonb_agg(jsonb_build_object('id', "team_id", 'name', "team_name", 'employees', "employees")) as "teams"`,
                `        from`,
                `            "stage_0_employees"`,
                `        group by`,
                `            "dept_id"`,
                `            , "dept_name"`,
                `    )`,
                `    , "stage_2_departments" as (`,
                `        select`,
                `            "division_id"`,
                `            , "division_name"`,
                `            , jsonb_agg(jsonb_build_object('id', "dept_id", 'name', "dept_name", 'teams', "teams")) as "departments"`,
                `        from`,
                `            "stage_1_teams"`,
                `        group by`,
                `            "division_id"`,
                `            , "division_name"`,
                `    )`,
                `    , "final_result" as (`,
                `        select`,
                `            jsonb_agg(jsonb_build_object('id', "division_id", 'name', "division_name", 'departments', "departments")) as "result"`,
                `        from`,
                `            "stage_2_departments"`,
                `    )`,
                `select`,
                `    "result" as "Divisions"`,
                `from`,
                `    "final_result"`
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

            const builder = new PostgreJsonQueryBuilder();
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
                useJsonb: true
            };

            const jsonQuery = builder.buildJson(originalQuery, mapping);
            const formatter = new SqlFormatter(customStyle);
            const formattedSql = formatter.format(jsonQuery).formattedSql;

            console.log("=== COMPLEX MIXED RELATIONSHIPS SQL ===");
            console.log(formattedSql);
            console.log("======================================");

            const expectedSql = [
                `with`,
                `    "stage_0_orderLines" as (`,
                `        select`,
                `            "order_id"`,
                `            , "order_date"`,
                `            , "order_status"`,
                `            , "customer_id"`,
                `            , "customer_name"`,
                `            , "customer_email"`,
                `            , jsonb_agg(jsonb_build_object('id', "line_id", 'quantity', "line_quantity", 'price', "line_price", 'product', jsonb_build_object('id', "product_id", 'name', "product_name"))) as "lines"`,
                `        from`,
                `            "order_details_view"`,
                `        group by`,
                `            "order_id"`,
                `            , "order_date"`,
                `            , "order_status"`,
                `            , "customer_id"`,
                `            , "customer_name"`,
                `            , "customer_email"`,
                `    )`,
                `    , "final_result" as (`,
                `        select`,
                `            jsonb_agg(jsonb_build_object('id', "order_id", 'date', "order_date", 'status', "order_status", 'lines', "lines", 'customer', jsonb_build_object('id', "customer_id", 'name', "customer_name", 'email', "customer_email"))) as "result"`,
                `        from`,
                `            "stage_0_orderLines"`,
                `    )`,
                `select`,
                `    "result" as "Orders"`,
                `from`,
                `    "final_result"`
            ].join('\n');

            expect(formattedSql).toBe(expectedSql);
        });
    });
});

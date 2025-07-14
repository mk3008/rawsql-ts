import { describe, test, expect, beforeEach } from "vitest";
import { SelectQueryParser } from "../../src/parsers/SelectQueryParser";
import { SimpleSelectQuery } from "../../src/models/SimpleSelectQuery";
import { CTEQueryDecomposer } from "../../src/transformers/CTEQueryDecomposer";

describe("CTEQueryDecomposer", () => {
    let decomposer: CTEQueryDecomposer;

    beforeEach(() => {
        decomposer = new CTEQueryDecomposer({ addComments: false });
    });

    describe("Basic CTE decomposition", () => {
        test("decompose simple CTE into executable query", () => {
            const sql = "with dat as (select * from users) select * from dat";
            const query = SelectQueryParser.parse(sql) as SimpleSelectQuery;
            
            const result = decomposer.decompose(query);
            
            expect(result).toHaveLength(1);
            expect(result[0]).toEqual({
                name: "dat",
                query: "select * from \"users\"",
                dependencies: [],
                dependents: [],
                isRecursive: false
            });
        });

        test("decompose multiple CTEs", () => {
            const sql = `
                with 
                    users_data as (select * from users),
                    active_users as (select * from users_data where active = true)
                select * from active_users
            `;
            const query = SelectQueryParser.parse(sql) as SimpleSelectQuery;
            
            const result = decomposer.decompose(query);
            
            expect(result).toHaveLength(2);
            
            // users_data: no dependencies
            const usersData = result.find(r => r.name === "users_data");
            expect(usersData).toEqual({
                name: "users_data",
                query: "select * from \"users\"",
                dependencies: [],
                dependents: ["active_users"],
                isRecursive: false
            });
            
            // active_users: depends on users_data
            const activeUsers = result.find(r => r.name === "active_users");
            expect(activeUsers).toEqual({
                name: "active_users", 
                query: "with users_data as (select * from \"users\") select * from \"users_data\" where \"active\" = true",
                dependencies: ["users_data"],
                dependents: [],
                isRecursive: false
            });
        });
    });

    describe("Recursive CTE", () => {
        test("recursive CTE should be handled as self-referential", () => {
            const sql = `
                with recursive hierarchy as (
                    select id, parent_id, name, 0 as level from categories where parent_id is null
                    union all
                    select c.id, c.parent_id, c.name, h.level + 1 
                    from categories c 
                    join hierarchy h on c.parent_id = h.id
                )
                select * from hierarchy
            `;
            const query = SelectQueryParser.parse(sql) as SimpleSelectQuery;
            
            const result = decomposer.decompose(query);
            
            expect(result).toHaveLength(1);
            const hierarchy = result[0];
            expect(hierarchy.name).toBe("hierarchy");
            expect(hierarchy.isRecursive).toBe(true);
            expect(hierarchy.dependencies).toEqual([]);
            expect(hierarchy.dependents).toEqual([]);
            // recursive CTE preserves the original query structure
            expect(hierarchy.query).toContain("with recursive \"hierarchy\" as");
        });
    });

    describe("Chained CTE", () => {
        test("handle CTEs with chain dependencies", () => {
            const sql = `
                with 
                    step1 as (select * from raw_data),
                    step2 as (select * from step1 where condition1 = true),
                    step3 as (select * from step2 where condition2 = true)
                select * from step3
            `;
            const query = SelectQueryParser.parse(sql) as SimpleSelectQuery;
            
            const result = decomposer.decompose(query);
            
            expect(result).toHaveLength(3);
            
            const step1 = result.find(r => r.name === "step1");
            expect(step1?.query).toBe("select * from \"raw_data\"");
            expect(step1?.dependencies).toEqual([]);
            
            const step2 = result.find(r => r.name === "step2");
            expect(step2?.query).toBe("with step1 as (select * from \"raw_data\") select * from \"step1\" where \"condition1\" = true");
            expect(step2?.dependencies).toEqual(["step1"]);
            
            const step3 = result.find(r => r.name === "step3");
            expect(step3?.query).toBe("with step1 as (select * from \"raw_data\"), step2 as (select * from \"step1\" where \"condition1\" = true) select * from \"step2\" where \"condition2\" = true");
            expect(step3?.dependencies).toEqual(["step2"]);
        });
    });

    describe("Formatter styles", () => {
        test("format with PostgreSQL style", () => {
            const sql = "with dat as (select * from users) select * from dat";
            const query = SelectQueryParser.parse(sql) as SimpleSelectQuery;
            
            const decomposerWithPostgres = new CTEQueryDecomposer({ preset: "postgres" });
            const result = decomposerWithPostgres.decompose(query);
            
            expect(result).toHaveLength(1);
            expect(result[0]).toEqual({
                name: "dat",
                query: "select * from \"users\"",
                dependencies: [],
                dependents: [],
                isRecursive: false
            });
        });

        test("format with MySQL style", () => {
            const sql = "with dat as (select * from users) select * from dat";
            const query = SelectQueryParser.parse(sql) as SimpleSelectQuery;
            
            const decomposerWithMySQL = new CTEQueryDecomposer({ preset: "mysql" });
            const result = decomposerWithMySQL.decompose(query);
            
            expect(result).toHaveLength(1);
            expect(result[0]).toEqual({
                name: "dat",
                query: "select * from `users`",
                dependencies: [],
                dependents: [],
                isRecursive: false
            });
        });

        test("custom formatter options", () => {
            const sql = "with dat as (select * from users) select * from dat";
            const query = SelectQueryParser.parse(sql) as SimpleSelectQuery;
            
            const decomposerWithCustom = new CTEQueryDecomposer({ 
                keywordCase: "upper",
                indentSize: 4 
            });
            const result = decomposerWithCustom.decompose(query);
            
            expect(result).toHaveLength(1);
            expect(result[0].query).toContain("SELECT");
            expect(result[0].query).toContain("FROM");
        });

        test("option without identifier escaping", () => {
            const sql = "with dat as (select * from users) select * from dat";
            const query = SelectQueryParser.parse(sql) as SimpleSelectQuery;
            
            const decomposerWithoutEscape = new CTEQueryDecomposer({ 
                identifierEscape: { start: "", end: "" }
            });
            const result = decomposerWithoutEscape.decompose(query);
            
            expect(result).toHaveLength(1);
            expect(result[0]).toEqual({
                name: "dat",
                query: "select * from users",
                dependencies: [],
                dependents: [],
                isRecursive: false
            });
        });
    });

    describe("Comment functionality", () => {
        test("generate query with comments", () => {
            const sql = "with dat as (select * from users) select * from dat";
            const query = SelectQueryParser.parse(sql) as SimpleSelectQuery;
            
            const decomposer = new CTEQueryDecomposer({ 
                addComments: true,
                exportComment: true 
            });
            const result = decomposer.decompose(query);
            
            expect(result).toHaveLength(1);
            expect(result[0].query).toContain("Auto-generated by CTE decomposer");
            expect(result[0].query).toContain("Original CTE: dat");
            expect(result[0].query).toContain("Dependencies: none");
            expect(result[0].query).toContain("Dependents: none");
        });

        test("comments for CTEs with dependencies", () => {
            const sql = `
                with 
                    users_data as (select * from users),
                    active_users as (select * from users_data where active = true)
                select * from active_users
            `;
            const query = SelectQueryParser.parse(sql) as SimpleSelectQuery;
            
            const decomposer = new CTEQueryDecomposer({ 
                addComments: true,
                exportComment: true 
            });
            const result = decomposer.decompose(query);
            
            expect(result).toHaveLength(2);
            
            const usersData = result.find(r => r.name === "users_data");
            expect(usersData?.query).toContain("Auto-generated by CTE decomposer");
            expect(usersData?.query).toContain("Original CTE: users_data");
            expect(usersData?.query).toContain("Dependencies: none");
            expect(usersData?.query).toContain("Dependents: active_users");
            
            const activeUsers = result.find(r => r.name === "active_users");
            expect(activeUsers?.query).toContain("Auto-generated by CTE decomposer");
            expect(activeUsers?.query).toContain("Original CTE: active_users");
            expect(activeUsers?.query).toContain("Dependencies: users_data");
            expect(activeUsers?.query).toContain("Dependents: none");
        });

        test("option without comments", () => {
            const sql = "with dat as (select * from users) select * from dat";
            const query = SelectQueryParser.parse(sql) as SimpleSelectQuery;
            
            const decomposer = new CTEQueryDecomposer({ addComments: false });
            const result = decomposer.decompose(query);
            
            expect(result[0].query).not.toContain("Auto-generated by CTE decomposer");
        });

        test("comments for recursive CTE", () => {
            const sql = `
                with recursive hierarchy as (
                    select id, parent_id, name, 0 as level from categories where parent_id is null
                    union all
                    select c.id, c.parent_id, c.name, h.level + 1 
                    from categories c 
                    join hierarchy h on c.parent_id = h.id
                )
                select * from hierarchy
            `;
            const query = SelectQueryParser.parse(sql) as SimpleSelectQuery;
            
            const decomposer = new CTEQueryDecomposer({ 
                addComments: true,
                exportComment: true 
            });
            const result = decomposer.decompose(query);
            
            expect(result).toHaveLength(1);
            expect(result[0].query).toContain("Auto-generated by CTE decomposer");
            expect(result[0].query).toContain("Original CTE: hierarchy");
            expect(result[0].query).toContain("Type: Recursive CTE");
        });

        test("generated SQL full text verification - comments should be placed before WITH clause", () => {
            const sql = `
                with 
                    base_data as (select * from users),
                    filtered_data as (select * from base_data where active = true)
                select * from filtered_data
            `;
            const query = SelectQueryParser.parse(sql) as SimpleSelectQuery;
            
            const decomposer = new CTEQueryDecomposer({ 
                addComments: true,
                exportComment: true,
                identifierEscape: { start: "", end: "" }  // No quotes for readability
            });
            const result = decomposer.decompose(query);
            
            expect(result).toHaveLength(2);
            
            // Detailed verification of filtered_data query
            const filteredData = result.find(r => r.name === "filtered_data");
            expect(filteredData).toBeDefined();
            
            console.log("=== Generated SQL Full Text ===");
            console.log(filteredData?.query);
            console.log("=== End of Generated SQL ===");
            
            // Expected format: comments should appear before WITH clause
            const expectedSql = `/* Auto-generated by CTE decomposer */ /* Original CTE: filtered_data */ /* Dependencies: base_data */ /* Dependents: none */  with base_data as (select * from users) select * from base_data where active = true`;
            
            expect(filteredData?.query).toBe(expectedSql);
        });

        test("verify all comment elements are present in generated SQL", () => {
            const sql = `
                with 
                    users_table as (select id, name, email from users where deleted_at is null),
                    active_users as (select * from users_table where status = 'active'),
                    premium_users as (select * from active_users where plan = 'premium')
                select count(*) from premium_users
            `;
            const query = SelectQueryParser.parse(sql) as SimpleSelectQuery;
            
            const decomposer = new CTEQueryDecomposer({ 
                addComments: true,
                exportComment: true,
                identifierEscape: { start: "", end: "" }
            });
            const result = decomposer.decompose(query);
            
            expect(result).toHaveLength(3);
            
            // Test each CTE has proper comments
            const usersTable = result.find(r => r.name === "users_table");
            const activeUsers = result.find(r => r.name === "active_users");
            const premiumUsers = result.find(r => r.name === "premium_users");
            
            // Verify users_table (no dependencies, has dependents)
            expect(usersTable?.query).toContain("Auto-generated by CTE decomposer");
            expect(usersTable?.query).toContain("Original CTE: users_table");
            expect(usersTable?.query).toContain("Dependencies: none");
            expect(usersTable?.query).toContain("Dependents: active_users");
            
            // Verify active_users (has dependencies and dependents)
            expect(activeUsers?.query).toContain("Auto-generated by CTE decomposer");
            expect(activeUsers?.query).toContain("Original CTE: active_users");
            expect(activeUsers?.query).toContain("Dependencies: users_table");
            expect(activeUsers?.query).toContain("Dependents: premium_users");
            
            // Verify premium_users (has dependencies, no dependents)
            expect(premiumUsers?.query).toContain("Auto-generated by CTE decomposer");
            expect(premiumUsers?.query).toContain("Original CTE: premium_users");
            expect(premiumUsers?.query).toContain("Dependencies: active_users");
            expect(premiumUsers?.query).toContain("Dependents: none");
            
            // Verify comments appear before the actual SQL content
            expect(usersTable?.query).toMatch(/^\/\* Auto-generated by CTE decomposer \*\//);
            expect(activeUsers?.query).toMatch(/^\/\* Auto-generated by CTE decomposer \*\//);
            expect(premiumUsers?.query).toMatch(/^\/\* Auto-generated by CTE decomposer \*\//);
        });

        test("verify recursive CTE comment structure", () => {
            const sql = `
                with recursive category_tree as (
                    select id, parent_id, name, 0 as level 
                    from categories 
                    where parent_id is null
                    union all
                    select c.id, c.parent_id, c.name, ct.level + 1
                    from categories c
                    join category_tree ct on c.parent_id = ct.id
                )
                select * from category_tree order by level, name
            `;
            const query = SelectQueryParser.parse(sql) as SimpleSelectQuery;
            
            const decomposer = new CTEQueryDecomposer({ 
                addComments: true,
                exportComment: true,
                identifierEscape: { start: "", end: "" }
            });
            const result = decomposer.decompose(query);
            
            expect(result).toHaveLength(1);
            
            const categoryTree = result[0];
            expect(categoryTree.name).toBe("category_tree");
            expect(categoryTree.isRecursive).toBe(true);
            
            // Verify recursive CTE specific comments
            expect(categoryTree.query).toContain("Auto-generated by CTE decomposer");
            expect(categoryTree.query).toContain("Original CTE: category_tree");
            expect(categoryTree.query).toContain("Type: Recursive CTE");
            expect(categoryTree.query).toContain("Dependencies: none");
            expect(categoryTree.query).toContain("Dependents: none");
            
            // Verify the original recursive structure is preserved
            expect(categoryTree.query).toContain("with recursive");
            expect(categoryTree.query).toContain("union all");
            
            // Verify comments appear at the beginning
            expect(categoryTree.query).toMatch(/^\/\* Auto-generated by CTE decomposer \*\//);
        });
    });

    describe("Error cases", () => {
        test("should throw error for circular reference in non-recursive CTE", () => {
            const sql = `
                with 
                    a as (select * from b),
                    b as (select * from a)
                select * from a
            `;
            const query = SelectQueryParser.parse(sql) as SimpleSelectQuery;
            
            expect(() => decomposer.decompose(query)).toThrow("Circular reference detected");
        });
    });
});
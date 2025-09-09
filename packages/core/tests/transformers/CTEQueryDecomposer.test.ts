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

    describe("Synchronize functionality", () => {
        test("synchronize resolves inconsistencies between edited CTEs", () => {
            // Arrange - Create inconsistent edits
            const inconsistentEdits = [
                {
                    name: "users_data",
                    query: "select id, name from users where active = true"
                },
                {
                    name: "active_users", 
                    query: "select * from users_data where id >= 1000"  // Expects all columns but users_data only has id, name
                }
            ];
            const rootQuery = "select count(*) from active_users";

            // Act - Synchronize to resolve inconsistencies
            const result = decomposer.synchronize(inconsistentEdits, rootQuery);

            // Assert - Inconsistencies should be resolved
            expect(result).toHaveLength(2);
            
            const usersData = result.find(cte => cte.name === "users_data");
            const activeUsers = result.find(cte => cte.name === "active_users");
            
            expect(usersData).toBeDefined();
            expect(activeUsers).toBeDefined();
            
            // users_data should maintain its new definition (accounting for formatter quotes)
            expect(usersData!.query).toContain("\"id\"");
            expect(usersData!.query).toContain("\"name\"");
            expect(usersData!.query).toContain("\"active\" = true");
            
            // active_users should reference the updated users_data definition
            expect(activeUsers!.query).toContain("users_data");
            expect(activeUsers!.query).toContain("\"id\" >= 1000");
            expect(activeUsers!.dependencies).toContain("users_data");
        });

        test("synchronize handles empty array", () => {
            // Arrange
            const editedCTEs: Array<{name: string, query: string}> = [];
            const rootQuery = "select 1";

            // Act
            const result = decomposer.synchronize(editedCTEs, rootQuery);

            // Assert
            expect(result).toHaveLength(0);
        });

        test("synchronize preserves CTE metadata", () => {
            // Arrange
            const editedCTEs = [
                {
                    name: "base_table",
                    query: "select * from users where status = 'active'"
                },
                {
                    name: "filtered_table",
                    query: "select id, name from base_table where created_at > '2024-01-01'"
                }
            ];
            const rootQuery = "select count(*) from filtered_table";

            // Act
            const result = decomposer.synchronize(editedCTEs, rootQuery);

            // Assert
            expect(result).toHaveLength(2);
            
            const baseTable = result.find(cte => cte.name === "base_table");
            const filteredTable = result.find(cte => cte.name === "filtered_table");
            
            // Verify metadata is correct
            expect(baseTable!.dependencies).toHaveLength(0);
            expect(baseTable!.dependents).toContain("filtered_table");
            expect(baseTable!.isRecursive).toBe(false);
            
            expect(filteredTable!.dependencies).toContain("base_table");
            expect(filteredTable!.dependents).toHaveLength(0);
            expect(filteredTable!.isRecursive).toBe(false);
        });

        test("synchronize handles WITH clause in edited CTEs", () => {
            // Arrange - Edited CTE contains WITH clause (like from decomposer output)
            const editedCTEs = [
                {
                    name: "complex_table",
                    query: "with temp_data as (select * from users where active = true) select id, name from temp_data where id > 100"
                }
            ];
            const rootQuery = "select * from complex_table";

            // Act
            const result = decomposer.synchronize(editedCTEs, rootQuery);

            // Assert
            expect(result).toHaveLength(2);  // Should expand to temp_data + complex_table
            
            const tempData = result.find(cte => cte.name === "temp_data");
            const complexTable = result.find(cte => cte.name === "complex_table");
            
            expect(tempData).toBeDefined();
            expect(complexTable).toBeDefined();
            expect(complexTable!.dependencies).toContain("temp_data");
        });
    });

    describe("CTE Restoration Feature", () => {
        test("restore simple CTE with no dependencies", () => {
            const sql = "with users_data as (select * from users where active = true) select * from users_data";
            const query = SelectQueryParser.parse(sql) as SimpleSelectQuery;
            
            const result = decomposer.extractCTE(query, 'users_data');
            
            expect(result.name).toBe('users_data');
            expect(result.executableSql).toBe('select * from \"users\" where \"active\" = true');
            expect(result.dependencies).toEqual([]);
            expect(result.warnings).toEqual([]);
        });

        test("restore CTE with single dependency", () => {
            const sql = `
                with users_data as (select * from users where active = true),
                     filtered_users as (select * from users_data where created_at > '2023-01-01')
                select * from filtered_users
            `;
            const query = SelectQueryParser.parse(sql) as SimpleSelectQuery;
            
            const result = decomposer.extractCTE(query, 'filtered_users');
            
            expect(result.name).toBe('filtered_users');
            expect(result.dependencies).toEqual(['users_data']);
            
            // Should include the dependency in WITH clause
            expect(result.executableSql).toContain('with users_data as');
            expect(result.executableSql).toContain('select * from \"users_data\" where \"created_at\" > \'2023-01-01\'');
        });

        test("restore CTE with multiple dependencies in correct order", () => {
            const sql = `
                with base_users as (select * from users),
                     active_users as (select * from base_users where active = true),
                     premium_users as (select * from active_users where premium = true),
                     final_report as (select count(*) as total from premium_users)
                select * from final_report
            `;
            const query = SelectQueryParser.parse(sql) as SimpleSelectQuery;
            
            const result = decomposer.extractCTE(query, 'final_report');
            
            expect(result.name).toBe('final_report');
            expect(result.dependencies).toEqual(['base_users', 'active_users', 'premium_users']);
            
            // Should include all dependencies in correct order
            const sql_lines = result.executableSql.split('\n').join(' ');
            expect(sql_lines).toContain('with base_users as');
            expect(sql_lines).toContain('active_users as');
            expect(sql_lines).toContain('premium_users as');
            
            // Verify dependencies come in correct order (base_users before active_users, etc.)
            const baseIndex = sql_lines.indexOf('base_users as');
            const activeIndex = sql_lines.indexOf('active_users as');
            const premiumIndex = sql_lines.indexOf('premium_users as');
            
            expect(baseIndex).toBeLessThan(activeIndex);
            expect(activeIndex).toBeLessThan(premiumIndex);
        });

        test("restore CTE with comments enabled", () => {
            const decomposerWithComments = new CTEQueryDecomposer({ 
                addComments: true,
                exportComment: true 
            });
            
            const sql = `
                with users_data as (select * from users),
                     active_users as (select * from users_data where active = true)
                select * from active_users
            `;
            const query = SelectQueryParser.parse(sql) as SimpleSelectQuery;
            
            const result = decomposerWithComments.extractCTE(query, 'active_users');
            
            expect(result.executableSql).toContain('-- CTE Restoration: active_users');
            expect(result.executableSql).toContain('-- Dependencies: users_data');
            expect(result.executableSql).toContain('-- Generated by CTEQueryDecomposer.extractCTE()');
        });

        test("restore CTE handles recursive CTEs with warning", () => {
            const sql = `
                with recursive user_hierarchy as (
                    select id, name, manager_id, 0 as level from users where manager_id is null
                    union all
                    select u.id, u.name, u.manager_id, uh.level + 1
                    from users u
                    join user_hierarchy uh on u.manager_id = uh.id
                )
                select * from user_hierarchy
            `;
            const query = SelectQueryParser.parse(sql) as SimpleSelectQuery;
            
            const result = decomposer.extractCTE(query, 'user_hierarchy');
            
            expect(result.name).toBe('user_hierarchy');
            expect(result.warnings).toContain('Recursive CTE restoration requires the full query context');
            
            // Should return the full query for recursive CTEs
            expect(result.executableSql).toContain('with recursive');
        });

        test("restore CTE throws error when CTE not found", () => {
            const sql = "with users_data as (select * from users) select * from users_data";
            const query = SelectQueryParser.parse(sql) as SimpleSelectQuery;
            
            expect(() => {
                decomposer.extractCTE(query, 'nonexistent_cte');
            }).toThrow('CTE not found in query: nonexistent_cte');
        });

        test("restore CTE throws error when query has no CTEs", () => {
            const sql = "select * from users where active = true";
            const query = SelectQueryParser.parse(sql) as SimpleSelectQuery;
            
            expect(() => {
                decomposer.extractCTE(query, 'some_cte');
            }).toThrow('Query does not contain any CTEs');
        });

        test("restore CTE handles complex dependency chain correctly", () => {
            const sql = `
                with a as (select * from table_a),
                     b as (select * from table_b),
                     c as (select * from a union select * from b),
                     d as (select * from c where condition = 'value'),
                     e as (select * from d group by column)
                select * from e
            `;
            const query = SelectQueryParser.parse(sql) as SimpleSelectQuery;
            
            // Test restoration of CTE 'e' which depends on the entire chain
            const result = decomposer.extractCTE(query, 'e');
            
            expect(result.name).toBe('e');
            expect(result.dependencies).toEqual(['a', 'b', 'c', 'd']);
            
            // Verify all required CTEs are included in correct order
            const executableSql = result.executableSql;
            expect(executableSql).toContain('with a as');
            expect(executableSql).toContain('b as');
            expect(executableSql).toContain('c as');
            expect(executableSql).toContain('d as');
            
            // Test restoration of intermediate CTE 'c'
            const resultC = decomposer.extractCTE(query, 'c');
            expect(resultC.dependencies).toEqual(['a', 'b']);
            expect(resultC.executableSql).toContain('with a as');
            expect(resultC.executableSql).toContain('b as');
            expect(resultC.executableSql).not.toContain('d as'); // Should not include d
        });

        test("restore CTE with formatted output options", () => {
            const decomposerFormatted = new CTEQueryDecomposer({
                keywordCase: 'upper',
                identifierEscape: { start: '[', end: ']' }
            });
            
            const sql = `
                with users_data as (select id, name from users),
                     active_users as (select * from users_data where active = true)
                select * from active_users
            `;
            const query = SelectQueryParser.parse(sql) as SimpleSelectQuery;
            
            const result = decomposerFormatted.extractCTE(query, 'active_users');
            
            // Should apply formatting options to output
            expect(result.executableSql.toUpperCase()).toContain('WITH');
            expect(result.executableSql).toContain('[users_data]');
            expect(result.executableSql).toContain('[active]');
        });

        test("extract CTE with multiple dependencies referencing same base CTE", () => {
            const sql = `
                with a as (select * from table1),
                     b as (select * from a),
                     c as (select * from a),
                     d as (select * from c)
                select * from d
            `;
            const query = SelectQueryParser.parse(sql) as SimpleSelectQuery;
            
            const result = decomposer.extractCTE(query, 'd');
            
            expect(result.name).toBe('d');
            expect(result.dependencies).toEqual(['a', 'c']);
            
            // Should include dependencies in correct order
            const sqlLines = result.executableSql.split('\n').join(' ');
            expect(sqlLines).toContain('with a as');
            expect(sqlLines).toContain('c as');
            expect(sqlLines).not.toContain('b as'); // b should not be included as it's not a dependency of d
            
            // Verify no duplicate CTEs - 'a' should appear only once in WITH clause
            const aMatches = (sqlLines.match(/\ba as\b/g) || []).length;
            expect(aMatches).toBe(1); // 'a' should appear exactly once
            
            // Additional verification: check that the WITH clause structure is correct
            // Should be: with a as (...), c as (...) select ...
            // NOT: with a as (...), a as (...), c as (...) select ...
            const withClauseMatch = sqlLines.match(/with\s+.*?\s+select/i);
            expect(withClauseMatch).toBeTruthy();
            if (withClauseMatch) {
                const withClause = withClauseMatch[0];
                // Count CTE definitions in WITH clause
                const cteCount = (withClause.match(/\w+\s+as\s*\(/g) || []).length;
                expect(cteCount).toBe(2); // Should be exactly 2 CTEs: 'a' and 'c'
            }
            
            // Verify the extracted query contains the target CTE's definition
            expect(sqlLines).toContain('select * from "c"');
        });

        test("extract non-recursive CTE that depends on recursive CTE", () => {
            const sql = `
                with recursive a as (
                    select id, name, 0 as level from employees where manager_id is null
                    union all
                    select e.id, e.name, a.level + 1 
                    from employees e 
                    join a on e.manager_id = a.id
                ),
                b as (select * from a where level <= 2)
                select * from b
            `;
            const query = SelectQueryParser.parse(sql) as SimpleSelectQuery;
            
            const result = decomposer.extractCTE(query, 'b');
            
            expect(result.name).toBe('b');
            expect(result.dependencies).toEqual(['a']);
            
            // Should include the recursive CTE in the WITH clause
            const sqlLines = result.executableSql.split('\n').join(' ');
            expect(sqlLines).toContain('with recursive');
            expect(sqlLines).toContain('union all');
            expect(sqlLines).toContain('where "level" <= 2');
        });
    });
});
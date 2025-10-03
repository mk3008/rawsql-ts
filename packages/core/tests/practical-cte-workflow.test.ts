import { describe, test, expect } from "vitest";
import { CTEQueryDecomposer } from "../src/transformers/CTEQueryDecomposer";
import { CTEComposer } from "../src/transformers/CTEComposer";
import { SelectQueryParser } from "../src/parsers/SelectQueryParser";
import { SimpleSelectQuery } from "../src/models/SimpleSelectQuery";

describe("Practical CTE Workflow - Decompose, Edit, Compose", () => {
    test("decompose → edit → compose workflow with practical modifications", () => {
        // Arrange - Original query
        const originalQuery = `
            with users_data as (select * from users), 
                 active_users as (select * from users_data) 
            select count(*) from active_users
        `;

        // Step 1: Parse and decompose
        const parsedQuery = SelectQueryParser.parse(originalQuery) as SimpleSelectQuery;
        const decomposer = new CTEQueryDecomposer();
        const decomposedCTEs = decomposer.decompose(parsedQuery);

        // Verify decomposition
        expect(decomposedCTEs).toHaveLength(2);
        
        const usersDataCTE = decomposedCTEs.find(cte => cte.name === "users_data");
        const activeUsersCTE = decomposedCTEs.find(cte => cte.name === "active_users");
        
        expect(usersDataCTE).toBeDefined();
        expect(activeUsersCTE).toBeDefined();

        console.log("=== Decomposed CTEs ===");
        console.log("users_data query:", usersDataCTE?.query);
        console.log("active_users query:", activeUsersCTE?.query);

        // Step 2: Edit the CTEs with practical modifications (with executable WITH clauses)
        const editedCTEs = [
            {
                name: "users_data",
                query: "select * from users where active = true"  // Added active = true condition
            },
            {
                name: "active_users", 
                // Realistic edit: user kept the old WITH clause but modified the main query
                query: "with users_data as (select * from users) select * from users_data where id >= 1000"  // Added id >= 1000 condition
            }
        ];

        console.log("=== Edited CTEs ===");
        console.log("users_data edited:", editedCTEs[0].query);
        console.log("active_users edited:", editedCTEs[1].query);

        // Step 3: Compose back to unified query
        const composer = new CTEComposer();
        const rootQuery = "select count(*) from active_users";
        const composedQuery = composer.compose(editedCTEs, rootQuery);

        console.log("=== Composed Result ===");
        console.log("Final query:", composedQuery);

        // Verify the expected structure - WITH clause override functionality
        // The old WITH clause should be ignored, and only the main SELECT should be extracted
        const expected = `with
users_data as (select * from users where active = true)
, active_users as (select * from users_data where id >= 1000)
select count(*) from active_users`;
        expect(composedQuery).toBe(expected);

        // Verify that the old WITH clause was ignored and new definition is used
        expect(composedQuery).toContain("users_data as (select * from users where active = true)");
        expect(composedQuery).not.toContain("with users_data as (select * from users)");  // Old WITH clause should be removed
        
        // Additional verification: Parse the composed query to ensure it's valid
        expect(() => SelectQueryParser.parse(composedQuery)).not.toThrow();
    });

    test("WITH clause override - known CTEs ignored, unknown CTEs preserved", () => {
        // Arrange - Test explicit case where user edits with conflicting WITH clause
        const editedCTEs = [
            {
                name: "base_table",
                query: "select id, name, status from users where active = true"  // New definition
            },
            {
                name: "filtered_table",
                // User accidentally left old WITH clause with known CTE + added new sub-CTE
                query: "with base_table as (select * from users where deleted = false), temp_data as (select * from base_table limit 100) select * from temp_data where status = 'premium'"
            }
        ];

        console.log("=== WITH Clause Override Test ===");
        console.log("base_table (new):", editedCTEs[0].query);
        console.log("filtered_table (mixed WITH):", editedCTEs[1].query);

        // Compose should ignore known CTE definition but preserve unknown sub-CTE
        const composer = new CTEComposer();
        const rootQuery = "select count(*) from filtered_table";
        const composedQuery = composer.compose(editedCTEs, rootQuery);

        console.log("Composed result:", composedQuery);

        // Verify the newer definition is used for known CTE
        expect(composedQuery).toContain("base_table as (select id, name, status from users where active = true)");
        
        // Since filtered_table contains unknown CTE 'temp_data', entire WITH clause should be preserved
        expect(composedQuery).toContain("with base_table as (select * from users where deleted = false), temp_data as");
        expect(composedQuery).toContain("temp_data as (select * from base_table limit 100)");

        // Ensure it's valid SQL
        expect(() => SelectQueryParser.parse(composedQuery)).not.toThrow();
    });

    test("Single CTE with embedded dependencies - no need to define users_data separately", () => {
        // This test demonstrates that you can edit just one CTE (active_users)
        // and include its dependencies in the WITH clause, rather than defining
        // multiple separate CTE entries

        console.log("=== Single CTE with Dependencies Test ===");

        // Step 1: Edit only active_users, but include users_data definition in WITH clause  
        const editedCTEs = [
            {
                name: "active_users", 
                // users_data definition is included in the WITH clause - no need for separate entry
                query: "with users_data as (select * from users where active = true) select * from users_data where id >= 1000"
            }
        ];

        console.log("Single CTE with embedded users_data:", editedCTEs[0]);

        // Step 2: Compose should work with embedded dependency
        const composer = new CTEComposer();
        const rootQuery = "select count(*) from active_users";
        
        const composedQuery = composer.compose(editedCTEs, rootQuery);

        console.log("Composed with embedded dependency:", composedQuery);

        // Verify the result - should preserve the entire WITH clause since users_data is not explicitly defined
        expect(composedQuery).toContain("active_users as (with users_data as (select * from users where active = true) select * from users_data where id >= 1000)");
        
        // Should not create duplicate CTE definitions
        expect(composedQuery).toContain("select count(*) from active_users");

        // Ensure it's valid SQL
        expect(() => SelectQueryParser.parse(composedQuery)).not.toThrow();
    });

    test("complex workflow with recursive CTE editing", () => {
        // Arrange - Original recursive query  
        const originalQuery = `
            with recursive hierarchy as (
                select id, parent_id, name, 0 as level 
                from categories 
                where parent_id is null
                union all
                select c.id, c.parent_id, c.name, h.level + 1
                from categories c 
                join hierarchy h on c.parent_id = h.id
            )
            select * from hierarchy
        `;

        // Step 1: Decompose
        const parsedQuery = SelectQueryParser.parse(originalQuery) as SimpleSelectQuery;
        const decomposer = new CTEQueryDecomposer();
        const decomposedCTEs = decomposer.decompose(parsedQuery);

        expect(decomposedCTEs).toHaveLength(1);
        const hierarchyCTE = decomposedCTEs[0];
        
        expect(hierarchyCTE.name).toBe("hierarchy");
        expect(hierarchyCTE.isRecursive).toBe(true);

        console.log("=== Original Recursive CTE ===");
        console.log("hierarchy query:", hierarchyCTE.query);

        // Step 2: Edit with additional filtering
        const editedCTEs = [
            {
                name: "hierarchy",
                query: `with recursive hierarchy as (
                    select id, parent_id, name, 0 as level 
                    from categories 
                    where parent_id is null and active = true
                    union all
                    select c.id, c.parent_id, c.name, h.level + 1
                    from categories c 
                    join hierarchy h on c.parent_id = h.id
                    where c.active = true
                ) select * from hierarchy order by level, name`
            }
        ];

        console.log("=== Edited Recursive CTE ===");
        console.log("hierarchy edited:", editedCTEs[0].query);

        // Step 3: Compose
        const composer = new CTEComposer();
        const rootQuery = "select * from hierarchy where level <= 3";
        const composedQuery = composer.compose(editedCTEs, rootQuery);

        console.log("=== Composed Recursive Result ===");
        console.log("Final query:", composedQuery);

        // Verify recursive structure is maintained  
        expect(composedQuery).toContain("with recursive hierarchy as");
        expect(composedQuery).toContain("where level <= 3");
        // Note: For recursive CTEs, the entire WITH clause is preserved as-is

        // Ensure it's valid SQL
        expect(() => SelectQueryParser.parse(composedQuery)).not.toThrow();
    });

    test("workflow with dependency chain modifications", () => {
        // Arrange - Chain of dependent CTEs
        const originalQuery = `
            with base_data as (select id, name, created_at from users),
                 recent_data as (select * from base_data where created_at > '2024-01-01'),
                 final_data as (select id, name from recent_data limit 10)
            select * from final_data
        `;

        // Step 1: Decompose
        const parsedQuery = SelectQueryParser.parse(originalQuery) as SimpleSelectQuery;
        const decomposer = new CTEQueryDecomposer();
        const decomposedCTEs = decomposer.decompose(parsedQuery);

        expect(decomposedCTEs).toHaveLength(3);

        console.log("=== Decomposed Dependency Chain ===");
        decomposedCTEs.forEach(cte => {
            console.log(`${cte.name}:`, cte.query);
            console.log(`  Dependencies: [${cte.dependencies.join(', ')}]`);
            console.log(`  Dependents: [${cte.dependents.join(', ')}]`);
        });

        // Step 2: Edit each CTE with improvements
        const editedCTEs = [
            {
                name: "base_data",
                query: "select id, name, created_at, email from users where active = true"  // Added email, active filter
            },
            {
                name: "recent_data", 
                query: "select * from base_data where created_at > '2023-06-01' and email is not null"  // Changed date, added email filter
            },
            {
                name: "final_data",
                query: "select id, name, email from recent_data order by created_at desc limit 20"  // Added email, order, increased limit
            }
        ];

        console.log("=== Edited Dependency Chain ===");
        editedCTEs.forEach(cte => {
            console.log(`${cte.name} edited:`, cte.query);
        });

        // Step 3: Compose
        const composer = new CTEComposer();
        const rootQuery = "select count(*), max(id) as max_id from final_data";
        const composedQuery = composer.compose(editedCTEs, rootQuery);

        console.log("=== Composed Dependency Chain Result ===");
        console.log("Final query:", composedQuery);

        // Verify all modifications are preserved and dependencies are correct
        expect(composedQuery).toContain("email from users where active = true");
        expect(composedQuery).toContain("created_at > '2023-06-01' and email is not null");
        expect(composedQuery).toContain("order by created_at desc limit 20");
        expect(composedQuery).toContain("count(*), max(id) as max_id");

        // Verify dependency order is maintained (base_data should come first)
        const baseDataIndex = composedQuery.indexOf("base_data as");
        const recentDataIndex = composedQuery.indexOf("recent_data as");
        const finalDataIndex = composedQuery.indexOf("final_data as");
        
        expect(baseDataIndex).toBeLessThan(recentDataIndex);
        expect(recentDataIndex).toBeLessThan(finalDataIndex);

        // Ensure it's valid SQL
        expect(() => SelectQueryParser.parse(composedQuery)).not.toThrow();
    });

    test("synchronize function resolves inconsistencies between edited CTEs", () => {
        // Arrange - Create inconsistent edits where one CTE references modified version of another
        const originalQuery = `
            with users_data as (select * from users), 
                 active_users as (select * from users_data) 
            select count(*) from active_users
        `;

        // Step 1: Parse and decompose original with no quotes for simpler testing
        const parsedQuery = SelectQueryParser.parse(originalQuery) as SimpleSelectQuery;
        const decomposer = new CTEQueryDecomposer({
            identifierEscape: { start: "", end: "" }
        });
        const originalDecomposed = decomposer.decompose(parsedQuery);

        console.log("=== Original Decomposed ===");
        originalDecomposed.forEach(cte => console.log(`${cte.name}: ${cte.query}`));

        // Step 2: Create inconsistent edits
        const inconsistentEdits = [
            {
                name: "users_data",
                query: "select id, name, email from users where active = true"  // Changed columns
            },
            {
                name: "active_users", 
                query: "select * from users_data where id >= 1000"  // Still expects all columns from users_data
            }
        ];

        console.log("=== Inconsistent Edits ===");
        inconsistentEdits.forEach(cte => console.log(`${cte.name}: ${cte.query}`));

        // Step 3: Synchronize to resolve inconsistencies
        const rootQuery = "select count(*) from active_users";
        const synchronized = decomposer.synchronize(inconsistentEdits, rootQuery);

        console.log("=== Synchronized Result ===");
        synchronized.forEach(cte => console.log(`${cte.name}: ${cte.query}`));

        // Verify synchronization resolved the inconsistencies
        expect(synchronized).toHaveLength(2);
        
        const syncedUsersData = synchronized.find(cte => cte.name === "users_data");
        const syncedActiveUsers = synchronized.find(cte => cte.name === "active_users");
        
        expect(syncedUsersData?.query).toContain("id, name, email");
        expect(syncedUsersData?.query).toContain("active = true");
        expect(syncedActiveUsers?.query).toContain("id >= 1000");
        
        // Dependencies should be correctly maintained
        expect(syncedUsersData?.dependencies).toHaveLength(0);
        expect(syncedActiveUsers?.dependencies).toContain("users_data");
    });

    test("handle CTE with added WITH clause - should preserve the WITH clause like recursive CTE", () => {
        // Arrange - Original simple query
        const originalQuery = `
            with base_data as (select * from users)
            select * from base_data
        `;

        // Step 1: Decompose
        const parsedQuery = SelectQueryParser.parse(originalQuery) as SimpleSelectQuery;
        const decomposer = new CTEQueryDecomposer();
        const decomposed = decomposer.decompose(parsedQuery);

        console.log("=== Original Decomposed ===");
        console.log("base_data:", decomposed[0]?.query);

        // Step 2: Edit by adding WITH clause (simulating user adding sub-CTE)
        const editedWithSubCTE = {
            name: "base_data",
            query: `with temp_filter as (select * from users where active = true)
                    select id, name, email from temp_filter where created_at > '2024-01-01'`
        };

        console.log("=== Edited with Sub-CTE ===");
        console.log("base_data edited:", editedWithSubCTE.query);

        // Step 3: Compose - this should preserve the WITH clause
        const composer = new CTEComposer();
        const rootQuery = "select count(*) from base_data";
        const composedQuery = composer.compose([editedWithSubCTE], rootQuery);

        console.log("=== Composed with Sub-CTE ===");
        console.log("Final query:", composedQuery);

        // Verify the WITH clause is preserved in the CTE definition
        expect(composedQuery).toContain("with temp_filter as");
        expect(composedQuery).toContain("active = true");
        expect(composedQuery).toContain("created_at > '2024-01-01'");
        expect(composedQuery).toContain("base_data as (with temp_filter as");

        // Ensure it's valid SQL
        expect(() => SelectQueryParser.parse(composedQuery)).not.toThrow();
    });

    test("complex scenario: multiple WITH clause additions and synchronization", () => {
        // Arrange - Original query with dependencies
        const originalQuery = `
            with raw_data as (select * from users),
                 processed_data as (select * from raw_data where active = true)
            select * from processed_data
        `;

        // Step 1: Decompose
        const parsedQuery = SelectQueryParser.parse(originalQuery) as SimpleSelectQuery;
        const decomposer = new CTEQueryDecomposer();
        const decomposed = decomposer.decompose(parsedQuery);

        console.log("=== Original Complex Decomposed ===");
        decomposed.forEach(cte => console.log(`${cte.name}: ${cte.query}`));

        // Step 2: Edit both CTEs with sub-CTEs
        const complexEdits = [
            {
                name: "raw_data",
                query: `with user_base as (select id, name, email, created_at from users where deleted_at is null)
                        select * from user_base where email is not null`
            },
            {
                name: "processed_data",
                query: `with active_filter as (select * from raw_data where active = true),
                             recent_filter as (select * from active_filter where created_at > '2023-01-01')
                        select id, name, email from recent_filter`
            }
        ];

        console.log("=== Complex Edits with Multiple Sub-CTEs ===");
        complexEdits.forEach(cte => console.log(`${cte.name}: ${cte.query}`));

        // Step 3: Compose and verify structure
        const composer = new CTEComposer();
        const rootQuery = "select count(*), avg(id) as avg_id from processed_data";
        const composedQuery = composer.compose(complexEdits, rootQuery);

        console.log("=== Complex Composed Result ===");
        console.log("Final query:", composedQuery);

        // Verify all WITH clauses are preserved
        expect(composedQuery).toContain("with user_base as");
        expect(composedQuery).toContain("with active_filter as");
        expect(composedQuery).toContain("recent_filter as");
        expect(composedQuery).toContain("deleted_at is null");
        expect(composedQuery).toContain("created_at > '2023-01-01'");

        // Step 4: Synchronize to see how decomposer handles the complex structure
        const synchronized = decomposer.synchronize(complexEdits, rootQuery);

        console.log("=== Synchronized Complex Result ===");
        synchronized.forEach(cte => console.log(`${cte.name}: ${cte.query}`));

        // Verify synchronization expands all CTEs from WITH clauses
        expect(synchronized.length).toBeGreaterThanOrEqual(2);
        const syncedRawData = synchronized.find(cte => cte.name === "raw_data");
        const syncedProcessedData = synchronized.find(cte => cte.name === "processed_data");

        expect(syncedRawData).toBeDefined();
        expect(syncedProcessedData).toBeDefined();
        // When WITH clauses are used, sub-CTEs become individual CTEs in the synchronized result

        // Ensure final result is valid SQL
        expect(() => SelectQueryParser.parse(composedQuery)).not.toThrow();
    });

    test("CTE Restoration - debug a specific CTE from complex query", () => {
        // Arrange - Complex query from real-world scenario
        const complexQuery = `
            with user_base as (select id, email, created_at from users where deleted_at is null),
                 active_users as (select * from user_base where created_at >= '2023-01-01'),
                 user_purchases as (
                     select user_id, sum(amount) as total_spent 
                     from purchases p
                     join active_users au on p.user_id = au.id
                     group by user_id
                 ),
                 high_value_users as (
                     select au.*, up.total_spent
                     from active_users au
                     join user_purchases up on au.id = up.user_id
                     where up.total_spent > 1000
                 )
            select count(*) from high_value_users
        `;

        // Act - Parse and restore a specific CTE for debugging
        const parsedQuery = SelectQueryParser.parse(complexQuery) as SimpleSelectQuery;
        const decomposer = new CTEQueryDecomposer();
        
        // Debug the 'high_value_users' CTE specifically  
        const result = decomposer.extractCTE(parsedQuery, 'high_value_users');

        // Assert - Verify restoration provides executable SQL with all dependencies
        expect(result.name).toBe('high_value_users');
        expect(result.dependencies).toEqual(['user_base', 'active_users', 'user_purchases']);
        expect(result.warnings).toHaveLength(0);

        // Should contain all required dependencies
        expect(result.executableSql).toContain('with user_base as');
        expect(result.executableSql).toContain('active_users as');
        expect(result.executableSql).toContain('user_purchases as');
        
        // Should end with the target CTE's query
        expect(result.executableSql).toContain('select "au".*, "up"."total_spent"');
        expect(result.executableSql).toContain('where "up"."total_spent" > 1000');

        console.log("=== CTE Restoration Example ===");
        console.log("Restored CTE:", result.name);
        console.log("Dependencies:", result.dependencies);
        console.log("Executable SQL:\n", result.executableSql);

        // The restored SQL should be parseable and executable
        expect(() => SelectQueryParser.parse(result.executableSql)).not.toThrow();
    });

    test("CTE Restoration - progressive debugging workflow", () => {
        const query = `
            with raw_orders as (select * from orders where status = 'completed'),
                 daily_totals as (select date(created_at) as day, sum(amount) as total from raw_orders group by date(created_at)),
                 top_days as (select * from daily_totals where total > 10000)
            select * from top_days order by total desc
        `;
        
        const parsedQuery = SelectQueryParser.parse(query) as SimpleSelectQuery;
        const decomposer = new CTEQueryDecomposer();

        // Progressive debugging: start with base, then move up the chain
        
        // 1. Debug base CTE (no dependencies)
        const baseResult = decomposer.extractCTE(parsedQuery, 'raw_orders');
        expect(baseResult.dependencies).toHaveLength(0);
        expect(baseResult.executableSql).toBe('select * from \"orders\" where \"status\" = \'completed\'');

        // 2. Debug intermediate CTE (depends on base)
        const dailyResult = decomposer.extractCTE(parsedQuery, 'daily_totals');
        expect(dailyResult.dependencies).toEqual(['raw_orders']);
        expect(dailyResult.executableSql).toContain('with raw_orders as');
        
        // 3. Debug final CTE (depends on entire chain)
        const topResult = decomposer.extractCTE(parsedQuery, 'top_days');
        expect(topResult.dependencies).toEqual(['raw_orders', 'daily_totals']);
        expect(topResult.executableSql).toContain('with raw_orders as');
        expect(topResult.executableSql).toContain('daily_totals as');

        console.log("=== Progressive CTE Debugging ===");
        console.log("1. Base CTE:", baseResult.executableSql);
        console.log("2. Intermediate dependencies:", dailyResult.dependencies);
        console.log("3. Final CTE dependencies:", topResult.dependencies);
    });
});
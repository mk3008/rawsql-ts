import { describe, test, expect, beforeEach } from 'vitest';
import { CTEDependencyAnalyzer } from '../../src/transformers/CTEDependencyAnalyzer';
import { SimpleSelectQuery } from '../../src/models/SimpleSelectQuery';
import { SelectQueryParser } from '../../src/parsers/SelectQueryParser';
import { Formatter } from '../../src/transformers/Formatter';

describe('CTEDependencyAnalyzer', () => {
    let analyzer: CTEDependencyAnalyzer;
    let formatter: Formatter;

    beforeEach(() => {
        analyzer = new CTEDependencyAnalyzer();
        formatter = new Formatter();
    });

    /**
     * Helper function to validate SQL syntax by re-parsing
     */
    function validateSqlSyntax(sql: string): void {
        try {
            const reparsedQuery = SelectQueryParser.parse(sql);
            expect(reparsedQuery).toBeDefined();
        } catch (error) {
            throw new Error(`Generated SQL is syntactically invalid: ${sql}\nError: ${error}`);
        }
    }

    /**
     * Helper function to normalize SQL for comparison
     */
    function normalizeForComparison(sql: string): string {
        return sql.trim().replace(/\s+/g, ' ');
    }

    /**
     * Helper function to validate complete SQL with expected result
     */
    function validateCompleteSQL(actualSql: string, expectedSql: string): void {
        validateSqlSyntax(actualSql);
        const normalizedActual = normalizeForComparison(actualSql);
        const normalizedExpected = normalizeForComparison(expectedSql);
        expect(normalizedActual).toBe(normalizedExpected);
    }

    test('should analyze simple CTE dependencies with complete SQL validation', () => {
        const sql = `
            WITH user_orders AS (
                SELECT user_id, COUNT(*) as order_count 
                FROM orders 
                GROUP BY user_id
            ),
            active_users AS (
                SELECT * FROM users WHERE active = true
            ),
            summary AS (
                SELECT au.*, uo.order_count
                FROM active_users au
                LEFT JOIN user_orders uo ON au.id = uo.user_id
            )
            SELECT * FROM summary
        `;

        const parsedQuery = SelectQueryParser.parse(sql);
        const query = parsedQuery as SimpleSelectQuery;
        const graph = analyzer.analyzeDependencies(query);

        // Validate the complete structure (filter out MAIN_QUERY node)
        const cteNodes = analyzer.getNodesByType('CTE');
        expect(cteNodes).toHaveLength(3);
        expect(graph.edges.filter(e => e.from !== 'MAIN_QUERY' && e.to !== 'MAIN_QUERY')).toHaveLength(2);

        // Validate each CTE's SQL definition
        const userOrdersCTE = cteNodes.find(n => n.name === 'user_orders');
        expect(userOrdersCTE).toBeDefined();
        const userOrdersSQL = formatter.format(userOrdersCTE!.cte.query);
        const expectedUserOrdersSQL = 'select "user_id", count(*) as "order_count" from "orders" group by "user_id"';
        validateCompleteSQL(userOrdersSQL, expectedUserOrdersSQL);

        const activeUsersCTE = cteNodes.find(n => n.name === 'active_users');
        expect(activeUsersCTE).toBeDefined();
        const activeUsersSQL = formatter.format(activeUsersCTE!.cte.query);
        const expectedActiveUsersSQL = 'select * from "users" where "active" = true';
        validateCompleteSQL(activeUsersSQL, expectedActiveUsersSQL);

        const summaryCTE = cteNodes.find(n => n.name === 'summary');
        expect(summaryCTE).toBeDefined();
        const summarySQL = formatter.format(summaryCTE!.cte.query);
        const expectedSummarySQL = 'select "au".*, "uo"."order_count" from "active_users" as "au" left join "user_orders" as "uo" on "au"."id" = "uo"."user_id"';
        validateCompleteSQL(summarySQL, expectedSummarySQL);

        // Validate dependencies with exact arrays
        const summaryDeps = analyzer.getDependencies('summary');
        expect(summaryDeps.sort()).toEqual(['active_users', 'user_orders']);
        expect(analyzer.getDependencies('user_orders')).toEqual([]);
        expect(analyzer.getDependencies('active_users')).toEqual([]);

        // Validate dependents with exact arrays
        expect(analyzer.getDependents('user_orders')).toEqual(['summary']);
        expect(analyzer.getDependents('active_users')).toEqual(['summary']);
        expect(analyzer.getDependents('summary')).toEqual(['MAIN_QUERY']);
    });

    test('should generate correct execution order with deterministic results', () => {
        const sql = `
            WITH user_orders AS (
                SELECT user_id, COUNT(*) as order_count 
                FROM orders 
                GROUP BY user_id
            ),
            active_users AS (
                SELECT * FROM users WHERE active = true
            ),
            summary AS (
                SELECT au.*, uo.order_count
                FROM active_users au
                LEFT JOIN user_orders uo ON au.id = uo.user_id
            )
            SELECT * FROM summary
        `;

        const parsedQuery = SelectQueryParser.parse(sql);
        const query = parsedQuery as SimpleSelectQuery;
        analyzer.analyzeDependencies(query);
        
        const executionOrder = analyzer.getExecutionOrder();
        
        // Filter out MAIN_QUERY from execution order
        const cteExecutionOrder = executionOrder.filter(name => name !== 'MAIN_QUERY');
        
        // Validate exact execution order
        expect(cteExecutionOrder).toHaveLength(3);
        
        // user_orders and active_users should come before summary (exact position validation)
        const summaryIndex = cteExecutionOrder.indexOf('summary');
        const userOrdersIndex = cteExecutionOrder.indexOf('user_orders');
        const activeUsersIndex = cteExecutionOrder.indexOf('active_users');
        
        expect(summaryIndex).toBe(2); // summary should be last
        expect(userOrdersIndex).toBeLessThan(summaryIndex);
        expect(activeUsersIndex).toBeLessThan(summaryIndex);
        
        // Validate that the order respects dependencies
        const possibleOrders = [
            ['user_orders', 'active_users', 'summary'],
            ['active_users', 'user_orders', 'summary']
        ];
        expect(possibleOrders.some(order => 
            JSON.stringify(order) === JSON.stringify(cteExecutionOrder)
        )).toBe(true);
    });

    test('should handle chain dependencies with complete SQL validation', () => {
        const sql = `
            WITH base_data AS (
                SELECT * FROM raw_table
            ),
            processed_data AS (
                SELECT id, value * 2 as doubled_value
                FROM base_data
            ),
            final_result AS (
                SELECT id, doubled_value, doubled_value + 10 as final_value
                FROM processed_data
            )
            SELECT * FROM final_result
        `;

        const parsedQuery = SelectQueryParser.parse(sql);
        const query = parsedQuery as SimpleSelectQuery;
        const graph = analyzer.analyzeDependencies(query);

        const cteNodes = analyzer.getNodesByType('CTE');
        expect(cteNodes).toHaveLength(3);
        expect(graph.edges.filter(e => e.from !== 'MAIN_QUERY' && e.to !== 'MAIN_QUERY')).toHaveLength(2);

        // Validate each CTE's SQL definition in the chain
        const baseDataCTE = cteNodes.find(n => n.name === 'base_data');
        expect(baseDataCTE).toBeDefined();
        const baseDataSQL = formatter.format(baseDataCTE!.cte.query);
        const expectedBaseDataSQL = 'select * from "raw_table"';
        validateCompleteSQL(baseDataSQL, expectedBaseDataSQL);

        const processedDataCTE = cteNodes.find(n => n.name === 'processed_data');
        expect(processedDataCTE).toBeDefined();
        const processedDataSQL = formatter.format(processedDataCTE!.cte.query);
        const expectedProcessedDataSQL = 'select "id", "value" * 2 as "doubled_value" from "base_data"';
        validateCompleteSQL(processedDataSQL, expectedProcessedDataSQL);

        const finalResultCTE = cteNodes.find(n => n.name === 'final_result');
        expect(finalResultCTE).toBeDefined();
        const finalResultSQL = formatter.format(finalResultCTE!.cte.query);
        const expectedFinalResultSQL = 'select "id", "doubled_value", "doubled_value" + 10 as "final_value" from "processed_data"';
        validateCompleteSQL(finalResultSQL, expectedFinalResultSQL);

        // Validate exact chain dependencies
        expect(analyzer.getDependencies('base_data')).toEqual([]);
        expect(analyzer.getDependencies('processed_data')).toEqual(['base_data']);
        expect(analyzer.getDependencies('final_result')).toEqual(['processed_data']);

        // Validate exact execution order
        const executionOrder = analyzer.getExecutionOrder();
        const cteExecutionOrder = executionOrder.filter(name => name !== 'MAIN_QUERY');
        expect(cteExecutionOrder).toEqual(['base_data', 'processed_data', 'final_result']);
    });

    test('should detect circular dependencies with complete validation', () => {
        const sql = `
            WITH cte_a AS (
                SELECT * FROM cte_b
            ),
            cte_b AS (
                SELECT * FROM cte_a
            )
            SELECT * FROM cte_a
        `;

        const parsedQuery = SelectQueryParser.parse(sql);
        const query = parsedQuery as SimpleSelectQuery;
        const graph = analyzer.analyzeDependencies(query);

        // Validate the circular dependency structure
        const cteNodes = analyzer.getNodesByType('CTE');
        expect(cteNodes).toHaveLength(2);
        expect(graph.edges.filter(e => e.from !== 'MAIN_QUERY' && e.to !== 'MAIN_QUERY')).toHaveLength(2);

        // Validate each CTE's SQL definition
        const cteACTE = cteNodes.find(n => n.name === 'cte_a');
        expect(cteACTE).toBeDefined();
        const cteASQL = formatter.format(cteACTE!.cte.query);
        const expectedCteASQL = 'select * from "cte_b"';
        validateCompleteSQL(cteASQL, expectedCteASQL);

        const cteBCTE = cteNodes.find(n => n.name === 'cte_b');
        expect(cteBCTE).toBeDefined();
        const cteBSQL = formatter.format(cteBCTE!.cte.query);
        const expectedCteBSQL = 'select * from "cte_a"';
        validateCompleteSQL(cteBSQL, expectedCteBSQL);

        // Validate circular dependencies
        expect(analyzer.getDependencies('cte_a')).toEqual(['cte_b']);
        expect(analyzer.getDependencies('cte_b')).toEqual(['cte_a']);
        expect(analyzer.getDependents('cte_a').sort()).toEqual(['MAIN_QUERY', 'cte_b']);
        expect(analyzer.getDependents('cte_b')).toEqual(['cte_a']);

        expect(analyzer.hasCircularDependency()).toBe(true);
        expect(() => analyzer.getExecutionOrder()).toThrow('Circular reference detected');
    });

    test('should handle complex diamond dependencies (DAG) with complete validation', () => {
        const sql = `
            WITH cte_a AS (
                SELECT * FROM base_table
            ),
            cte_b AS (
                SELECT * FROM cte_a
            ),
            cte_c AS (
                SELECT * FROM cte_b
            ),
            cte_d AS (
                SELECT * FROM cte_c
                UNION ALL
                SELECT * FROM cte_b
            )
            SELECT * FROM cte_d
        `;

        const parsedQuery = SelectQueryParser.parse(sql);
        const query = parsedQuery as SimpleSelectQuery;
        const graph = analyzer.analyzeDependencies(query);

        const cteNodes = analyzer.getNodesByType('CTE');
        expect(cteNodes).toHaveLength(4);
        
        // Validate each CTE's SQL definition
        const cteACTE = cteNodes.find(n => n.name === 'cte_a');
        const cteASQL = formatter.format(cteACTE!.cte.query);
        const expectedCteASQL = 'select * from "base_table"';
        validateCompleteSQL(cteASQL, expectedCteASQL);

        const cteBCTE = cteNodes.find(n => n.name === 'cte_b');
        const cteBSQL = formatter.format(cteBCTE!.cte.query);
        const expectedCteBSQL = 'select * from "cte_a"';
        validateCompleteSQL(cteBSQL, expectedCteBSQL);

        const cteCCTE = cteNodes.find(n => n.name === 'cte_c');
        const cteCSQL = formatter.format(cteCCTE!.cte.query);
        const expectedCteCSQL = 'select * from "cte_b"';
        validateCompleteSQL(cteCSQL, expectedCteCSQL);

        const cteDCTE = cteNodes.find(n => n.name === 'cte_d');
        const cteDSQL = formatter.format(cteDCTE!.cte.query);
        const expectedCteDSQL = 'select * from "cte_c" union all select * from "cte_b"';
        validateCompleteSQL(cteDSQL, expectedCteDSQL);

        // Validate dependencies - cte_d references both cte_c and cte_b, but no cycle exists
        expect(analyzer.getDependencies('cte_a')).toEqual([]);
        expect(analyzer.getDependencies('cte_b')).toEqual(['cte_a']);
        expect(analyzer.getDependencies('cte_c')).toEqual(['cte_b']);
        expect(analyzer.getDependencies('cte_d').sort()).toEqual(['cte_b', 'cte_c']);

        // This is NOT a circular dependency - it's a diamond pattern (DAG)
        expect(analyzer.hasCircularDependency()).toBe(false);
    });

    test('should detect complex circular dependencies with complete validation', () => {
        const sql = `
            WITH cte_a AS (
                SELECT * FROM base_table
            ),
            cte_b AS (
                SELECT * FROM cte_a
            ),
            cte_c AS (
                SELECT * FROM cte_b
                UNION ALL
                SELECT * FROM cte_d  -- This creates the cycle: b->c->d->b
            ),
            cte_d AS (
                SELECT * FROM cte_c
            )
            SELECT * FROM cte_d
        `;

        const parsedQuery = SelectQueryParser.parse(sql);
        const query = parsedQuery as SimpleSelectQuery;
        const graph = analyzer.analyzeDependencies(query);

        const cteNodes = analyzer.getNodesByType('CTE');
        expect(cteNodes).toHaveLength(4);
        
        // Validate dependencies that create the actual cycle
        expect(analyzer.getDependencies('cte_a')).toEqual([]);
        expect(analyzer.getDependencies('cte_b')).toEqual(['cte_a']);
        expect(analyzer.getDependencies('cte_c').sort()).toEqual(['cte_b', 'cte_d']);
        expect(analyzer.getDependencies('cte_d')).toEqual(['cte_c']);

        expect(analyzer.hasCircularDependency()).toBe(true);
    });

    test('should handle no circular dependencies with complete validation', () => {
        const sql = `
            WITH cte_a AS (
                SELECT * FROM base_table
            ),
            cte_b AS (
                SELECT * FROM cte_a
            ),
            cte_c AS (
                SELECT * FROM cte_a
            )
            SELECT * FROM cte_b UNION ALL SELECT * FROM cte_c
        `;

        const parsedQuery = SelectQueryParser.parse(sql);
        const query = parsedQuery as SimpleSelectQuery;
        const graph = analyzer.analyzeDependencies(query);

        const cteNodes = analyzer.getNodesByType('CTE');
        expect(cteNodes).toHaveLength(3);
        expect(graph.edges.filter(e => e.from !== 'MAIN_QUERY' && e.to !== 'MAIN_QUERY')).toHaveLength(2);

        // Validate each CTE's SQL definition
        const cteACTE = cteNodes.find(n => n.name === 'cte_a');
        const cteASQL = formatter.format(cteACTE!.cte.query);
        const expectedCteASQL = 'select * from "base_table"';
        validateCompleteSQL(cteASQL, expectedCteASQL);

        const cteBCTE = cteNodes.find(n => n.name === 'cte_b');
        const cteBSQL = formatter.format(cteBCTE!.cte.query);
        const expectedCteBSQL = 'select * from "cte_a"';
        validateCompleteSQL(cteBSQL, expectedCteBSQL);

        const cteCCTE = cteNodes.find(n => n.name === 'cte_c');
        const cteCSQL = formatter.format(cteCCTE!.cte.query);
        const expectedCteCSQL = 'select * from "cte_a"';
        validateCompleteSQL(cteCSQL, expectedCteCSQL);

        // Validate dependencies - both b and c depend on a, but no cycles
        expect(analyzer.getDependencies('cte_a')).toEqual([]);
        expect(analyzer.getDependencies('cte_b')).toEqual(['cte_a']);
        expect(analyzer.getDependencies('cte_c')).toEqual(['cte_a']);
        
        // Validate dependents
        expect(analyzer.getDependents('cte_a').sort()).toEqual(['cte_b', 'cte_c']);
        expect(analyzer.getDependents('cte_b')).toEqual(['MAIN_QUERY']);
        expect(analyzer.getDependents('cte_c')).toEqual(['MAIN_QUERY']);

        expect(analyzer.hasCircularDependency()).toBe(false);
        
        const executionOrder = analyzer.getExecutionOrder();
        const cteExecutionOrder = executionOrder.filter(name => name !== 'MAIN_QUERY');
        expect(cteExecutionOrder).toHaveLength(3);
        
        const cteAIndex = cteExecutionOrder.indexOf('cte_a');
        const cteBIndex = cteExecutionOrder.indexOf('cte_b');
        const cteCIndex = cteExecutionOrder.indexOf('cte_c');
        
        // cte_a should come before both cte_b and cte_c
        expect(cteAIndex).toBe(0); // cte_a should be first
        expect(cteAIndex).toBeLessThan(cteBIndex);
        expect(cteAIndex).toBeLessThan(cteCIndex);
    });

    test('should handle empty CTEs with complete validation', () => {
        const sql = `SELECT * FROM users`;
        
        const parsedQuery = SelectQueryParser.parse(sql);
        const query = parsedQuery as SimpleSelectQuery;
        
        // Validate the original query SQL
        const querySQL = formatter.format(query);
        const expectedQuerySQL = 'select * from "users"';
        validateCompleteSQL(querySQL, expectedQuerySQL);
        
        const graph = analyzer.analyzeDependencies(query);

        const cteNodes = analyzer.getNodesByType('CTE');
        expect(cteNodes).toHaveLength(0);
        expect(graph.edges).toHaveLength(0);
        const cteExecutionOrder = analyzer.getExecutionOrder().filter(name => name !== 'MAIN_QUERY');
        expect(cteExecutionOrder).toHaveLength(0);
        expect(analyzer.hasCircularDependency()).toBe(false);
    });

    test('should handle single CTE with no dependencies and complete validation', () => {
        const sql = `
            WITH single_cte AS (
                SELECT * FROM base_table
            )
            SELECT * FROM single_cte
        `;

        const parsedQuery = SelectQueryParser.parse(sql);
        const query = parsedQuery as SimpleSelectQuery;
        const graph = analyzer.analyzeDependencies(query);

        const cteNodes = analyzer.getNodesByType('CTE');
        expect(cteNodes).toHaveLength(1);
        expect(graph.edges.filter(e => e.from !== 'MAIN_QUERY' && e.to !== 'MAIN_QUERY')).toHaveLength(0);
        
        // Validate the CTE's SQL definition
        const singleCTE = cteNodes.find(n => n.name === 'single_cte');
        expect(singleCTE).toBeDefined();
        const singleCTESQL = formatter.format(singleCTE!.cte.query);
        const expectedSingleCTESQL = 'select * from "base_table"';
        validateCompleteSQL(singleCTESQL, expectedSingleCTESQL);
        
        expect(analyzer.getDependencies('single_cte')).toEqual([]);
        expect(analyzer.getDependents('single_cte')).toEqual(['MAIN_QUERY']);
        const cteExecutionOrder = analyzer.getExecutionOrder().filter(name => name !== 'MAIN_QUERY');
        expect(cteExecutionOrder).toEqual(['single_cte']);
        expect(analyzer.hasCircularDependency()).toBe(false);
    });

    test('should throw error when accessing methods before analysis', () => {
        expect(() => analyzer.getDependencies('test')).toThrow('Must call analyzeDependencies first');
        expect(() => analyzer.getDependents('test')).toThrow('Must call analyzeDependencies first');
        expect(() => analyzer.hasCircularDependency()).toThrow('Must call analyzeDependencies first');
        expect(() => analyzer.getExecutionOrder()).toThrow('Must call analyzeDependencies first');
    });

    test('should handle non-existent CTE names gracefully', () => {
        const sql = `
            WITH test_cte AS (
                SELECT * FROM base_table
            )
            SELECT * FROM test_cte
        `;

        const parsedQuery = SelectQueryParser.parse(sql);
        const query = parsedQuery as SimpleSelectQuery;
        analyzer.analyzeDependencies(query);

        expect(analyzer.getDependencies('non_existent')).toHaveLength(0);
        expect(analyzer.getDependents('non_existent')).toHaveLength(0);
    });

    test('should handle complex multi-level dependencies with complete validation', () => {
        const sql = `
            WITH level1_a AS (
                SELECT * FROM raw_data_a
            ),
            level1_b AS (
                SELECT * FROM raw_data_b
            ),
            level2_a AS (
                SELECT * FROM level1_a
                UNION ALL
                SELECT * FROM level1_b
            ),
            level2_b AS (
                SELECT * FROM level1_a
            ),
            level3 AS (
                SELECT la.*, lb.extra_col
                FROM level2_a la
                JOIN level2_b lb ON la.id = lb.id
            )
            SELECT * FROM level3
        `;

        const parsedQuery = SelectQueryParser.parse(sql);
        const query = parsedQuery as SimpleSelectQuery;
        const graph = analyzer.analyzeDependencies(query);

        const cteNodes = analyzer.getNodesByType('CTE');
        expect(cteNodes).toHaveLength(5);

        // Validate each CTE's SQL definition
        const level1aCTE = cteNodes.find(n => n.name === 'level1_a');
        const level1aSQL = formatter.format(level1aCTE!.cte.query);
        const expectedLevel1aSQL = 'select * from "raw_data_a"';
        validateCompleteSQL(level1aSQL, expectedLevel1aSQL);

        const level1bCTE = cteNodes.find(n => n.name === 'level1_b');
        const level1bSQL = formatter.format(level1bCTE!.cte.query);
        const expectedLevel1bSQL = 'select * from "raw_data_b"';
        validateCompleteSQL(level1bSQL, expectedLevel1bSQL);

        const level2aCTE = cteNodes.find(n => n.name === 'level2_a');
        const level2aSQL = formatter.format(level2aCTE!.cte.query);
        const expectedLevel2aSQL = 'select * from "level1_a" union all select * from "level1_b"';
        validateCompleteSQL(level2aSQL, expectedLevel2aSQL);

        const level2bCTE = cteNodes.find(n => n.name === 'level2_b');
        const level2bSQL = formatter.format(level2bCTE!.cte.query);
        const expectedLevel2bSQL = 'select * from "level1_a"';
        validateCompleteSQL(level2bSQL, expectedLevel2bSQL);

        const level3CTE = cteNodes.find(n => n.name === 'level3');
        const level3SQL = formatter.format(level3CTE!.cte.query);
        const expectedLevel3SQL = 'select "la".*, "lb"."extra_col" from "level2_a" as "la" join "level2_b" as "lb" on "la"."id" = "lb"."id"';
        validateCompleteSQL(level3SQL, expectedLevel3SQL);

        // Validate exact dependencies
        expect(analyzer.getDependencies('level1_a')).toEqual([]);
        expect(analyzer.getDependencies('level1_b')).toEqual([]);
        expect(analyzer.getDependencies('level2_a').sort()).toEqual(['level1_a', 'level1_b']);
        expect(analyzer.getDependencies('level2_b')).toEqual(['level1_a']);
        expect(analyzer.getDependencies('level3').sort()).toEqual(['level2_a', 'level2_b']);

        // Validate execution order preserves dependencies
        const executionOrder = analyzer.getExecutionOrder();
        const cteExecutionOrder = executionOrder.filter(name => name !== 'MAIN_QUERY');
        expect(cteExecutionOrder).toHaveLength(5);
        
        const level1aIndex = cteExecutionOrder.indexOf('level1_a');
        const level1bIndex = cteExecutionOrder.indexOf('level1_b');
        const level2aIndex = cteExecutionOrder.indexOf('level2_a');
        const level2bIndex = cteExecutionOrder.indexOf('level2_b');
        const level3Index = cteExecutionOrder.indexOf('level3');

        // Level 1 CTEs should come before level 2
        expect(level1aIndex).toBeLessThan(level2aIndex);
        expect(level1aIndex).toBeLessThan(level2bIndex);
        expect(level1bIndex).toBeLessThan(level2aIndex);
        
        // Level 2 CTEs should come before level 3
        expect(level2aIndex).toBeLessThan(level3Index);
        expect(level2bIndex).toBeLessThan(level3Index);
        
        // level3 should be the last one
        expect(level3Index).toBe(4);
    });
});
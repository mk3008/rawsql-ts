import { describe, test, expect, beforeEach } from 'vitest';
import { CTEDependencyAnalyzer } from '../../src/transformers/CTEDependencyAnalyzer';
import { SimpleSelectQuery } from '../../src/models/SimpleSelectQuery';
import { SelectQueryParser } from '../../src/parsers/SelectQueryParser';

describe('CTEDependencyAnalyzer - Main Query Dependencies Bug', () => {
    let analyzer: CTEDependencyAnalyzer;

    beforeEach(() => {
        analyzer = new CTEDependencyAnalyzer();
    });

    test('should detect main query dependencies on CTEs in simple case', () => {
        const sql = `
            WITH cte_a AS (
                SELECT id, name FROM users
            ),
            cte_b AS (
                SELECT id, title FROM products  
            )
            SELECT * FROM cte_a
            UNION ALL
            SELECT * FROM cte_b
        `;

        const parsedQuery = SelectQueryParser.parse(sql);
        const query = parsedQuery as SimpleSelectQuery;
        const graph = analyzer.analyzeDependencies(query);

        console.log('\n=== Main Query Dependencies Test (Breaking Change) ===');
        console.log('All nodes:', graph.nodes.map(n => ({ name: n.name, type: n.type, deps: n.dependencies })));
        console.log('All edges:', graph.edges);
        
        // After breaking change: main query is also included as a node
        expect(graph.nodes).toHaveLength(3); // cte_a, cte_b, MAIN_QUERY
        expect(graph.edges).toHaveLength(2); // MAIN_QUERY->cte_a, MAIN_QUERY->cte_b
        
        // Get only CTE nodes
        const cteNodes = analyzer.getNodesByType('CTE');
        expect(cteNodes).toHaveLength(2);
        expect(cteNodes.map(n => n.name).sort()).toEqual(['cte_a', 'cte_b']);
        
        // Get main query node
        const mainQueryNode = analyzer.getMainQueryNode();
        expect(mainQueryNode).toBeDefined();
        expect(mainQueryNode!.name).toBe('MAIN_QUERY');
        expect(mainQueryNode!.type).toBe('ROOT');
        expect(mainQueryNode!.cte).toBeNull();
        expect(mainQueryNode!.dependencies.sort()).toEqual(['cte_a', 'cte_b']);
        
        // Can also be retrieved using getMainQueryDependencies() method
        expect(analyzer.getMainQueryDependencies().sort()).toEqual(['cte_a', 'cte_b']);
    });

    test('should detect complex main query dependencies in UNION with CTEs', () => {
        // Simplified version of the previous complex query
        const sql = `
            WITH base_data AS (
                SELECT id FROM table1
            ),
            processed_data AS (
                SELECT id, value FROM base_data
            ),
            summary_a AS (
                SELECT COUNT(*) as count_a FROM processed_data
            ),
            summary_b AS (
                SELECT COUNT(*) as count_b FROM base_data
            )
            SELECT 'A' as type, count_a as total FROM summary_a
            UNION ALL
            SELECT 'B' as type, count_b as total FROM summary_b
        `;

        const parsedQuery = SelectQueryParser.parse(sql);
        const query = parsedQuery as SimpleSelectQuery;
        const graph = analyzer.analyzeDependencies(query);

        console.log('\n=== Complex Main Query Dependencies (Breaking Change) ===');
        console.log('All nodes:', graph.nodes.map(n => ({ name: n.name, type: n.type, deps: n.dependencies })));
        console.log('All edges:', graph.edges);
        
        // After breaking change: main query is also included as a node
        expect(graph.nodes).toHaveLength(5); // base_data, processed_data, summary_a, summary_b, MAIN_QUERY
        
        // Dependencies between CTEs are correctly detected
        expect(analyzer.getDependencies('processed_data')).toEqual(['base_data']);
        expect(analyzer.getDependencies('summary_a')).toEqual(['processed_data']);
        expect(analyzer.getDependencies('summary_b')).toEqual(['base_data']);
        
        // Main query dependencies are also detected
        expect(analyzer.getDependencies('MAIN_QUERY').sort()).toEqual(['summary_a', 'summary_b']);
        
        // Edge count is CTE-to-CTE(3) + main query dependencies(2) = 5
        expect(graph.edges).toHaveLength(5);
    });

    test('should demonstrate the root dependency problem', () => {
        const sql = `
            WITH leaf_cte AS (
                SELECT id FROM raw_table
            ),
            intermediate_cte AS (  
                SELECT id, value FROM another_table
            )
            SELECT id FROM leaf_cte
            UNION ALL
            SELECT id FROM intermediate_cte
        `;

        const parsedQuery = SelectQueryParser.parse(sql);
        const query = parsedQuery as SimpleSelectQuery;
        const graph = analyzer.analyzeDependencies(query);

        console.log('\n=== Root Dependency Problem (Fixed) ===');
        console.log('All nodes:', graph.nodes.map(n => ({ name: n.name, type: n.type, deps: n.dependencies })));
        console.log('Execution order:', analyzer.getExecutionOrder());
        
        // After breaking change: true dependencies are accurately represented
        expect(graph.nodes).toHaveLength(3); // leaf_cte, intermediate_cte, MAIN_QUERY
        
        // Nodes without dependencies (true root nodes) are only CTEs
        const independentCTEs = graph.nodes.filter(n => n.type === 'CTE' && n.dependencies.length === 0);
        expect(independentCTEs).toHaveLength(2);
        expect(independentCTEs.map(n => n.name).sort()).toEqual(['intermediate_cte', 'leaf_cte']);
        
        // Main query depends on both CTEs (root dependency count is not zero)
        const mainQueryNode = analyzer.getMainQueryNode();
        expect(mainQueryNode!.dependencies.sort()).toEqual(['intermediate_cte', 'leaf_cte']);
        expect(mainQueryNode!.dependencies.length).toBe(2); // Root dependency count is not zero!
        
        // エッジ数: MAIN_QUERY->leaf_cte, MAIN_QUERY->intermediate_cte
        expect(graph.edges).toHaveLength(2);
    });
});
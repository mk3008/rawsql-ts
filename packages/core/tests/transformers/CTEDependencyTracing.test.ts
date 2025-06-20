import { describe, it, expect } from 'vitest';
import { CTEDependencyTracer } from '../../src/transformers/CTEDependencyTracer';
import { SelectQueryParser } from '../../src/parsers/SelectQueryParser';

describe('CTE Dependency Tracing', () => {
    it('should trace complex CTE dependencies', () => {
        // Realistic complex SQL with multiple CTEs and dependencies
        const sql = `
      WITH 
        root_data AS (
          SELECT id, name, filterable_client_id FROM source_table
        ),
        filtered_data AS (
          SELECT id, name FROM root_data WHERE id > 0
        ),
        combined_data AS (
          SELECT id, name FROM filtered_data
          UNION ALL
          SELECT id, name FROM another_table
        ),
        final_result AS (
          SELECT name FROM combined_data
        )
      SELECT name FROM final_result
    `;
        const parsed = SelectQueryParser.parse(sql);
        const tracer = new CTEDependencyTracer();

        // console.log('\n🔍 Building CTE dependency graph...');
        const graph = tracer.buildGraph(parsed);

        // console.log(`Found ${graph.nodes.size} CTEs`);
        // console.log(`Root CTEs (no dependencies): ${graph.rootNodes.join(', ')}`);
        // console.log(`Leaf CTEs (not used by others): ${graph.leafNodes.join(', ')}`);

        // Print full graph
        tracer.printGraph(graph);

        // Trace specific columns
        // console.log('\n' + '='.repeat(60));

        const columnsToTrace = [
            'filterable_client_id', // Should be found only in root_data
            'name', // Should be found in multiple CTEs
            'id' // Should be found in some CTEs but not final
        ];

        // Test each column's trace results with assertions
        const filterableClientIdTrace = tracer.traceColumnSearch(parsed, 'filterable_client_id');
        tracer.printColumnTrace('filterable_client_id', filterableClientIdTrace);
        expect(filterableClientIdTrace.foundIn).toContain('root_data');
        expect(filterableClientIdTrace.foundIn).toHaveLength(1); // Only in root_data
        expect(filterableClientIdTrace.notFoundIn).toContain('filtered_data');
        expect(filterableClientIdTrace.notFoundIn).toContain('final_result');

        const nameTrace = tracer.traceColumnSearch(parsed, 'name');
        tracer.printColumnTrace('name', nameTrace);
        expect(nameTrace.foundIn).toContain('root_data');
        expect(nameTrace.foundIn).toContain('filtered_data');
        expect(nameTrace.foundIn).toContain('final_result');
        expect(nameTrace.foundIn.length).toBeGreaterThan(1); // Found in multiple CTEs

        const idTrace = tracer.traceColumnSearch(parsed, 'id');
        tracer.printColumnTrace('id', idTrace);
        expect(idTrace.foundIn).toContain('root_data');
        expect(idTrace.foundIn).toContain('filtered_data');
        expect(idTrace.notFoundIn).toContain('final_result'); // Lost in final_result

        expect(graph.nodes.size).toBe(4); // 4 CTEs
        expect(graph.rootNodes).toContain('root_data');
        expect(graph.leafNodes).toContain('final_result');
    });

    it('should trace simple CTE dependency chain', () => {
        const sql = `
      WITH 
        base_cte AS (
          SELECT id, special_col FROM table1
        ),
        middle_cte AS (
          SELECT id FROM base_cte
        ),
        final_cte AS (
          SELECT id FROM middle_cte
        )
      SELECT id FROM final_cte
    `;

        const parsed = SelectQueryParser.parse(sql);
        const tracer = new CTEDependencyTracer();

        // console.log('\n🔍 Simple dependency chain test...');
        const graph = tracer.buildGraph(parsed);
        tracer.printGraph(graph);

        const trace = tracer.traceColumnSearch(parsed, 'special_col');
        tracer.printColumnTrace('special_col', trace);

        // special_col should be found in base_cte but not in middle_cte or final_cte
        expect(trace.foundIn).toContain('base_cte');
        expect(trace.notFoundIn).toContain('middle_cte');
        expect(trace.notFoundIn).toContain('final_cte');
    });

    it('should run in silent mode without console output', () => {
        const sql = `
            WITH base_cte AS (
                SELECT id, special_col FROM table1
            )
            SELECT id FROM base_cte
        `;

        const parsed = SelectQueryParser.parse(sql);
        const silentTracer = new CTEDependencyTracer({ silent: true });

        // These should not produce any console output
        const graph = silentTracer.buildGraph(parsed);
        silentTracer.printGraph(graph);

        const trace = silentTracer.traceColumnSearch(parsed, 'special_col');
        silentTracer.printColumnTrace('special_col', trace);

        // Verify the functionality still works
        expect(graph.nodes.size).toBe(1);
        expect(graph.nodes.has('base_cte')).toBe(true);
        expect(trace.foundIn).toContain('base_cte');
    });
});

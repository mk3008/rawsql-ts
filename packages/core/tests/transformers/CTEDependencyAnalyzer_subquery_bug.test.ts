import { describe, test, expect, beforeEach } from 'vitest';
import { CTEDependencyAnalyzer } from '../../src/transformers/CTEDependencyAnalyzer';
import { SimpleSelectQuery } from '../../src/models/SimpleSelectQuery';
import { SelectQueryParser } from '../../src/parsers/SelectQueryParser';

describe('CTEDependencyAnalyzer - Subquery CTE Reference Bug', () => {
    let analyzer: CTEDependencyAnalyzer;

    beforeEach(() => {
        analyzer = new CTEDependencyAnalyzer();
    });

    test('should detect CTE references in FROM subqueries', () => {
        const sql = `
            WITH dat AS (
                SELECT id, unit_price, quantity FROM products
            )
            select
                q.*
                , trunc(q.price * (1 + q.tax_rate)) - q.price as tax
                , q.price * (1 + q.tax_rate) - q.price as raw_tax
            from
                (
                    select
                        dat.*
                        , (dat.unit_price * dat.quantity) as price
                    from
                        dat
                ) as q
        `;

        const parsedQuery = SelectQueryParser.parse(sql);
        const query = parsedQuery as SimpleSelectQuery;
        const graph = analyzer.analyzeDependencies(query);

        console.log('\n=== FROM Subquery CTE Reference Bug Test ===');
        console.log('All nodes:', graph.nodes.map(n => ({ name: n.name, type: n.type, deps: n.dependencies })));
        console.log('All edges:', graph.edges);
        console.log('Main query dependencies:', analyzer.getMainQueryDependencies());

        // This test should PASS once the bug is fixed
        expect(analyzer.getMainQueryDependencies()).toContain('dat');
    });

    test('should detect CTE references in WHERE subqueries', () => {
        const sql = `
            WITH dat AS (
                SELECT id FROM raw_data WHERE condition = 'active'
            )
            select *
            from table1
            where id in (
                select id
                from dat
                where condition = 'value'
            )
        `;

        const parsedQuery = SelectQueryParser.parse(sql);
        const query = parsedQuery as SimpleSelectQuery;
        const graph = analyzer.analyzeDependencies(query);

        console.log('\n=== WHERE Subquery CTE Reference Bug Test ===');
        console.log('All nodes:', graph.nodes.map(n => ({ name: n.name, type: n.type, deps: n.dependencies })));
        console.log('All edges:', graph.edges);
        console.log('Main query dependencies:', analyzer.getMainQueryDependencies());

        expect(analyzer.getMainQueryDependencies()).toContain('dat');
    });

    test('should detect CTE references in JOIN subqueries', () => {
        const sql = `
            WITH dat AS (
                SELECT id, value FROM base_table WHERE active = true
            )
            select *
            from table1 t1
            join (
                select *
                from dat
                where active = true
            ) d on t1.id = d.id
        `;

        const parsedQuery = SelectQueryParser.parse(sql);
        const query = parsedQuery as SimpleSelectQuery;
        const graph = analyzer.analyzeDependencies(query);

        console.log('\n=== JOIN Subquery CTE Reference Bug Test ===');
        console.log('All nodes:', graph.nodes.map(n => ({ name: n.name, type: n.type, deps: n.dependencies })));
        console.log('All edges:', graph.edges);
        console.log('Main query dependencies:', analyzer.getMainQueryDependencies());

        expect(analyzer.getMainQueryDependencies()).toContain('dat');
    });

    test('should detect CTE references in nested subqueries', () => {
        const sql = `
            WITH dat AS (
                SELECT id, name FROM users WHERE status = 'active'
            )
            select *
            from (
                select *
                from (
                    select *
                    from dat
                ) inner_query
            ) outer_query
        `;

        const parsedQuery = SelectQueryParser.parse(sql);
        const query = parsedQuery as SimpleSelectQuery;
        const graph = analyzer.analyzeDependencies(query);

        console.log('\n=== Nested Subquery CTE Reference Bug Test ===');
        console.log('All nodes:', graph.nodes.map(n => ({ name: n.name, type: n.type, deps: n.dependencies })));
        console.log('All edges:', graph.edges);
        console.log('Main query dependencies:', analyzer.getMainQueryDependencies());

        expect(analyzer.getMainQueryDependencies()).toContain('dat');
    });

    test('should demonstrate working behavior with fixed implementation', () => {
        const sql = `
            WITH dat AS (
                SELECT id, unit_price, quantity FROM products
            )
            select
                q.*
                , trunc(q.price * (1 + q.tax_rate)) - q.price as tax
                , q.price * (1 + q.tax_rate) - q.price as raw_tax
            from
                (
                    select
                        dat.*
                        , (dat.unit_price * dat.quantity) as price
                    from
                        dat
                ) as q
        `;

        const parsedQuery = SelectQueryParser.parse(sql);
        const query = parsedQuery as SimpleSelectQuery;
        analyzer.analyzeDependencies(query);

        console.log('\n=== Fixed Implementation Demonstration ===');
        console.log('Main query dependencies (should be ["dat"]):', analyzer.getMainQueryDependencies());
        
        // This should pass with the fix
        expect(analyzer.getMainQueryDependencies()).toEqual(['dat']);
    });
});
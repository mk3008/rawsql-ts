import { describe, expect, test } from 'vitest';
import { SubQuerySource } from '../../src/models/Clause';
import { SimpleSelectQuery } from '../../src/models/SimpleSelectQuery';
import { SelectQueryParser } from '../../src/parsers/SelectQueryParser';
import { WildcardColumnInferenceCollector } from '../../src/transformers/WildcardColumnInferenceCollector';

const collect = (sql: string) => new WildcardColumnInferenceCollector().collect(SelectQueryParser.parse(sql));

describe('WildcardColumnInferenceCollector', () => {
    test('infers qualified wildcard columns required by downstream CTE references', () => {
        const result = collect(`
            WITH cte AS (
                SELECT a.*
                FROM a
            )
            SELECT cte.id
            FROM cte
        `);

        expect(result).toHaveLength(1);
        expect(result[0].targetKind).toBe('cte');
        expect(result[0].targetName).toBe('cte');
        expect(result[0].wildcards).toEqual([
            { kind: 'qualified', outputIndex: 0, sourceAlias: 'a', sourceName: 'a' }
        ]);
        expect(result[0].requiredColumns).toEqual([
            {
                outputName: 'id',
                sourceAlias: 'a',
                sourceName: 'a',
                sourceColumnName: 'id',
                wildcard: { kind: 'qualified', outputIndex: 0, sourceAlias: 'a', sourceName: 'a' },
                requiredByClause: ['select'],
                requiredBy: [{ clause: 'select', qualifiedName: 'cte.id', namespace: 'cte', column: 'id' }]
            }
        ]);
        expect(result[0].unresolvedColumns).toEqual([]);
    });

    test('uses the CTE consumer alias when one is present', () => {
        const result = collect(`
            WITH cte AS (
                SELECT a.*
                FROM a
            )
            SELECT x.id
            FROM cte AS x
        `);

        expect(result).toHaveLength(1);
        expect(result[0].targetName).toBe('cte');
        expect(result[0].targetAlias).toBe('x');
        expect(result[0].requiredColumns.map(item => item.outputName)).toEqual(['id']);
        expect(result[0].requiredColumns[0].requiredBy).toEqual([
            { clause: 'select', qualifiedName: 'x.id', namespace: 'x', column: 'id' }
        ]);
    });

    test('does not treat a CTE name as a downstream requirement after consumer aliasing', () => {
        const result = collect(`
            WITH cte AS (
                SELECT a.*
                FROM a
            )
            SELECT cte.id
            FROM cte AS x
        `);

        expect(result).toEqual([]);
    });

    test('unions qualified wildcard requirements across UNION ALL branches and preserves explicit outputs', () => {
        const result = collect(`
            WITH cte AS (
                SELECT
                    a.*,
                    b.value
                FROM a
                JOIN b ON b.a_id = a.id
            )
            SELECT cte.id
            FROM cte
            UNION ALL
            SELECT cte.parent_id
            FROM cte
        `);

        expect(result).toHaveLength(1);
        expect(result[0].explicitColumns).toEqual([
            { outputName: 'value', sourceAlias: 'b', sourceName: 'b', sourceColumnName: 'value' }
        ]);
        expect(result[0].requiredColumns.map(item => ({
            outputName: item.outputName,
            sourceAlias: item.sourceAlias,
            sourceName: item.sourceName,
            sourceColumnName: item.sourceColumnName,
            requiredByClause: item.requiredByClause,
            requiredBy: item.requiredBy
        }))).toEqual([
            {
                outputName: 'id',
                sourceAlias: 'a',
                sourceName: 'a',
                sourceColumnName: 'id',
                requiredByClause: ['select'],
                requiredBy: [{ clause: 'select', qualifiedName: 'cte.id', namespace: 'cte', column: 'id' }]
            },
            {
                outputName: 'parent_id',
                sourceAlias: 'a',
                sourceName: 'a',
                sourceColumnName: 'parent_id',
                requiredByClause: ['select'],
                requiredBy: [{ clause: 'select', qualifiedName: 'cte.parent_id', namespace: 'cte', column: 'parent_id' }]
            }
        ]);
        expect(result[0].unresolvedColumns).toEqual([]);
    });

    test('infers unqualified wildcard only when the target has a single source candidate', () => {
        const result = collect(`
            SELECT id
            FROM (
                SELECT *
                FROM table_a
            ) AS a
        `);

        expect(result).toHaveLength(1);
        expect(result[0].targetKind).toBe('derivedTable');
        expect(result[0].targetAlias).toBe('a');
        expect(result[0].wildcards).toEqual([
            { kind: 'unqualified', outputIndex: 0, sourceAlias: 'table_a', sourceName: 'table_a' }
        ]);
        expect(result[0].requiredColumns.map(item => ({
            outputName: item.outputName,
            sourceAlias: item.sourceAlias,
            sourceName: item.sourceName,
            sourceColumnName: item.sourceColumnName,
            requiredByClause: item.requiredByClause
        }))).toEqual([
            {
                outputName: 'id',
                sourceAlias: 'table_a',
                sourceName: 'table_a',
                sourceColumnName: 'id',
                requiredByClause: ['select']
            }
        ]);
        expect(result[0].unresolvedColumns).toEqual([]);
    });

    test('reports unresolved when unqualified wildcard ownership is ambiguous', () => {
        const result = collect(`
            SELECT d.id
            FROM (
                SELECT *
                FROM table_a AS a
                JOIN table_b AS b ON b.a_id = a.id
            ) AS d
        `);

        expect(result).toHaveLength(1);
        expect(result[0].requiredColumns).toEqual([]);
        expect(result[0].unresolvedColumns).toEqual([
            {
                outputName: 'id',
                reason: 'unqualifiedWildcardMultipleSources',
                candidateWildcards: [
                    { kind: 'unqualified', outputIndex: 0, sourceAlias: null, sourceName: null }
                ],
                requiredByClause: ['select'],
                requiredBy: [{ clause: 'select', qualifiedName: 'd.id', namespace: 'd', column: 'id' }]
            }
        ]);
    });

    test('reports unresolved when multiple qualified wildcards could supply the same output', () => {
        const result = collect(`
            WITH cte AS (
                SELECT
                    a.*,
                    b.*
                FROM table_a AS a
                JOIN table_b AS b ON b.a_id = a.id
            )
            SELECT cte.id
            FROM cte
        `);

        expect(result).toHaveLength(1);
        expect(result[0].requiredColumns).toEqual([]);
        expect(result[0].unresolvedColumns.map(item => ({
            outputName: item.outputName,
            reason: item.reason,
            candidateWildcards: item.candidateWildcards,
            requiredByClause: item.requiredByClause
        }))).toEqual([
            {
                outputName: 'id',
                reason: 'multipleWildcardSuppliers',
                candidateWildcards: [
                    { kind: 'qualified', outputIndex: 0, sourceAlias: 'a', sourceName: 'table_a' },
                    { kind: 'qualified', outputIndex: 1, sourceAlias: 'b', sourceName: 'table_b' }
                ],
                requiredByClause: ['select']
            }
        ]);
    });

    test('reports unresolved when explicit output and wildcard both expose a required name', () => {
        const result = collect(`
            WITH cte AS (
                SELECT
                    a.*,
                    b.id
                FROM table_a AS a
                JOIN table_b AS b ON b.a_id = a.id
            )
            SELECT cte.id
            FROM cte
        `);

        expect(result).toHaveLength(1);
        expect(result[0].requiredColumns).toEqual([]);
        expect(result[0].unresolvedColumns).toEqual([
            {
                outputName: 'id',
                reason: 'duplicateOutputOwnership',
                candidateWildcards: [
                    { kind: 'qualified', outputIndex: 0, sourceAlias: 'a', sourceName: 'table_a' }
                ],
                requiredByClause: ['select'],
                requiredBy: [{ clause: 'select', qualifiedName: 'cte.id', namespace: 'cte', column: 'id' }]
            }
        ]);
    });

    test('reports unresolved when no wildcard can supply a missing required output', () => {
        const result = collect(`
            WITH cte AS (
                SELECT b.value
                FROM table_b AS b
            )
            SELECT cte.id
            FROM cte
        `);

        expect(result).toHaveLength(1);
        expect(result[0].requiredColumns).toEqual([]);
        expect(result[0].unresolvedColumns).toEqual([
            {
                outputName: 'id',
                reason: 'noWildcardSupplier',
                candidateWildcards: [],
                requiredByClause: ['select'],
                requiredBy: [{ clause: 'select', qualifiedName: 'cte.id', namespace: 'cte', column: 'id' }]
            }
        ]);
    });

    test('reports unresolved for unsupported target query shapes', () => {
        const result = collect(`
            WITH cte AS (
                SELECT a.*
                FROM table_a AS a
                UNION ALL
                SELECT b.*
                FROM table_b AS b
            )
            SELECT cte.id
            FROM cte
        `);

        expect(result).toHaveLength(1);
        expect(result[0].targetKind).toBe('cte');
        expect(result[0].targetName).toBe('cte');
        expect(result[0].requiredColumns).toEqual([]);
        expect(result[0].unresolvedColumns).toEqual([
            {
                outputName: 'id',
                reason: 'unsupportedQueryShape',
                candidateWildcards: [],
                requiredByClause: ['select'],
                requiredBy: [{ clause: 'select', qualifiedName: 'cte.id', namespace: 'cte', column: 'id' }]
            }
        ]);
    });

    test('uses the innermost CTE when nested WITH clauses shadow outer names', () => {
        const result = collect(`
            WITH cte AS (
                SELECT outer_source.*
                FROM outer_source
            )
            SELECT wrapper.id
            FROM (
                WITH cte AS (
                    SELECT inner_source.*
                    FROM inner_source
                )
                SELECT cte.id
                FROM cte
            ) AS wrapper
        `);

        expect(result).toHaveLength(2);
        expect(result.map(item => ({
            targetKind: item.targetKind,
            targetName: item.targetName,
            targetAlias: item.targetAlias,
            requiredColumns: item.requiredColumns.map(column => ({
                outputName: column.outputName,
                sourceAlias: column.sourceAlias,
                sourceName: column.sourceName
            }))
        }))).toEqual([
            {
                targetKind: 'derivedTable',
                targetName: null,
                targetAlias: 'wrapper',
                requiredColumns: []
            },
            {
                targetKind: 'cte',
                targetName: 'cte',
                targetAlias: 'cte',
                requiredColumns: [
                    { outputName: 'id', sourceAlias: 'inner_source', sourceName: 'inner_source' }
                ]
            }
        ]);
    });

    test('tracks requiredByClause across downstream consumer clauses', () => {
        const result = collect(`
            WITH cte AS (
                SELECT a.*
                FROM accounts AS a
            )
            SELECT cte.id, SUM(cte.score) AS total_score
            FROM cte
            JOIN audit_log AS l ON l.account_id = cte.join_id
            WHERE cte.active = true
            GROUP BY cte.id, cte.region
            HAVING SUM(cte.score) > 0
            ORDER BY cte.created_at
        `);

        expect(result).toHaveLength(1);
        expect(result[0].requiredColumns.map(item => ({
            outputName: item.outputName,
            requiredByClause: item.requiredByClause,
            requiredBy: item.requiredBy
        }))).toEqual([
            {
                outputName: 'id',
                requiredByClause: ['select', 'groupBy'],
                requiredBy: [
                    { clause: 'select', qualifiedName: 'cte.id', namespace: 'cte', column: 'id' },
                    { clause: 'groupBy', qualifiedName: 'cte.id', namespace: 'cte', column: 'id' }
                ]
            },
            {
                outputName: 'score',
                requiredByClause: ['select', 'having'],
                requiredBy: [
                    { clause: 'select', qualifiedName: 'cte.score', namespace: 'cte', column: 'score' },
                    { clause: 'having', qualifiedName: 'cte.score', namespace: 'cte', column: 'score' }
                ]
            },
            {
                outputName: 'active',
                requiredByClause: ['where'],
                requiredBy: [{ clause: 'where', qualifiedName: 'cte.active', namespace: 'cte', column: 'active' }]
            },
            {
                outputName: 'join_id',
                requiredByClause: ['joinOn'],
                requiredBy: [{ clause: 'joinOn', qualifiedName: 'cte.join_id', namespace: 'cte', column: 'join_id' }]
            },
            {
                outputName: 'region',
                requiredByClause: ['groupBy'],
                requiredBy: [{ clause: 'groupBy', qualifiedName: 'cte.region', namespace: 'cte', column: 'region' }]
            },
            {
                outputName: 'created_at',
                requiredByClause: ['orderBy'],
                requiredBy: [{ clause: 'orderBy', qualifiedName: 'cte.created_at', namespace: 'cte', column: 'created_at' }]
            }
        ]);
        expect(result[0].unresolvedColumns).toEqual([]);
    });

    test('resets object id tracking for each collect call on reused collector instances', () => {
        const collector = new WildcardColumnInferenceCollector();
        const warmup = SelectQueryParser.parse(`
            SELECT x.id
            FROM (
                SELECT *
                FROM x_source
            ) AS x
        `) as SimpleSelectQuery;

        collector.collect(warmup);

        const previousDerivedQuery = (warmup.fromClause!.source.datasource as SubQuerySource).query;
        const mixed = SelectQueryParser.parse(`
            SELECT x.id, y.code
            FROM (
                SELECT *
                FROM placeholder
            ) AS x
            JOIN (
                SELECT *
                FROM y_source
            ) AS y ON 1 = 1
        `) as SimpleSelectQuery;

        (mixed.fromClause!.source.datasource as SubQuerySource).query = previousDerivedQuery;

        const result = collector.collect(mixed);

        expect(result.map(item => ({
            targetAlias: item.targetAlias,
            requiredColumns: item.requiredColumns.map(column => column.outputName)
        }))).toEqual([
            { targetAlias: 'x', requiredColumns: ['id'] },
            { targetAlias: 'y', requiredColumns: ['code'] }
        ]);
    });
});

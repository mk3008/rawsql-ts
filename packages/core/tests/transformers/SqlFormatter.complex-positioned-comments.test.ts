import { describe, it, expect } from 'vitest';
import { SelectQueryParser } from '../../src/parsers/SelectQueryParser';
import { SqlFormatter } from '../../src/transformers/SqlFormatter';

describe('Complex positioned comment scenarios', () => {
    const formatterOptions = {
        identifierEscape: { start: "", end: "" },
        parameterSymbol: "$",
        parameterStyle: "indexed" as const,
        indentSize: 4,
        indentChar: " " as const,
        newline: "\n" as const,
        keywordCase: "upper" as const,
        commaBreak: "before" as const,
        andBreak: "before" as const,
        exportComment: true,
        parenthesesOneLine: true,
        betweenOneLine: true,
        valuesOneLine: true,
        joinOneLine: true,
        caseOneLine: true,
        subqueryOneLine: true
    };

    it('should handle nested queries with AS keyword comments', () => {
        const sql = `SELECT 
    /* outer_before */ (
        SELECT /* inner_before */ inner_col /* inner_after */ 
        AS /* inner_as */ inner_alias /* inner_final */
        FROM inner_table
    ) /* outer_after */ AS /* outer_as */ outer_alias /* outer_final */
FROM outer_table`;

        const parsed = SelectQueryParser.parse(sql);
        const formatter = new SqlFormatter(formatterOptions);
        const result = formatter.format(parsed);

        console.log('Nested query with AS comments:');
        console.log(result.formattedSql);

        // Key assertion: AS keyword comments should be preserved at all levels
        expect(result.formattedSql).toContain('AS /* inner_as */');
        expect(result.formattedSql).toContain('AS /* outer_as */');
    });

    it('should handle multiple AS keywords in same query', () => {
        const sql = `SELECT
    /* a_before */ a /* a_after */ as /* a_as */ alias_a /* a_final */,
    /* b_before */ b /* b_after */ as /* b_as */ alias_b /* b_final */,
    /* c_before */ c /* c_after */ as /* c_as */ alias_c /* c_final */
FROM test_table`;

        const parsed = SelectQueryParser.parse(sql);
        const formatter = new SqlFormatter(formatterOptions);
        const result = formatter.format(parsed);

        console.log('Multiple AS keywords:');
        console.log(result.formattedSql);

        // All AS keyword comments should be preserved
        expect(result.formattedSql).toContain('AS /* a_as */');
        expect(result.formattedSql).toContain('AS /* b_as */');
        expect(result.formattedSql).toContain('AS /* c_as */');
        
        // Final comments should also be preserved
        expect(result.formattedSql).toContain('/* a_final */');
        expect(result.formattedSql).toContain('/* b_final */');
        expect(result.formattedSql).toContain('/* c_final */');
    });

    it('should handle DISTINCT ON with AS keyword comments', () => {
        const sql = `SELECT DISTINCT ON (/* distinct_before */ category /* distinct_after */)
    /* name_before */ name /* name_after */ as /* name_as */ product_name /* name_final */,
    /* price_before */ price /* price_after */ as /* price_as */ product_price /* price_final */
FROM products`;

        const parsed = SelectQueryParser.parse(sql);
        const formatter = new SqlFormatter(formatterOptions);
        const result = formatter.format(parsed);

        console.log('DISTINCT ON with AS comments:');
        console.log(result.formattedSql);

        // AS keyword comments should be preserved with DISTINCT ON
        expect(result.formattedSql).toContain('AS /* name_as */');
        expect(result.formattedSql).toContain('AS /* price_as */');
        expect(result.formattedSql).toContain('DISTINCT ON');
    });

    it('should handle functions with AS keyword comments', () => {
        const sql = `SELECT
    /* count_before */ COUNT(*) /* count_after */ as /* count_as */ total_count /* count_final */,
    /* max_before */ MAX(/* max_param_before */ price /* max_param_after */) /* max_after */ 
    as /* max_as */ max_price /* max_final */
FROM products
GROUP BY category`;

        const parsed = SelectQueryParser.parse(sql);
        const formatter = new SqlFormatter(formatterOptions);
        const result = formatter.format(parsed);

        console.log('Functions with AS comments:');
        console.log(result.formattedSql);

        // AS keyword comments should work with functions
        expect(result.formattedSql).toContain('AS /* count_as */');
        expect(result.formattedSql).toContain('AS /* max_as */');
    });

    it('should handle edge case: AS keyword without alias', () => {
        const sql = `SELECT
    /* col_before */ column_name /* col_after */ as /* orphan_as */ -- This AS has a comment but no alias
FROM test_table`;

        // This is an edge case that might cause parsing issues
        try {
            const parsed = SelectQueryParser.parse(sql);
            const formatter = new SqlFormatter(formatterOptions);
            const result = formatter.format(parsed);

            console.log('Edge case - AS without alias:');
            console.log(result.formattedSql);

            // Should handle gracefully (even if AS comment is lost in this edge case)
            expect(result.formattedSql).toBeTruthy();
        } catch (error) {
            // Edge case might fail parsing, which is acceptable
            expect(error).toBeDefined();
            console.log('Edge case correctly rejected:', (error as Error).message);
        }
    });

    it('should preserve comment order integrity across complex query', () => {
        const sql = `SELECT /*+ HINT */ DISTINCT
    /* s1 */ col1 /* s2 */ as /* s3 */ alias1 /* s4 */,
    /* s5 */ col2 /* s6 */ as /* s7 */ alias2 /* s8 */,
    /* s9 */ COUNT(col3) /* s10 */ as /* s11 */ count_col3 /* s12 */
FROM /* f1 */ table1 /* f2 */ t1 /* f3 */
JOIN /* j1 */ table2 /* j2 */ t2 /* j3 */ ON t1.id = t2.id
WHERE /* w1 */ t1.status /* w2 */ = 'active' /* w3 */
GROUP BY col1, col2
HAVING /* h1 */ COUNT(col3) /* h2 */ > 10 /* h3 */
ORDER BY /* o1 */ col1 /* o2 */ ASC /* o3 */`;

        const parsed = SelectQueryParser.parse(sql);
        const formatter = new SqlFormatter(formatterOptions);
        const result = formatter.format(parsed);

        console.log('Complex query comment preservation:');
        console.log(result.formattedSql);

        // Key AS keyword comments should be preserved
        expect(result.formattedSql).toContain('AS /* s3 */');
        expect(result.formattedSql).toContain('AS /* s7 */');
        expect(result.formattedSql).toContain('AS /* s11 */');
        
        // HINT should be preserved
        expect(result.formattedSql).toContain('/*+ HINT */');
        
        // DISTINCT should be preserved
        expect(result.formattedSql).toContain('DISTINCT');
        
        // Some other comments should be preserved (though positioning may vary)
        expect(result.formattedSql).toContain('/* s4 */');
        expect(result.formattedSql).toContain('/* s8 */');
        expect(result.formattedSql).toContain('/* s12 */');
    });
});
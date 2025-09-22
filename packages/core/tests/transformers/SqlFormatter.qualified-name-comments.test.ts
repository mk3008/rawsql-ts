import { describe, it, expect } from 'vitest';
import { SelectQueryParser } from '../../src/parsers/SelectQueryParser';
import { SqlFormatter } from '../../src/transformers/SqlFormatter';

describe('SqlFormatter qualified name comment handling', () => {
    const formatterOptions = {
        identifierEscape: {
            start: "",
            end: ""
        },
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

    it('should format qualified name with comment without splitting', () => {
        const sql = `SELECT u.name /* user name */ FROM users u`;

        const parsed = SelectQueryParser.parse(sql);
        const formatter = new SqlFormatter(formatterOptions);
        const result = formatter.format(parsed);

        // Should NOT contain split like "u. /* user name */ name"
        expect(result.formattedSql).not.toMatch(/\w+\.\s*\/\*.*?\*\/\s*\w+/);

        // Should contain proper qualified name with comment
        expect(result.formattedSql).toMatch(/u\.name\s*\/\*\s*user name\s*\*\//);

        // Should preserve the comment
        const commentMatches = result.formattedSql.match(/\/\*[^*]*\*\//g);
        expect(commentMatches).toHaveLength(1);
        expect(commentMatches![0]).toMatch(/user name/);

        // Should not duplicate comments
        expect(result.formattedSql).not.toMatch(/user name.*user name/);
    });

    it('should handle multiple qualified names with comments correctly', () => {
        const sql = `SELECT u.id /* user ID */, u.name /* user name */, u.email /* email address */ FROM users u`;

        const parsed = SelectQueryParser.parse(sql);
        const formatter = new SqlFormatter(formatterOptions);
        const result = formatter.format(parsed);

        // Should preserve all comments without duplication
        const commentMatches = result.formattedSql.match(/\/\*[^*]*\*\//g);
        expect(commentMatches).toHaveLength(3);

        // Should not have any split qualified names
        expect(result.formattedSql).not.toMatch(/\w+\.\s*\/\*.*?\*\/\s*\w+/);

        // Should contain proper qualified names
        expect(result.formattedSql).toMatch(/u\.id\s*\/\*\s*user ID\s*\*\//);
        expect(result.formattedSql).toMatch(/u\.name\s*\/\*\s*user name\s*\*\//);
        expect(result.formattedSql).toMatch(/u\.email\s*\/\*\s*email address\s*\*\//);
    });

    it('should handle qualified names in WHERE clause correctly', () => {
        const sql = `SELECT * FROM users u WHERE u.status /* user status */ = 'active'`;

        const parsed = SelectQueryParser.parse(sql);
        const formatter = new SqlFormatter(formatterOptions);
        const result = formatter.format(parsed);

        // Should not split qualified name in WHERE clause
        expect(result.formattedSql).not.toMatch(/\w+\.\s*\/\*.*?\*\/\s*\w+/);

        // Should contain proper qualified name with comment
        expect(result.formattedSql).toMatch(/u\.status\s*\/\*\s*user status\s*\*\//);

        // Comment should appear only once
        const commentMatches = result.formattedSql.match(/\/\*\s*user status\s*\*\//g);
        expect(commentMatches).toHaveLength(1);
    });

    it('should handle qualified names in ORDER BY clause correctly', () => {
        const sql = `SELECT * FROM users u ORDER BY u.name /* sort by name */, u.id /* sort by ID */`;

        const parsed = SelectQueryParser.parse(sql);
        const formatter = new SqlFormatter(formatterOptions);
        const result = formatter.format(parsed);

        // Should not split qualified names in ORDER BY
        expect(result.formattedSql).not.toMatch(/\w+\.\s*\/\*.*?\*\/\s*\w+/);

        // Should preserve both comments without duplication
        const commentMatches = result.formattedSql.match(/\/\*[^*]*\*\//g);
        expect(commentMatches).toHaveLength(2);

        // Should contain proper qualified names
        expect(result.formattedSql).toMatch(/u\.name\s*\/\*\s*sort by name\s*\*\//);
        expect(result.formattedSql).toMatch(/u\.id\s*\/\*\s*sort by ID\s*\*\//);
    });

    it('should handle complex qualified names without regression', () => {
        const sql = `
            SELECT
                t1.id /* table1 ID */,
                t2.name /* table2 name */
            FROM table1 t1
            JOIN table2 t2 ON t1.ref_id /* reference ID */ = t2.id /* related ID */
            WHERE t1.status /* status */ = 'active'
        `;

        const parsed = SelectQueryParser.parse(sql);
        const formatter = new SqlFormatter(formatterOptions);
        const result = formatter.format(parsed);

        // Should not contain any split qualified names
        expect(result.formattedSql).not.toMatch(/\w+\.\s*\/\*.*?\*\/\s*\w+/);

        // Should preserve all comments (5 total)
        const commentMatches = result.formattedSql.match(/\/\*[^*]*\*\//g);
        expect(commentMatches).toHaveLength(5);

        // Should not duplicate any comments
        const commentTexts = commentMatches!.map(c => c.replace(/\/\*\s*|\s*\*\//g, ''));
        const uniqueComments = new Set(commentTexts);
        expect(uniqueComments.size).toBe(commentTexts.length); // No duplicates
    });

    it('should handle positioned comments with before/after correctly', () => {
        // This test verifies that the position interpretation is correct
        const sql = `SELECT u.name /* user name */ FROM users u`;

        const parsed = SelectQueryParser.parse(sql);

        // Verify that the comment is parsed as 'after' position
        const selectItem = parsed.selectClause.items[0];
        const columnRef = selectItem.value;
        const qualifiedName = (columnRef as any).qualifiedName;
        const nameIdentifier = qualifiedName.name;

        expect(nameIdentifier.positionedComments).toBeTruthy();
        expect(nameIdentifier.positionedComments![0].position).toBe('after');
        expect(nameIdentifier.positionedComments![0].comments).toContain('user name');

        const formatter = new SqlFormatter(formatterOptions);
        const result = formatter.format(parsed);

        // The comment should appear AFTER the qualified name, not before
        expect(result.formattedSql).toMatch(/u\.name\s*\/\*\s*user name\s*\*\//);
        expect(result.formattedSql).not.toMatch(/\/\*\s*user name\s*\*\/\s*u\.name/);
    });
});
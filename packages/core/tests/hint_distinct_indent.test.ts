import { describe, it, expect } from 'vitest';
import { SelectQueryParser } from '../src/parsers/SelectQueryParser';
import { SqlFormatter } from '../src/transformers/SqlFormatter';

describe('HINT + DISTINCT with indentation test', () => {
    it('should show formatted output with indentation', () => {
        // 基本的なHINT + DISTINCT
        const sqlInput1 = 'SELECT /*+ INDEX(users idx_name) */ DISTINCT id, name FROM users';
        const query1 = SelectQueryParser.parse(sqlInput1);

        const formatter = new SqlFormatter({
            indentSize: 2,
            indentChar: ' ',
            newline: '\r\n',
            keywordCase: 'upper',
            commaBreak: 'before',
            andBreak: 'before'
        });

        const result1 = formatter.format(query1);
        console.log('=== 基本的なHINT + DISTINCT ===');
        console.log('入力:', sqlInput1);
        console.log('出力:');
        console.log(result1.formattedSql);

        // 複数のHINT + DISTINCT ON
        const sqlInput2 = 'SELECT /*+ INDEX(users idx_name) */ /*+ USE_HASH(users) */ DISTINCT ON (status) id, name, status FROM users WHERE active = 1';
        const query2 = SelectQueryParser.parse(sqlInput2);
        const result2 = formatter.format(query2);
        
        console.log('\n=== 複数HINT + DISTINCT ON ===');
        console.log('入力:', sqlInput2);
        console.log('出力:');
        console.log(result2.formattedSql);

        // HINT + DISTINCTの期待される表示形式
        const expected1 = [
            'SELECT /*+ INDEX(USERS IDX_NAME) */ DISTINCT',
            '  "id"',
            '  , "name"',
            'FROM',
            '  "users"'
        ].join('\r\n');

        const expected2 = [
            'SELECT /*+ INDEX(USERS IDX_NAME) */ /*+ USE_HASH(USERS) */ DISTINCT ON("STATUS")',
            '  "id"',
            '  , "name"',
            '  , "status"',
            'FROM',
            '  "users"',
            'WHERE',
            '  "active" = 1'
        ].join('\r\n');

        expect(result1.formattedSql).toBe(expected1);
        expect(result2.formattedSql).toBe(expected2);
    });

    it('should format complex query with HINT + DISTINCT and multiple clauses', () => {
        const sqlInput = `
            SELECT /*+ INDEX(u idx_name) */ /*+ USE_HASH(o) */ DISTINCT 
                u.id, u.name, COUNT(o.id) as order_count
            FROM users u
            LEFT JOIN orders o ON u.id = o.user_id
            WHERE u.active = 1 
                AND u.created_at > '2023-01-01'
            GROUP BY u.id, u.name
            HAVING COUNT(o.id) > 0
            ORDER BY u.name
        `;
        
        const query = SelectQueryParser.parse(sqlInput);
        const formatter = new SqlFormatter({
            indentSize: 2,
            indentChar: ' ',
            newline: '\r\n',
            keywordCase: 'upper',
            commaBreak: 'before',
            andBreak: 'before'
        });

        const result = formatter.format(query);
        console.log('\n=== 複雑なクエリでのHINT + DISTINCT ===');
        console.log('入力:', sqlInput.trim());
        console.log('出力:');
        console.log(result.formattedSql);

        // HISTとDISTINCTが同じ行にあることを確認
        expect(result.formattedSql).toContain('SELECT /*+ INDEX(U IDX_NAME) */ /*+ USE_HASH(O) */ DISTINCT');
        // 最初のSELECT項目が次の行にインデントされていることを確認
        expect(result.formattedSql).toContain('\r\n  "u"."id"');
    });
});
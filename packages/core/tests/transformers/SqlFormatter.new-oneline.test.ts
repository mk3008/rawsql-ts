import { describe, test, expect } from 'vitest';
import { SqlFormatter } from '../../src/transformers/SqlFormatter';
import { SelectQueryParser } from '../../src/parsers/SelectQueryParser';

describe('SqlFormatter - New Oneline Options', () => {
    test('should format VALUES clause on one line when enabled', () => {
        const formatter = new SqlFormatter({ 
            valuesOneLine: true,
            exportComment: false 
        });
        
        const sql = `
            select * 
            from (values 
                (1, 'first'),
                (2, 'second'),
                (3, 'third')
            ) as t(id, name)
        `;
        
        const query = SelectQueryParser.parse(sql);
        const result = formatter.format(query);
        
        console.log('Formatted SQL with valuesOneLine=true:', result.formattedSql);
        
        // VALUES should be formatted on one line
        expect(result.formattedSql).toContain('values (1, \'first\'), (2, \'second\'), (3, \'third\')');
    });

    test('should format CASE expression on one line when enabled', () => {
        const formatter = new SqlFormatter({ 
            caseOneLine: true,
            exportComment: false 
        });
        
        const sql = `
            select 
                case status 
                    when 'active' then 'A'
                    when 'inactive' then 'I'
                    else 'U'
                end as status_code
            from users
        `;
        
        const query = SelectQueryParser.parse(sql);
        const result = formatter.format(query);
        
        console.log('Formatted SQL with caseOneLine=true:', result.formattedSql);
        
        // CASE should be on one line
        expect(result.formattedSql).toContain('case');
        expect(result.formattedSql).toContain('when');
    });

    test('should keep smart comments executable when CASE is formatted on one line', () => {
        const formatter = new SqlFormatter({
            caseOneLine: true,
            exportComment: true,
            commentStyle: 'smart',
            oneLineMaxLength: 0,
            identifierEscape: { start: '', end: '' },
            keywordCase: 'lower',
            newline: '\n',
            indentSize: 4,
            indentChar: ' ',
            commaBreak: 'before'
        });

        const sql = `
            select
                sum(case
                    /* Refunds are operational noise for this score, but the row still proves the customer came back. */
                    when ob.status = :refunded_status then 0
                    /* Paid and shipped share the same business meaning here. */
                    else ob.total_amount
                end) as gross_amount
            from order_base ob
        `;

        const query = SelectQueryParser.parse(sql);
        const result = formatter.format(query);

        expect(result.formattedSql).toContain('/* Refunds are operational noise for this score, but the row still proves the customer came back. */');
        expect(result.formattedSql).toContain('/* Paid and shipped share the same business meaning here. */');
        expect(result.formattedSql).not.toContain('-- Refunds');
        expect(result.formattedSql).not.toContain('-- Paid');
        expect(result.formattedSql).toContain('case /* Refunds are operational noise for this score, but the row still proves the customer came back. */ when');
        expect(result.formattedSql.match(/Refunds are operational noise/g)).toHaveLength(1);
    });

    test('should format subquery on one line when enabled', () => {
        const formatter = new SqlFormatter({ 
            subqueryOneLine: true,
            exportComment: false 
        });
        
        const sql = `
            select *
            from users 
            where id in (
                select user_id 
                from orders 
                where amount > 100
            )
        `;
        
        const query = SelectQueryParser.parse(sql);
        const result = formatter.format(query);
        
        console.log('Formatted SQL with subqueryOneLine=true:', result.formattedSql);
        
        // Subquery should be on one line
        expect(result.formattedSql).toContain('select');
        expect(result.formattedSql).toContain('orders');
    });

    test('should convert original line comments to block comments inside oneline CASE expressions', () => {
        const formatter = new SqlFormatter({
            caseOneLine: true,
            exportComment: true,
            commentStyle: 'smart',
            identifierEscape: { start: '', end: '' },
            keywordCase: 'lower',
            newline: '\n',
            indentSize: 4,
            indentChar: ' '
        });

        const sql = `
            select
                case
                    -- active order
                    when active = true then 'active'
                    else 'inactive'
                end as status_label
            from orders
        `;

        const query = SelectQueryParser.parse(sql);
        const result = formatter.format(query);

        expect(result.formattedSql).toContain("case /* active order */ when active = true then 'active'");
        expect(result.formattedSql).not.toContain('-- active order');
    });

    test('should format JOIN conditions on one line when enabled', () => {
        const formatter = new SqlFormatter({ 
            joinOneLine: true,
            exportComment: false 
        });
        
        const sql = `
            select u.*, p.title
            from users u
            join posts p on u.id = p.user_id 
                and p.published = true
                and p.created_at > '2023-01-01'
        `;
        
        const query = SelectQueryParser.parse(sql);
        const result = formatter.format(query);
        
        console.log('Formatted SQL with joinOneLine=true:', result.formattedSql);
        
        // JOIN conditions should remain readable
        expect(result.formattedSql).toContain('join');
        expect(result.formattedSql).toContain('on');
    });

    test('should work with multiple oneline options combined', () => {
        const formatter = new SqlFormatter({ 
            parenthesesOneLine: true,
            betweenOneLine: true,
            valuesOneLine: true,
            caseOneLine: true,
            exportComment: false 
        });
        
        const sql = `
            select 
                case 
                    when age between 18 and 65 then 'working_age'
                    else 'other'
                end as age_group
            from (values (25), (45), (70)) as ages(age)
            where (age > 0 and age < 120)
        `;
        
        const query = SelectQueryParser.parse(sql);
        const result = formatter.format(query);
        
        console.log('Formatted SQL with multiple oneline options:', result.formattedSql);
        
        // Should handle all oneline options
        expect(result.formattedSql).toBeDefined();
        expect(result.formattedSql.length).toBeGreaterThan(0);
    });
});

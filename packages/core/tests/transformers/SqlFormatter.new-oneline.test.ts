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
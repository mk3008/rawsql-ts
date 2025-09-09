import { describe, test, expect } from 'vitest';
import { SqlFormatter } from '../../src/transformers/SqlFormatter';
import { SelectQueryParser } from '../../src/parsers/SelectQueryParser';

describe('SqlFormatter - betweenOneLine option', () => {
    test('should format BETWEEN expression on one line when enabled', () => {
        const formatter = new SqlFormatter({ 
            betweenOneLine: true,
            andBreak: 'after', // Force AND breaks to test BETWEEN override
            exportComment: false 
        });
        
        const sql = `
            select * 
            from users 
            where age between (select min(age) from employees)
                and (select max(age) from employees)
                and status = 'active'
        `;
        
        const query = SelectQueryParser.parse(sql);
        const result = formatter.format(query);
        
        console.log('Formatted SQL with betweenOneLine=true:', result.formattedSql);
        
        // BETWEEN expression should be on one line even with AND breaks
        expect(result.formattedSql).toContain('between (select min("age") from "employees") and (select max("age") from "employees")');
        // Outside AND should be part of the query
        expect(result.formattedSql).toContain('"status" = \'active\'');
    });

    test('should allow line breaks in BETWEEN when betweenOneLine is disabled', () => {
        const formatter = new SqlFormatter({ 
            betweenOneLine: false,
            andBreak: 'after', // Force AND breaks
            exportComment: false 
        });
        
        const sql = `
            select * 
            from users 
            where age between (select min(age) from employees)
                and (select max(age) from employees)
        `;
        
        const query = SelectQueryParser.parse(sql);
        const result = formatter.format(query);
        
        console.log('Formatted SQL with betweenOneLine=false:', result.formattedSql);
        
        // Should potentially allow line breaks in BETWEEN expression
        expect(result.formattedSql).toContain('between');
        expect(result.formattedSql).toContain('employees');
    });

    test('should handle simple BETWEEN expressions', () => {
        const formatter = new SqlFormatter({ 
            betweenOneLine: true,
            andBreak: 'after',
            exportComment: false 
        });
        
        const sql = `
            select * 
            from products 
            where price between 100 and 500
                and category = 'electronics'
        `;
        
        const query = SelectQueryParser.parse(sql);
        const result = formatter.format(query);
        
        // Simple BETWEEN should remain on one line
        expect(result.formattedSql).toContain('"price" between 100 and 500');
        // Outside AND should be included
        expect(result.formattedSql).toContain('"category" = \'electronics\'');
    });

    test('should handle nested BETWEEN in complex expressions', () => {
        const formatter = new SqlFormatter({ 
            betweenOneLine: true,
            andBreak: 'after',
            exportComment: false 
        });
        
        const sql = `
            select * 
            from orders 
            where (amount between 100 and 1000 
                and created_at between '2023-01-01' and '2023-12-31')
                and status = 'completed'
        `;
        
        const query = SelectQueryParser.parse(sql);
        const result = formatter.format(query);
        
        console.log('Complex BETWEEN result:', result.formattedSql);
        
        // Both BETWEEN expressions should be handled appropriately
        expect(result.formattedSql).toContain('between 100 and 1000');
        expect(result.formattedSql).toContain('between \'2023-01-01\' and \'2023-12-31\'');
    });
});
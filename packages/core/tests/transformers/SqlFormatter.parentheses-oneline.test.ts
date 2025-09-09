import { describe, test, expect } from 'vitest';
import { SqlFormatter } from '../../src/transformers/SqlFormatter';
import { SelectQueryParser } from '../../src/parsers/SelectQueryParser';

describe('SqlFormatter - parenthesesOneLine option', () => {
    test('should format parentheses conditions on one line when enabled', () => {
        const formatter = new SqlFormatter({ 
            parenthesesOneLine: true,
            exportComment: false,
            andBreak: 'after' // Force AND breaks to test parentheses override
        });
        
        const sql = `
            select * 
            from users 
            where (user_id = 1 and status = 'active' and created_at > '2023-01-01' and email is not null and age > 18 and active = true)
        `;
        
        const query = SelectQueryParser.parse(sql);
        const result = formatter.format(query);
        
        console.log('Formatted SQL with parenthesesOneLine=true:', result.formattedSql);
        
        // Should keep parentheses content on one line even with AND breaks enabled
        expect(result.formattedSql).toContain('("user_id" = 1 and "status" = \'active\'');
        expect(result.formattedSql).not.toContain('\n    and "status"'); // No line break in parentheses
    });

    test('should allow line breaks in parentheses when parenthesesOneLine is disabled', () => {
        const formatter = new SqlFormatter({ 
            parenthesesOneLine: false,
            exportComment: false,
            andBreak: 'after' // Force AND breaks
        });
        
        const sql = `
            select * 
            from users 
            where (user_id = 1 and status = 'active' and created_at > '2023-01-01' and email is not null and age > 18 and active = true and region = 'US' and customer_type = 'premium')
        `;
        
        const query = SelectQueryParser.parse(sql);
        const result = formatter.format(query);
        
        console.log('Formatted SQL with parenthesesOneLine=false:', result.formattedSql);
        
        // Should potentially allow line breaks in parentheses if needed
        // For now, just verify it doesn't error and produces valid SQL
        expect(result.formattedSql).toContain('where (');
        expect(result.formattedSql).toContain('"user_id"');
    });

    test('should handle nested parentheses correctly', () => {
        const formatter = new SqlFormatter({ 
            parenthesesOneLine: true,
            exportComment: false 
        });
        
        const sql = `
            select * 
            from users 
            where region = 'US' 
                and (product_type = 'premium' 
                    and (discount > 0.1 or stock > 0)
                    and active = true)
        `;
        
        const query = SelectQueryParser.parse(sql);
        const result = formatter.format(query);
        
        // Both outer and inner parentheses should be one-lined
        expect(result.formattedSql).toContain('("product_type" = \'premium\' and ("discount" > 0.1 or "stock" > 0) and "active" = true)');
    });

    test('should work with complex WHERE conditions', () => {
        const formatter = new SqlFormatter({ 
            parenthesesOneLine: true,
            exportComment: false 
        });
        
        const sql = `
            select * 
            from orders 
            where status = 'completed'
                and (payment_method = 'credit_card'
                    and amount > 100
                    and created_at between '2023-01-01' and '2023-12-31')
                and customer_tier = 'premium'
        `;
        
        const query = SelectQueryParser.parse(sql);
        const result = formatter.format(query);
        
        // The parentheses section should be on one line
        expect(result.formattedSql).toContain('("payment_method" = \'credit_card\' and "amount" > 100 and "created_at" between \'2023-01-01\' and \'2023-12-31\')');
        
        // Outside conditions should remain multi-line
        expect(result.formattedSql).toContain('"status" = \'completed\'');
        expect(result.formattedSql).toContain('"customer_tier" = \'premium\'');
    });
});
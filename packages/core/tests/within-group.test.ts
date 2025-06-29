import { describe, expect, test } from 'vitest';
import { SqlFormatter } from '../src/transformers/SqlFormatter';

describe('WITHIN GROUP clause', () => {
    test('should fail to parse PERCENTILE_CONT with WITHIN GROUP (RED phase)', () => {
        // Arrange
        const sql = 'SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY amount) FROM sales';
        
        // Act & Assert - This should fail in the RED phase
        expect(() => {
            const formatter = new SqlFormatter();
            formatter.format(sql);
        }).toThrow();
    });
    
    test('should debug parse error', () => {
        // Arrange - Try simpler SQL first
        const sql = 'SELECT COUNT(*) FROM sales';
        
        // Act
        try {
            const formatter = new SqlFormatter();
            const result = formatter.format(sql);
            console.log('✅ Simple SQL parsed successfully:', result);
            
            // Now try the complex one
            const complexSql = 'SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY amount) FROM sales';
            const complexResult = formatter.format(complexSql);
            console.log('✅ Complex SQL parsed successfully:', complexResult);
        } catch (error) {
            console.log('❌ Parse error:', error);
            console.log('Error message:', error.message);
            console.log('Stack trace:', error.stack);
        }
    });
    
    test('should parse PERCENTILE_CONT with WITHIN GROUP after fix (GREEN phase)', () => {
        // Arrange
        const sql = 'SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY amount) FROM sales';
        
        // Act
        const formatter = new SqlFormatter();
        const result = formatter.format(sql);
        
        // Assert
        expect(result).toContain('PERCENTILE_CONT');
        expect(result).toContain('WITHIN GROUP');
        expect(result).toContain('ORDER BY amount');
    });
    
    test('should parse multiple order set aggregate functions', () => {
        // Arrange
        const sql = `
            SELECT 
                PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY amount),
                PERCENTILE_DISC(0.25) WITHIN GROUP (ORDER BY price DESC),
                MODE() WITHIN GROUP (ORDER BY category)
            FROM sales
        `;
        
        // Act
        const formatter = new SqlFormatter();
        const result = formatter.format(sql);
        
        // Assert
        expect(result).toContain('PERCENTILE_CONT(0.5) WITHIN GROUP');
        expect(result).toContain('PERCENTILE_DISC(0.25) WITHIN GROUP');
        expect(result).toContain('MODE() WITHIN GROUP');
    });

    test('should parse order set aggregate with OVER clause', () => {
        // Arrange
        const sql = 'SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY amount) OVER (PARTITION BY region) FROM sales';
        
        // Act
        const formatter = new SqlFormatter();
        const result = formatter.format(sql);
        
        // Assert
        expect(result).toContain('PERCENTILE_CONT');
        expect(result).toContain('WITHIN GROUP');
        expect(result).toContain('OVER (PARTITION BY region)');
    });

    test('should handle WITHIN GROUP with complex ORDER BY', () => {
        // Arrange
        const sql = 'SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY amount ASC NULLS LAST, price DESC) FROM sales';
        
        // Act
        const formatter = new SqlFormatter();
        const result = formatter.format(sql);
        
        // Assert
        expect(result).toContain('ORDER BY amount ASC NULLS LAST, price DESC');
    });
});
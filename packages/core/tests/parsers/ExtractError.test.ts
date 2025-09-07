import { describe, expect, test } from 'vitest';
import { SelectQueryParser } from '../../src/parsers/SelectQueryParser';

describe('EXTRACT function error reproduction', () => {
    test('Valid EXTRACT with DAY should work', () => {
        const validQuery = `SELECT EXTRACT(DAY FROM end_date) as day_number FROM events`;
        
        expect(() => {
            SelectQueryParser.parse(validQuery);
        }).not.toThrow();
    });

    test('Valid EXTRACT with MONTH should work', () => {
        const validQuery = `SELECT EXTRACT(MONTH FROM created_at) as month_number FROM events`;
        
        expect(() => {
            SelectQueryParser.parse(validQuery);
        }).not.toThrow();
    });

    test('EXTRACT with invalid time unit DAYS should provide clear error message', () => {
        const invalidQuery = `SELECT EXTRACT(DAYS FROM end_date) as duration FROM events`;
        
        try {
            SelectQueryParser.parse(invalidQuery);
            expect.fail('Should have thrown an error');
        } catch (error: any) {
            console.log('Error message for invalid time unit DAYS:');
            console.log(error.message);
            // The error should indicate what was found and provide context
            expect(error.message).toBeDefined();
            expect(error.message.length).toBeGreaterThan(20); // More detailed than before
        }
    });

    test('EXTRACT with comma instead of FROM should provide clear error message', () => {
        const invalidQuery = `SELECT EXTRACT(MONTH, created_at) as month_number FROM events`;
        
        try {
            SelectQueryParser.parse(invalidQuery);
            expect.fail('Should have thrown an error');
        } catch (error: any) {
            console.log('Error message for comma instead of FROM:');
            console.log(error.message);
            expect(error.message).toBeDefined();
            expect(error.message.length).toBeGreaterThan(20);
        }
    });

    test('Complex query with EXTRACT error should provide context', () => {
        const complexInvalidQuery = `
        WITH user_stats AS (
            SELECT 
                user_id,
                EXTRACT(DAYS FROM last_order_date - first_order_date) as customer_lifetime_days
            FROM orders
        )
        SELECT * FROM user_stats`;
        
        try {
            SelectQueryParser.parse(complexInvalidQuery);
            expect.fail('Should have thrown an error');
        } catch (error: any) {
            console.log('Error message for complex query with invalid DAYS:');
            console.log(error.message);
            expect(error.message).toBeDefined();
            expect(error.message.length).toBeGreaterThan(20);
        }
    });

    test('Original user query should provide clear error message', () => {
        const originalUserQuery = `WITH user_stats AS (
    SELECT 
        user_id,
        COUNT(*) as total_orders,
        SUM(amount) as total_amount,
        AVG(amount) as avg_order_amount,
        MIN(created_at) as first_order_date,
        MAX(created_at) as last_order_date
    FROM orders 
    WHERE created_at >= '2024-01-01' 
      AND created_at < '2024-02-01'
      AND status IN ('completed', 'shipped')
    GROUP BY user_id
    HAVING COUNT(*) >= 2
)
,
customer_segments AS (
    SELECT 
        us.user_id,
        us.total_amount,
        us.total_orders,
        us.avg_order_amount,
        EXTRACT(DAYS FROM (us.last_order_date - us.first_order_date)) as customer_lifetime_days
    FROM user_stats us
)
SELECT 
    customer_lifetime_days
FROM customer_segments`;
        
        try {
            SelectQueryParser.parse(originalUserQuery);
            expect.fail('Should have thrown an error');
        } catch (error: any) {
            console.log('Error message for original user query:');
            console.log(error.message);
            expect(error.message).toContain('Expected closing parenthesis');
            expect(error.message).toContain('Context:');
            expect(error.message).toContain('DAYS [Identifier]');
        }
    });
});
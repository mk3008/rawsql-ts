import { describe, test, expect } from 'vitest';
import { SelectQueryParser } from '../../src/parsers/SelectQueryParser';
import { SqlFormatter } from '../../src/transformers/SqlFormatter';

describe('SqlFormatter - Aggregate Function Comments', () => {
    describe('Basic Aggregate Function Comment Preservation', () => {
        test('should preserve comments on string_agg with ORDER BY', () => {
            const inputSql = `
                select 
                    string_agg(name ORDER BY id) --agg comment
                from users
            `;
            
            const query = SelectQueryParser.parse(inputSql);
            const formatter = new SqlFormatter({ exportComment: true });
            const result = formatter.format(query);
            
            expect(result.formattedSql).toContain('agg comment');
            // Ensure no duplicate comments
            const commentMatches = result.formattedSql.match(/agg comment/g);
            expect(commentMatches).toHaveLength(1);
        });

        test('should preserve comments on array_agg with ORDER BY', () => {
            const inputSql = `
                select 
                    array_agg(price ORDER BY created_at DESC) --price array
                from products
            `;
            
            const query = SelectQueryParser.parse(inputSql);
            const formatter = new SqlFormatter({ exportComment: true });
            const result = formatter.format(query);
            
            expect(result.formattedSql).toContain('price array');
            // Ensure no duplicate comments  
            const commentMatches = result.formattedSql.match(/price array/g);
            expect(commentMatches).toHaveLength(1);
        });

        test('should preserve comments on json_agg with ORDER BY', () => {
            const inputSql = `
                select 
                    json_agg(data ORDER BY timestamp) --json data
                from logs
            `;
            
            const query = SelectQueryParser.parse(inputSql);
            const formatter = new SqlFormatter({ exportComment: true });
            const result = formatter.format(query);
            
            expect(result.formattedSql).toContain('json data');
            // Ensure no duplicate comments
            const commentMatches = result.formattedSql.match(/json data/g);
            expect(commentMatches).toHaveLength(1);
        });
    });

    describe('Complex Aggregate Function Scenarios', () => {
        test('should preserve comments on aggregate functions with multiple arguments', () => {
            const inputSql = `
                select 
                    string_agg(DISTINCT name, ', ' ORDER BY name) --distinct names
                from users
            `;
            
            const query = SelectQueryParser.parse(inputSql);
            const formatter = new SqlFormatter({ exportComment: true });
            const result = formatter.format(query);
            
            expect(result.formattedSql).toContain('distinct names');
        });

        test('should preserve comments on mixed function calls', () => {
            const inputSql = `
                select 
                    count(*) --regular function
                    , string_agg(name ORDER BY id) --aggregate function  
                    , max(created_at) --another regular function
                from users
            `;
            
            const query = SelectQueryParser.parse(inputSql);
            const formatter = new SqlFormatter({ exportComment: true });
            const result = formatter.format(query);
            
            expect(result.formattedSql).toContain('regular function');
            expect(result.formattedSql).toContain('aggregate function');
            expect(result.formattedSql).toContain('another regular function');
        });
    });

    describe('Edge Cases', () => {
        test('should handle aggregate functions without comments', () => {
            const inputSql = `
                select 
                    string_agg(name ORDER BY id),
                    array_agg(price)
                from products
            `;
            
            const query = SelectQueryParser.parse(inputSql);
            const formatter = new SqlFormatter({ exportComment: true });
            const result = formatter.format(query);
            
            expect(result.formattedSql).toContain('string_agg');
            expect(result.formattedSql).toContain('array_agg');
            expect(result.formattedSql).not.toContain('/*');
        });

        test('should work when exportComment is false', () => {
            const inputSql = `
                select 
                    string_agg(name ORDER BY id) --should not appear
                from users
            `;
            
            const query = SelectQueryParser.parse(inputSql);
            const formatter = new SqlFormatter({ exportComment: false });
            const result = formatter.format(query);
            
            expect(result.formattedSql).not.toContain('should not appear');
            expect(result.formattedSql).toContain('string_agg');
        });
    });
});
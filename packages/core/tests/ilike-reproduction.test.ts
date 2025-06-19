import { describe, expect, test } from 'vitest';
import { SelectQueryParser } from '../src/parsers/SelectQueryParser';

describe('ILIKE operator support', () => {
    test('parses simple ILIKE query', () => {
        const sql = `SELECT * FROM users WHERE name ILIKE 'john%'`;
        
        expect(() => {
            SelectQueryParser.parse(sql);
        }).not.toThrow();
    });

    test('parses NOT ILIKE query', () => {
        const sql = `SELECT * FROM users WHERE name NOT ILIKE 'john%'`;
        
        expect(() => {
            SelectQueryParser.parse(sql);
        }).not.toThrow();
    });

    test('parses complex ILIKE query from GitHub issue', () => {
        const sql = `
            SELECT 
                u.user_id,
                u.user_name,
                u.email,
                u.created_at
            FROM "user" u
            WHERE 
                u.user_name ILIKE ('%' || :search_term || '%')
            ORDER BY u.user_name
        `;

        expect(() => {
            SelectQueryParser.parse(sql);
        }).not.toThrow();
    });

    test('parses query with both LIKE and ILIKE operators', () => {
        const sql = `
            SELECT * FROM users 
            WHERE name LIKE 'John%' 
            AND email ILIKE '%@example.com'
        `;
        
        expect(() => {
            SelectQueryParser.parse(sql);
        }).not.toThrow();
    });

    test('parses query with ILIKE and NOT ILIKE operators', () => {
        const sql = `
            SELECT * FROM users 
            WHERE name ILIKE 'john%' 
            AND email NOT ILIKE '%spam%'
        `;
        
        expect(() => {
            SelectQueryParser.parse(sql);
        }).not.toThrow();
    });

    test('parses query with SIMILAR TO operator', () => {
        const sql = `SELECT * FROM users WHERE name SIMILAR TO 'J(ohn|ane)%'`;
        
        expect(() => {
            SelectQueryParser.parse(sql);
        }).not.toThrow();
    });

    test('parses query with NOT SIMILAR TO operator', () => {
        const sql = `SELECT * FROM users WHERE name NOT SIMILAR TO 'J(ohn|ane)%'`;
        
        expect(() => {
            SelectQueryParser.parse(sql);
        }).not.toThrow();
    });

    test('parses query with mixed pattern matching operators', () => {
        const sql = `
            SELECT * FROM users 
            WHERE name LIKE 'John%' 
            AND email ILIKE '%@example.com'
            AND description SIMILAR TO '%(good|great|excellent)%'
        `;
        
        expect(() => {
            SelectQueryParser.parse(sql);
        }).not.toThrow();
    });
});
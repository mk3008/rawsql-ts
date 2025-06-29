import { describe, expect, test } from 'vitest';
import { SelectQueryParser } from '../src/parsers/SelectQueryParser';

describe('SIMILAR TO operator support', () => {
    test('parses SIMILAR TO query', () => {
        const sql = `SELECT * FROM users WHERE name SIMILAR TO 'J(ohn|ane)%'`;
        
        expect(() => {
            SelectQueryParser.parse(sql);
        }).not.toThrow();
    });

    test('parses NOT SIMILAR TO query', () => {
        const sql = `SELECT * FROM users WHERE name NOT SIMILAR TO 'J(ohn|ane)%'`;
        
        expect(() => {
            SelectQueryParser.parse(sql);
        }).not.toThrow();
    });
});
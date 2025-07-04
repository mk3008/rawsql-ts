import { describe, expect, test } from 'vitest';
import { ValueParser } from '../../src/parsers/ValueParser';
import { Formatter } from '../../src/transformers/Formatter';

describe('PostgreSQL Dollar-Quoted Strings (Failing Tests)', () => {
    const formatter = new Formatter();
    
    test('basic dollar string should parse correctly', () => {
        const value = ValueParser.parse("$$hello world$$");
        const sql = formatter.format(value);
        expect(sql).toBe("$$hello world$$");
    });
    
    test('tagged dollar string should parse correctly', () => {
        const value = ValueParser.parse("$tag$content$tag$");
        const sql = formatter.format(value);
        expect(sql).toBe("$tag$content$tag$");
    });
    
    test('empty dollar string should parse correctly', () => {
        const value = ValueParser.parse("$$$$");
        const sql = formatter.format(value);
        expect(sql).toBe("$$$$");
    });
});
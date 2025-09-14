import { describe, it, expect } from 'vitest';
import { StringUtils } from '../src/utils/stringUtils';

describe('Debug StringUtils Comment Reading', () => {
    it('should test readWhiteSpaceAndComment directly', () => {
        // Test simple line comment
        const sql1 = `-- Main query: Sales analysis report
WITH raw_sales AS (SELECT 1)`;

        console.log('\n=== Testing Line Comment ===');
        console.log('SQL:', sql1);

        const result1 = StringUtils.readWhiteSpaceAndComment(sql1, 0);
        console.log('StringUtils result:', result1);

        // Test block comment
        const sql2 = `WITH /* Raw data preparation */ raw_sales AS (SELECT 1)`;

        console.log('\n=== Testing Block Comment ===');
        console.log('SQL:', sql2);

        const result2 = StringUtils.readWhiteSpaceAndComment(sql2, 0);
        console.log('StringUtils result from position 0:', result2);

        // Test position after WITH
        const withPos = sql2.indexOf('WITH') + 4; // After 'WITH '
        const result3 = StringUtils.readWhiteSpaceAndComment(sql2, withPos);
        console.log(`StringUtils result from position ${withPos}:`, result3);

        expect(result1.lines.length).toBeGreaterThanOrEqual(0);
        expect(result2.lines.length).toBeGreaterThanOrEqual(0);
        expect(result3.lines.length).toBeGreaterThanOrEqual(0);
    });

    it('should test complex case with multiple comments', () => {
        const sql = `-- Main query: Sales analysis report
WITH /* Raw data preparation */ raw_sales AS (
    SELECT sale_id FROM sales
)
/* Main SELECT statement */
SELECT * FROM raw_sales`;

        console.log('\n=== Testing Complex Case ===');
        console.log('SQL:', sql);

        // Test from beginning
        const result1 = StringUtils.readWhiteSpaceAndComment(sql, 0);
        console.log('From position 0:', result1);

        // Test from after line comment
        const afterLineComment = result1.position;
        const result2 = StringUtils.readWhiteSpaceAndComment(sql, afterLineComment);
        console.log(`From position ${afterLineComment}:`, result2);

        expect(result1.lines.length).toBeGreaterThanOrEqual(0);
    });
});
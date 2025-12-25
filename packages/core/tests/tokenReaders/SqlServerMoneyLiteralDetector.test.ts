import { describe, it, expect } from 'vitest';
import { looksLikeSqlServerMoneyLiteral } from '../../src/tokenReaders/SqlServerMoneyLiteralDetector';

function detectDollarLiteral(input: string): boolean {
    const dollarIndex = input.indexOf('$');
    if (dollarIndex < 0) {
        throw new Error('Test input must contain a $ symbol: ' + input);
    }
    return looksLikeSqlServerMoneyLiteral(input, dollarIndex);
}

describe('SqlServerMoneyLiteralDetector', () => {
    it('accepts comma-formatted dollar amounts', () => {
        expect(detectDollarLiteral('SELECT $1,234 FROM dual')).toBe(true);
        expect(detectDollarLiteral('SELECT $1,234.56')).toBe(true);
        expect(detectDollarLiteral('SELECT $1,234,567')).toBe(true);
        expect(detectDollarLiteral('SELECT $1,234,567.89')).toBe(true);
        expect(detectDollarLiteral('VALUES ($1,234, $2)')).toBe(true); // trailing comma after whitespace
    });

    it('rejects positional parameters that are not formatted as money', () => {
        expect(detectDollarLiteral('VALUES ($1, $2)')).toBe(false);
        expect(detectDollarLiteral('VALUES ($1,23)')).toBe(false);
        expect(detectDollarLiteral('VALUES ($1,234,56)')).toBe(false);
        expect(detectDollarLiteral('SELECT $1, 234')).toBe(false);
        expect(detectDollarLiteral('SELECT $1')).toBe(false);
    });
});

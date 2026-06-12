import { describe, it, expect } from 'vitest';
import { resolveIndentCharOption, resolveNewlineOption, resolveIdentifierEscapeOption } from '../../src/transformers/FormatOptionResolver';
import { SqlFormatter } from '../../src/transformers/SqlFormatter';
import { SelectQueryParser } from '../../src/parsers/SelectQueryParser';

describe('FormatOptionResolver', () => {
    it('maps indent logical names to control characters', () => {
        expect(resolveIndentCharOption('space')).toBe(' ');
        expect(resolveIndentCharOption('tab')).toBe('\t');
        expect(resolveIndentCharOption()).toBeUndefined();
    });

    it('leaves literal indent characters untouched for compatibility', () => {
        expect(resolveIndentCharOption(' ')).toBe(' ');
        expect(resolveIndentCharOption('\t')).toBe('\t');
    });

    it('maps newline logical names to control characters', () => {
        expect(resolveNewlineOption('lf')).toBe('\n');
        expect(resolveNewlineOption('crlf')).toBe('\r\n');
        expect(resolveNewlineOption('cr')).toBe('\r');
        expect(resolveNewlineOption()).toBeUndefined();
    });

    it('maps identifier escape logical names to delimiter pairs', () => {
        expect(resolveIdentifierEscapeOption('quote')).toEqual({ start: '"', end: '"', target: 'all' });
        expect(resolveIdentifierEscapeOption('backtick')).toEqual({ start: '`', end: '`', target: 'all' });
        expect(resolveIdentifierEscapeOption('bracket')).toEqual({ start: '[', end: ']', target: 'all' });
        expect(resolveIdentifierEscapeOption('none')).toEqual({ start: '', end: '', target: 'all' });
        expect(resolveIdentifierEscapeOption('quote', 'minimal')).toEqual({ start: '"', end: '"', target: 'minimal' });
        expect(resolveIdentifierEscapeOption('backtick', 'minimal')).toEqual({ start: '`', end: '`', target: 'minimal' });
        expect(resolveIdentifierEscapeOption('none', 'minimal')).toEqual({ start: '', end: '', target: 'minimal' });
    });

    it('returns explicit identifier delimiters unchanged', () => {
        const custom = { start: '<<', end: '>>' };
        expect(resolveIdentifierEscapeOption(custom)).toEqual({ ...custom, target: 'all' });
    });

    it('throws on unknown identifier escape alias', () => {
        expect(() => resolveIdentifierEscapeOption('unknown' as any)).toThrow('Unknown identifierEscape option');
    });
});

describe('SqlFormatter option normalization', () => {
    it('accepts logical names for whitespace and identifier escapes', () => {
        const query = SelectQueryParser.parse('SELECT id, name FROM users');

        // Use logical names to verify they normalize before formatting.
        const formatter = new SqlFormatter({
            indentSize: 2,
            indentChar: 'space',
            newline: 'lf',
            identifierEscape: 'backtick',
            keywordCase: 'upper',
            commaBreak: 'before'
        });

        const { formattedSql } = formatter.format(query);

        // Ensure newline normalization produced LF but not CRLF.
        expect(formattedSql.includes('\r\n')).toBe(false);
        expect(formattedSql.includes('\n')).toBe(true);

        // Ensure identifiers are wrapped with backticks via logical alias.
        expect(formattedSql).toContain('`id`');
        expect(formattedSql).toContain('`users`');
    });

    it('supports minimal identifier escaping', () => {
        const query = SelectQueryParser.parse('SELECT id, "select", "user", "order-detail", "1st" FROM users');

        const formatter = new SqlFormatter({
            identifierEscape: 'quote',
            identifierEscapeTarget: 'minimal',
            keywordCase: 'lower',
            commaBreak: 'before'
        });

        const { formattedSql } = formatter.format(query);

        expect(formattedSql).toContain('id');
        expect(formattedSql).toContain('"select"');
        expect(formattedSql).toContain('"user"');
        expect(formattedSql).toContain('"order-detail"');
        expect(formattedSql).toContain('"1st"');
        expect(formattedSql).toContain(' from users');
    });
});


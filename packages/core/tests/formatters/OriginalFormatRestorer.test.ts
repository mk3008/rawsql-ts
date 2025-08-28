import { describe, it, expect, beforeEach } from 'vitest';
import { OriginalFormatRestorer } from '../../src/formatters/OriginalFormatRestorer';
import { FormattingLexeme } from '../../src/models/FormattingLexeme';

describe('OriginalFormatRestorer', () => {
    let restorer: OriginalFormatRestorer;

    beforeEach(() => {
        restorer = new OriginalFormatRestorer();
    });

    describe('restore', () => {
        it('should restore simple SQL from FormattingLexemes', () => {
            const lexemes: FormattingLexeme[] = [
                {
                    type: 64, // Command
                    value: 'SELECT',
                    comments: [],
                    followingWhitespace: ' ',
                    inlineComments: [],
                    position: { startPosition: 0, endPosition: 6 }
                },
                {
                    type: 1, // Identifier
                    value: 'id',
                    comments: [],
                    followingWhitespace: ' ',
                    inlineComments: [],
                    position: { startPosition: 7, endPosition: 9 }
                },
                {
                    type: 64, // Command
                    value: 'FROM',
                    comments: [],
                    followingWhitespace: ' ',
                    inlineComments: [],
                    position: { startPosition: 10, endPosition: 14 }
                },
                {
                    type: 1, // Identifier
                    value: 'users',
                    comments: [],
                    followingWhitespace: '',
                    inlineComments: [],
                    position: { startPosition: 15, endPosition: 20 }
                }
            ];

            const result = restorer.restore(lexemes);

            expect(result).toBe('SELECT id FROM users');
        });

        it('should handle empty lexemes array', () => {
            const result = restorer.restore([]);
            expect(result).toBe('');
        });
    });

    describe('restoreWithComments', () => {
        it('should restore SQL with comments when includeComments is true', () => {
            const lexemes: FormattingLexeme[] = [
                {
                    type: 64, // Command
                    value: 'SELECT',
                    comments: [],
                    followingWhitespace: ' ',
                    inlineComments: ['user query'],
                    position: { startPosition: 0, endPosition: 6 }
                },
                {
                    type: 1, // Identifier
                    value: 'id',
                    comments: [],
                    followingWhitespace: ' ',
                    inlineComments: [],
                    position: { startPosition: 7, endPosition: 9 }
                },
                {
                    type: 64, // Command
                    value: 'FROM',
                    comments: [],
                    followingWhitespace: ' ',
                    inlineComments: [],
                    position: { startPosition: 10, endPosition: 14 }
                },
                {
                    type: 1, // Identifier
                    value: 'users',
                    comments: [],
                    followingWhitespace: '',
                    inlineComments: [],
                    position: { startPosition: 15, endPosition: 20 }
                }
            ];

            const result = restorer.restoreWithComments(lexemes, true);

            expect(result).toBe('SELECT -- user query id FROM users');
        });

        it('should restore SQL without comments when includeComments is false', () => {
            const lexemes: FormattingLexeme[] = [
                {
                    type: 64, // Command
                    value: 'SELECT',
                    comments: [],
                    followingWhitespace: ' ',
                    inlineComments: ['user query'],
                    position: { startPosition: 0, endPosition: 6 }
                },
                {
                    type: 1, // Identifier
                    value: 'id',
                    comments: [],
                    followingWhitespace: '',
                    inlineComments: [],
                    position: { startPosition: 7, endPosition: 9 }
                }
            ];

            const result = restorer.restoreWithComments(lexemes, false);

            expect(result).toBe('SELECT id');
        });
    });

    describe('analyzeFormatting', () => {
        it('should analyze formatting patterns', () => {
            const lexemes: FormattingLexeme[] = [
                {
                    type: 64,
                    value: 'SELECT',
                    comments: [],
                    followingWhitespace: '\n  ',
                    inlineComments: ['comment1'],
                    position: { startPosition: 0, endPosition: 6 }
                },
                {
                    type: 1,
                    value: 'id',
                    comments: [],
                    followingWhitespace: '\n',
                    inlineComments: ['comment2'],
                    position: { startPosition: 7, endPosition: 9 }
                }
            ];

            const analysis = restorer.analyzeFormatting(lexemes);

            expect(analysis.totalComments).toBe(2);
            expect(analysis.indentationStyle).toBe('spaces');
            expect(analysis.totalWhitespace).toBeGreaterThan(0);
        });
    });

    describe('validateFormattingLexemes', () => {
        it('should validate properly formatted lexemes', () => {
            const lexemes: FormattingLexeme[] = [
                {
                    type: 64,
                    value: 'SELECT',
                    comments: [],
                    followingWhitespace: ' ',
                    inlineComments: [],
                    position: { startPosition: 0, endPosition: 6 }
                }
            ];

            const validation = restorer.validateFormattingLexemes(lexemes);

            expect(validation.isValid).toBe(true);
            expect(validation.issues).toHaveLength(0);
        });

        it('should detect missing position information', () => {
            const lexemes: FormattingLexeme[] = [
                {
                    type: 64,
                    value: 'SELECT',
                    comments: [],
                    followingWhitespace: ' ',
                    inlineComments: [],
                    position: undefined as any
                }
            ];

            const validation = restorer.validateFormattingLexemes(lexemes);

            expect(validation.isValid).toBe(false);
            expect(validation.issues).toContain('Lexeme 0 missing position information');
        });
    });
});

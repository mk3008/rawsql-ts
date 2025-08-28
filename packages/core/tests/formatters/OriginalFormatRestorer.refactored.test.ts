import { describe, it, expect, beforeEach } from 'vitest';
import { OriginalFormatRestorer } from '../../src/formatters/OriginalFormatRestorer';
import { FormattingLexeme } from '../../src/models/FormattingLexeme';
import { TokenType } from '../../src/models/Lexeme';

describe('OriginalFormatRestorer - Refactored Responsibilities', () => {
    let restorer: OriginalFormatRestorer;

    beforeEach(() => {
        restorer = new OriginalFormatRestorer();
    });

    describe('restore', () => {
        it('should restore SQL from FormattingLexemes preserving whitespace', () => {
            const lexemes: FormattingLexeme[] = [
                {
                    type: TokenType.Command,
                    value: 'SELECT',
                    comments: null,
                    followingWhitespace: ' ',
                    inlineComments: [],
                    position: {
                        startPosition: 0,
                        endPosition: 6,
                        startLine: 1,
                        startColumn: 1,
                        endLine: 1,
                        endColumn: 7
                    }
                },
                {
                    type: TokenType.Identifier,
                    value: 'id',
                    comments: null,
                    followingWhitespace: '\n',
                    inlineComments: [],
                    position: {
                        startPosition: 7,
                        endPosition: 9,
                        startLine: 1,
                        startColumn: 8,
                        endLine: 1,
                        endColumn: 10
                    }
                },
                {
                    type: TokenType.Command,
                    value: 'FROM',
                    comments: null,
                    followingWhitespace: ' ',
                    inlineComments: [],
                    position: {
                        startPosition: 10,
                        endPosition: 14,
                        startLine: 2,
                        startColumn: 1,
                        endLine: 2,
                        endColumn: 5
                    }
                },
                {
                    type: TokenType.Identifier,
                    value: 'users',
                    comments: null,
                    followingWhitespace: '',
                    inlineComments: [],
                    position: {
                        startPosition: 15,
                        endPosition: 20,
                        startLine: 2,
                        startColumn: 6,
                        endLine: 2,
                        endColumn: 11
                    }
                }
            ];

            const result = restorer.restore(lexemes);
            
            expect(result).toBe('SELECT id\nFROM users');
        });

        it('should return empty string for empty lexeme array', () => {
            const result = restorer.restore([]);
            
            expect(result).toBe('');
        });

        it('should handle complex indentation and whitespace', () => {
            const lexemes: FormattingLexeme[] = [
                {
                    type: TokenType.Command,
                    value: 'SELECT',
                    comments: null,
                    followingWhitespace: '\n    ',
                    inlineComments: [],
                    position: {
                        startPosition: 0,
                        endPosition: 6,
                        startLine: 1,
                        startColumn: 1,
                        endLine: 1,
                        endColumn: 7
                    }
                },
                {
                    type: TokenType.Identifier,
                    value: 'id',
                    comments: null,
                    followingWhitespace: ',\n    ',
                    inlineComments: [],
                    position: {
                        startPosition: 11,
                        endPosition: 13,
                        startLine: 2,
                        startColumn: 5,
                        endLine: 2,
                        endColumn: 7
                    }
                },
                {
                    type: TokenType.Identifier,
                    value: 'name',
                    comments: null,
                    followingWhitespace: '\nFROM users',
                    inlineComments: [],
                    position: {
                        startPosition: 19,
                        endPosition: 23,
                        startLine: 3,
                        startColumn: 5,
                        endLine: 3,
                        endColumn: 9
                    }
                }
            ];

            const result = restorer.restore(lexemes);
            
            expect(result).toBe('SELECT\n    id,\n    name\nFROM users');
        });
    });

    describe('restoreWithComments', () => {
        it('should restore SQL with inline comments preserved', () => {
            const lexemes: FormattingLexeme[] = [
                {
                    type: TokenType.Command,
                    value: 'SELECT',
                    comments: null,
                    followingWhitespace: ' ',
                    inlineComments: ['Query starts here'],
                    position: {
                        startPosition: 0,
                        endPosition: 6,
                        startLine: 1,
                        startColumn: 1,
                        endLine: 1,
                        endColumn: 7
                    }
                },
                {
                    type: TokenType.Identifier,
                    value: 'id',
                    comments: null,
                    followingWhitespace: ' ',
                    inlineComments: ['Primary key'],
                    position: {
                        startPosition: 7,
                        endPosition: 9,
                        startLine: 1,
                        startColumn: 8,
                        endLine: 1,
                        endColumn: 10
                    }
                },
                {
                    type: TokenType.Command,
                    value: 'FROM',
                    comments: null,
                    followingWhitespace: ' ',
                    inlineComments: [],
                    position: {
                        startPosition: 10,
                        endPosition: 14,
                        startLine: 1,
                        startColumn: 11,
                        endLine: 1,
                        endColumn: 15
                    }
                },
                {
                    type: TokenType.Identifier,
                    value: 'users',
                    comments: null,
                    followingWhitespace: '',
                    inlineComments: [],
                    position: {
                        startPosition: 15,
                        endPosition: 20,
                        startLine: 1,
                        startColumn: 16,
                        endLine: 1,
                        endColumn: 21
                    }
                }
            ];

            const result = restorer.restoreWithComments(lexemes, true);
            
            expect(result).toContain('SELECT -- Query starts here');
            expect(result).toContain('id -- Primary key');
            expect(result).toContain('FROM users');
        });

        it('should exclude comments when includeComments is false', () => {
            const lexemes: FormattingLexeme[] = [
                {
                    type: TokenType.Command,
                    value: 'SELECT',
                    comments: null,
                    followingWhitespace: ' ',
                    inlineComments: ['This comment should not appear'],
                    position: {
                        startPosition: 0,
                        endPosition: 6,
                        startLine: 1,
                        startColumn: 1,
                        endLine: 1,
                        endColumn: 7
                    }
                },
                {
                    type: TokenType.Identifier,
                    value: 'id',
                    comments: null,
                    followingWhitespace: '',
                    inlineComments: [],
                    position: {
                        startPosition: 7,
                        endPosition: 9,
                        startLine: 1,
                        startColumn: 8,
                        endLine: 1,
                        endColumn: 10
                    }
                }
            ];

            const result = restorer.restoreWithComments(lexemes, false);
            
            expect(result).toBe('SELECT id');
            expect(result).not.toContain('This comment should not appear');
        });
    });

    describe('analyzeFormatting', () => {
        it('should analyze formatting patterns correctly', () => {
            const lexemes: FormattingLexeme[] = [
                {
                    type: TokenType.Command,
                    value: 'SELECT',
                    comments: null,
                    followingWhitespace: '\n    ',
                    inlineComments: ['Comment 1'],
                    position: {
                        startPosition: 0,
                        endPosition: 6,
                        startLine: 1,
                        startColumn: 1,
                        endLine: 1,
                        endColumn: 7
                    }
                },
                {
                    type: TokenType.Identifier,
                    value: 'id',
                    comments: null,
                    followingWhitespace: '\n    ',
                    inlineComments: ['Comment 2'],
                    position: {
                        startPosition: 11,
                        endPosition: 13,
                        startLine: 2,
                        startColumn: 5,
                        endLine: 2,
                        endColumn: 7
                    }
                }
            ];

            const analysis = restorer.analyzeFormatting(lexemes);
            
            expect(analysis.totalWhitespace).toBe(10); // '\n    ' + '\n    '
            expect(analysis.totalComments).toBe(2);
            expect(analysis.indentationStyle).toBe('spaces');
            expect(analysis.averageIndentSize).toBe(4);
        });

        it('should detect mixed indentation style', () => {
            const lexemes: FormattingLexeme[] = [
                {
                    type: TokenType.Command,
                    value: 'SELECT',
                    comments: null,
                    followingWhitespace: '\n    ', // 4 spaces
                    inlineComments: [],
                    position: {
                        startPosition: 0,
                        endPosition: 6,
                        startLine: 1,
                        startColumn: 1,
                        endLine: 1,
                        endColumn: 7
                    }
                },
                {
                    type: TokenType.Identifier,
                    value: 'id',
                    comments: null,
                    followingWhitespace: '\n\t', // 1 tab
                    inlineComments: [],
                    position: {
                        startPosition: 11,
                        endPosition: 13,
                        startLine: 2,
                        startColumn: 5,
                        endLine: 2,
                        endColumn: 7
                    }
                }
            ];

            const analysis = restorer.analyzeFormatting(lexemes);
            
            expect(analysis.indentationStyle).toBe('mixed');
        });
    });

    describe('validateFormattingLexemes', () => {
        it('should return valid for properly formatted lexemes', () => {
            const lexemes: FormattingLexeme[] = [
                {
                    type: TokenType.Command,
                    value: 'SELECT',
                    comments: null,
                    followingWhitespace: ' ',
                    inlineComments: [],
                    position: {
                        startPosition: 0,
                        endPosition: 6,
                        startLine: 1,
                        startColumn: 1,
                        endLine: 1,
                        endColumn: 7
                    }
                }
            ];

            const validation = restorer.validateFormattingLexemes(lexemes);
            
            expect(validation.isValid).toBe(true);
            expect(validation.issues).toHaveLength(0);
        });

        it('should identify missing properties', () => {
            const lexemes: FormattingLexeme[] = [
                {
                    type: TokenType.Command,
                    value: 'SELECT',
                    comments: null,
                    // Missing followingWhitespace property
                    inlineComments: [],
                    // Missing position property
                } as any
            ];

            const validation = restorer.validateFormattingLexemes(lexemes);
            
            expect(validation.isValid).toBe(false);
            expect(validation.issues.length).toBeGreaterThan(0);
            expect(validation.issues[0]).toContain('missing position information');
            expect(validation.issues[1]).toContain('missing followingWhitespace property');
        });

        it('should identify invalid position ranges', () => {
            const lexemes: FormattingLexeme[] = [
                {
                    type: TokenType.Command,
                    value: 'SELECT',
                    comments: null,
                    followingWhitespace: ' ',
                    inlineComments: [],
                    position: {
                        startPosition: 10,
                        endPosition: 5, // End before start - invalid
                        startLine: 1,
                        startColumn: 1,
                        endLine: 1,
                        endColumn: 7
                    }
                }
            ];

            const validation = restorer.validateFormattingLexemes(lexemes);
            
            expect(validation.isValid).toBe(false);
            expect(validation.issues).toContain('Lexeme 0 has invalid position range');
        });
    });
});
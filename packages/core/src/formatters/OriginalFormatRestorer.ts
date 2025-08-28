import { FormattingLexeme } from '../models/FormattingLexeme';

/**
 * Restores SQL strings from FormattingLexeme arrays while preserving original formatting
 * This class handles the restoration of SQL text with exact whitespace, comments, and indentation
 */
export class OriginalFormatRestorer {
    
    /**
     * Restores SQL string from FormattingLexeme array preserving original formatting
     * @param lexemes Array of FormattingLexeme with formatting information
     * @returns Restored SQL string with original formatting preserved
     */
    public restore(lexemes: FormattingLexeme[]): string {
        if (lexemes.length === 0) {
            return '';
        }

        let result = '';
        
        for (const lexeme of lexemes) {
            // Add the lexeme value
            result += lexeme.value;
            
            // Add any following whitespace (spaces, tabs, newlines)
            if (lexeme.followingWhitespace) {
                result += lexeme.followingWhitespace;
            }
        }

        return result;
    }

    /**
     * Restores SQL with inline comments preserved at their original positions
     * @param lexemes Array of FormattingLexeme with formatting information
     * @param includeComments Whether to include inline comments in output
     * @returns Restored SQL string
     */
    public restoreWithComments(lexemes: FormattingLexeme[], includeComments: boolean = true): string {
        if (lexemes.length === 0) {
            return '';
        }

        let result = '';
        
        for (const lexeme of lexemes) {
            // Add the lexeme value
            result += lexeme.value;
            
            // Add inline comments if requested
            if (includeComments && lexeme.inlineComments && lexeme.inlineComments.length > 0) {
                for (const comment of lexeme.inlineComments) {
                    // Add comments with appropriate formatting
                    if (comment.trim().length > 0) {
                        result += ` -- ${comment}`;
                    }
                }
            }
            
            // Add any following whitespace
            if (lexeme.followingWhitespace) {
                result += lexeme.followingWhitespace;
            }
        }

        return result;
    }

    /**
     * Extracts formatting patterns from FormattingLexemes for analysis
     * @param lexemes Array of FormattingLexeme
     * @returns Object containing formatting statistics
     */
    public analyzeFormatting(lexemes: FormattingLexeme[]): {
        totalWhitespace: number;
        totalComments: number;
        indentationStyle: 'spaces' | 'tabs' | 'mixed' | 'none';
        averageIndentSize: number;
    } {
        let totalWhitespace = 0;
        let totalComments = 0;
        let spaceCount = 0;
        let tabCount = 0;
        let indentLines = 0;
        let totalIndentSize = 0;

        for (const lexeme of lexemes) {
            if (lexeme.followingWhitespace) {
                totalWhitespace += lexeme.followingWhitespace.length;
                
                // Analyze indentation
                const lines = lexeme.followingWhitespace.split('\n');
                for (let i = 1; i < lines.length; i++) { // Skip first line
                    const line = lines[i];
                    const leadingSpaces = line.match(/^ */)?.[0].length || 0;
                    const leadingTabs = line.match(/^\t*/)?.[0].length || 0;
                    
                    if (leadingSpaces > 0 || leadingTabs > 0) {
                        indentLines++;
                        totalIndentSize += leadingSpaces + (leadingTabs * 4); // Count tabs as 4 spaces
                        spaceCount += leadingSpaces;
                        tabCount += leadingTabs;
                    }
                }
            }
            
            if (lexeme.inlineComments) {
                totalComments += lexeme.inlineComments.length;
            }
        }

        let indentationStyle: 'spaces' | 'tabs' | 'mixed' | 'none' = 'none';
        if (spaceCount > 0 && tabCount > 0) {
            indentationStyle = 'mixed';
        } else if (spaceCount > 0) {
            indentationStyle = 'spaces';
        } else if (tabCount > 0) {
            indentationStyle = 'tabs';
        }

        return {
            totalWhitespace,
            totalComments,
            indentationStyle,
            averageIndentSize: indentLines > 0 ? totalIndentSize / indentLines : 0
        };
    }

    /**
     * Validates that lexemes contain proper formatting information
     * @param lexemes Array of FormattingLexeme to validate
     * @returns Validation result with details
     */
    public validateFormattingLexemes(lexemes: FormattingLexeme[]): {
        isValid: boolean;
        issues: string[];
    } {
        const issues: string[] = [];

        for (let i = 0; i < lexemes.length; i++) {
            const lexeme = lexemes[i];
            
            if (!lexeme.position) {
                issues.push(`Lexeme ${i} missing position information`);
            }
            
            if (lexeme.followingWhitespace === undefined) {
                issues.push(`Lexeme ${i} missing followingWhitespace property`);
            }
            
            if (lexeme.inlineComments === undefined) {
                issues.push(`Lexeme ${i} missing inlineComments property`);
            }
            
            if (lexeme.position && lexeme.position.startPosition >= lexeme.position.endPosition) {
                issues.push(`Lexeme ${i} has invalid position range`);
            }
        }

        return {
            isValid: issues.length === 0,
            issues
        };
    }
}
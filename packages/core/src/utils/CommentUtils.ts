import { Lexeme } from "../models/Lexeme";

/**
 * Utility functions for handling comments in parsers
 */
export class CommentUtils {
    /**
     * Collects comments from preceding tokens that are associated with a specific keyword.
     * This function looks for comments in tokens before the current position that might
     * be related to the current clause.
     * 
     * @param lexemes Array of lexemes
     * @param currentIndex Index of the current keyword token
     * @param keywordValue Expected keyword value (e.g., 'from', 'where')
     * @returns Array of comments associated with this clause
     */
    public static collectClauseComments(lexemes: Lexeme[], currentIndex: number, keywordValue: string): string[] | null {
        if (currentIndex >= lexemes.length || lexemes[currentIndex].value.toLowerCase() !== keywordValue.toLowerCase()) {
            return null;
        }

        const comments: string[] = [];
        
        // Collect comments from the keyword token itself
        if (lexemes[currentIndex].comments) {
            comments.push(...lexemes[currentIndex].comments);
        }

        // Look backwards for comments that might be associated with this clause
        // We'll look at the previous token to see if it has comments that should belong to this clause
        let checkIndex = currentIndex - 1;
        while (checkIndex >= 0) {
            const prevToken = lexemes[checkIndex];
            
            // If the previous token has comments and it's not a significant SQL token,
            // those comments might belong to the current clause
            if (prevToken.comments && prevToken.comments.length > 0) {
                // Check if the comments contain keywords that suggest they belong to the current clause
                const clauseSpecificComments = prevToken.comments.filter(comment => {
                    const lowerComment = comment.toLowerCase();
                    return lowerComment.includes(keywordValue.toLowerCase()) || 
                           lowerComment.includes('の') || // Japanese possessive particle
                           lowerComment.includes('コメント'); // "comment" in Japanese
                });
                
                if (clauseSpecificComments.length > 0) {
                    comments.unshift(...clauseSpecificComments);
                    // Remove these comments from the previous token to avoid duplication
                    prevToken.comments = prevToken.comments.filter(c => !clauseSpecificComments.includes(c));
                    if (prevToken.comments.length === 0) {
                        prevToken.comments = null;
                    }
                }
                break; // Stop after checking one token with comments
            }
            
            // Stop if we encounter another significant SQL keyword
            if (this.isSignificantSqlKeyword(prevToken.value)) {
                break;
            }
            
            checkIndex--;
        }

        return comments.length > 0 ? comments : null;
    }

    /**
     * Checks if a token value is a significant SQL keyword that would separate clauses
     */
    private static isSignificantSqlKeyword(value: string): boolean {
        const keywords = new Set(['select', 'from', 'where', 'group by', 'having', 'order by', 'limit', 'offset']);
        return keywords.has(value.toLowerCase());
    }
}
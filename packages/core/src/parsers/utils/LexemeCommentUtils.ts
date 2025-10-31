import { Lexeme } from "../../models/Lexeme";

export interface ExtractedLexemeComments {
    before: string[];
    after: string[];
}

// Extracts positioned comments from a lexeme while preserving order and duplicates.
export function extractLexemeComments(lexeme: Lexeme | undefined): ExtractedLexemeComments {
    const before: string[] = [];
    const after: string[] = [];

    if (!lexeme) {
        return { before, after };
    }

    if (lexeme.positionedComments && lexeme.positionedComments.length > 0) {
        for (const positioned of lexeme.positionedComments) {
            if (!positioned.comments || positioned.comments.length === 0) {
                continue;
            }

            if (positioned.position === "before") {
                before.push(...positioned.comments);
            } else if (positioned.position === "after") {
                after.push(...positioned.comments);
            }
        }
    } else if (lexeme.comments && lexeme.comments.length > 0) {
        before.push(...lexeme.comments);
    }

    return { before, after };
}

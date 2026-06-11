import { JoinOnClause } from "../models/Clause";
import { Lexeme } from "../models/Lexeme";
import { ValueParser } from "./ValueParser";

export class JoinOnClauseParser {
    public static tryParse(lexemes: Lexeme[], index: number): { value: JoinOnClause; newIndex: number } | null {
        let idx = index;
        if (idx < lexemes.length && lexemes[idx].value === 'on') {
            const onKeywordComments = lexemes[idx].positionedComments;
            idx++; // Skip 'on' keyword
            // Parse the condition expression
            const condition = ValueParser.parseFromLexeme(lexemes, idx);
            const afterKeywordComments = onKeywordComments
                ?.filter(comment => comment.position === 'after')
                .flatMap(comment => comment.comments) ?? [];
            if (afterKeywordComments.length > 0) {
                condition.value.addPositionedComments('before', afterKeywordComments);
            }
            idx = condition.newIndex;
            const joinOn = new JoinOnClause(condition.value);
            return { value: joinOn, newIndex: idx };
        }
        return null;
    }
}

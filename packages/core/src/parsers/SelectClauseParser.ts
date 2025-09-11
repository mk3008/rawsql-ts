import { Distinct, DistinctComponent, DistinctOn, SelectClause, SelectItem } from "../models/Clause";
import { Lexeme, TokenType } from "../models/Lexeme";
import { ColumnReference } from "../models/ValueComponent";
import { SqlTokenizer } from "./SqlTokenizer";
import { ValueParser } from "./ValueParser";
import { HintClause } from "../models/HintClause";

export class SelectClauseParser {
    // Parse SQL string to AST (was: parse)
    public static parse(query: string): SelectClause {
        const tokenizer = new SqlTokenizer(query); // Initialize tokenizer
        const lexemes = tokenizer.readLexmes(); // Get tokens

        // Parse
        const result = this.parseFromLexeme(lexemes, 0);

        // Error if there are remaining tokens
        if (result.newIndex < lexemes.length) {
            throw new Error(`Syntax error: Unexpected token "${lexemes[result.newIndex].value}" at position ${result.newIndex}. The SELECT clause is complete but there are additional tokens.`);
        }

        return result.value;
    }

    // Parse from lexeme array (was: parse)
    public static parseFromLexeme(lexemes: Lexeme[], index: number): { value: SelectClause; newIndex: number } {
        let idx = index;
        let distinct: DistinctComponent | null = null;

        // Capture comments from the SELECT token
        const selectTokenComments = idx < lexemes.length ? lexemes[idx].comments : null;

        if (lexemes[idx].value !== 'select') {
            throw new Error(`Syntax error at position ${idx}: Expected 'SELECT' keyword but found "${lexemes[idx].value}". SELECT clauses must start with the SELECT keyword.`);
        }
        idx++;

        // Parse hint clauses (/*+ hint */) after SELECT
        const hints: HintClause[] = [];
        while (idx < lexemes.length && HintClause.isHintClause(lexemes[idx].value)) {
            const hintContent = HintClause.extractHintContent(lexemes[idx].value);
            hints.push(new HintClause(hintContent));
            idx++;
        }

        if (idx < lexemes.length && lexemes[idx].value === 'distinct') {
            idx++;
            distinct = new Distinct();
        } else if (idx < lexemes.length && lexemes[idx].value === 'distinct on') {
            idx++;
            const argument = ValueParser.parseArgument(TokenType.OpenParen, TokenType.CloseParen, lexemes, idx);
            distinct = new DistinctOn(argument.value);
            idx = argument.newIndex;
        }

        const items: SelectItem[] = [];
        const item = SelectItemParser.parseItem(lexemes, idx);
        items.push(item.value);
        idx = item.newIndex;

        while (idx < lexemes.length && (lexemes[idx].type & TokenType.Comma)) {
            idx++;
            const item = SelectItemParser.parseItem(lexemes, idx);
            items.push(item.value);
            idx = item.newIndex;
        }

        if (items.length === 0) {
            throw new Error(`Syntax error at position ${index}: No select items found. The SELECT clause requires at least one expression to select.`);
        } else {
            const clause = new SelectClause(items, distinct, hints);
            // Set comments from the SELECT token to the clause
            clause.comments = selectTokenComments;
            return { value: clause, newIndex: idx };
        }
    }

}

// Extracted SelectItemParser for parsing individual select items
export class SelectItemParser {
    /**
     * Parses a single select item from a SQL string.
     * @param query The SQL string representing a select item (e.g. 'id as user_id').
     * @returns The parsed SelectItem instance.
     */
    public static parse(query: string): SelectItem {
        const tokenizer = new SqlTokenizer(query);
        const lexemes = tokenizer.readLexmes();
        const result = this.parseItem(lexemes, 0);
        if (result.newIndex < lexemes.length) {
            throw new Error(`Syntax error: Unexpected token "${lexemes[result.newIndex].value}" at position ${result.newIndex}. The select item is complete but there are additional tokens.`);
        }
        return result.value;
    }

    /**
     * Parses a single select item from lexemes.
     * @param lexemes The array of lexemes.
     * @param index The starting index.
     * @returns An object containing the SelectItem and the new index.
     */
    public static parseItem(lexemes: Lexeme[], index: number): { value: SelectItem; newIndex: number } {
        let idx = index;
        
        // Capture positioned comments from the value token (column/expression)
        let valueTokenPositionedComments: { position: 'before' | 'after'; comments: string[] }[] = [];
        if (idx < lexemes.length && lexemes[idx].positionedComments) {
            valueTokenPositionedComments = lexemes[idx].positionedComments || [];
        }
        
        const parsedValue = ValueParser.parseFromLexeme(lexemes, idx);
        const value = parsedValue.value;
        idx = parsedValue.newIndex;

        let asKeywordComments: string[] | null = null;
        if (idx < lexemes.length && lexemes[idx].value === 'as') {
            // Capture comments from 'AS' keyword before skipping
            asKeywordComments = lexemes[idx].comments;
            idx++;
        }

        if (idx < lexemes.length && (lexemes[idx].type & TokenType.Identifier)) {
            const alias = lexemes[idx].value;
            const aliasComments = lexemes[idx].comments; // Capture comments from alias token
            idx++;
            const selectItem = new SelectItem(value, alias);
            
            // Store positioned comments properly for correct formatting
            // Add positioned comments from value token (before/after the column)
            if (valueTokenPositionedComments.length > 0) {
                for (const posComment of valueTokenPositionedComments) {
                    selectItem.addPositionedComments(posComment.position, posComment.comments);
                }
                // Clear both positioned and legacy comments from the value to avoid duplication
                if ('positionedComments' in selectItem.value) {
                    (selectItem.value as any).positionedComments = null;
                }
                selectItem.value.comments = null;
                
                // Also clear positioned comments from nested IdentifierString (in QualifiedName)
                if (selectItem.value.constructor.name === 'ColumnReference') {
                    const columnRef = selectItem.value as any;
                    if (columnRef.qualifiedName && columnRef.qualifiedName.name) {
                        columnRef.qualifiedName.name.positionedComments = null;
                        columnRef.qualifiedName.name.comments = null;
                    }
                }
            }
            
            // Store AS keyword comments and alias comments separately for proper positioning
            if (asKeywordComments && asKeywordComments.length > 0) {
                (selectItem as any).asKeywordComments = asKeywordComments;
            }
            
            if (aliasComments && aliasComments.length > 0) {
                (selectItem as any).aliasComments = aliasComments;
            }
            
            return {
                value: selectItem,
                newIndex: idx,
            };
        } else if (value instanceof ColumnReference && value.column.name !== "*") {
            // nameless select item
            const selectItem = new SelectItem(value, value.column.name);
            
            // Store positioned comments properly for correct formatting
            // Add positioned comments from value token (before/after the column)
            if (valueTokenPositionedComments.length > 0) {
                for (const posComment of valueTokenPositionedComments) {
                    selectItem.addPositionedComments(posComment.position, posComment.comments);
                }
                // Clear both positioned and legacy comments from the value to avoid duplication
                if ('positionedComments' in selectItem.value) {
                    (selectItem.value as any).positionedComments = null;
                }
                selectItem.value.comments = null;
                
                // Also clear positioned comments from nested IdentifierString (in QualifiedName)
                if (selectItem.value.constructor.name === 'ColumnReference') {
                    const columnRef = selectItem.value as any;
                    if (columnRef.qualifiedName && columnRef.qualifiedName.name) {
                        columnRef.qualifiedName.name.positionedComments = null;
                        columnRef.qualifiedName.name.comments = null;
                    }
                }
            }
            
            // Add AS keyword comments (after the AS keyword)
            if (asKeywordComments && asKeywordComments.length > 0) {
                selectItem.addPositionedComments('after', asKeywordComments);
            }
            return {
                value: selectItem,
                newIndex: idx,
            };
        }
        // nameless select item
        const selectItem = new SelectItem(value);
        
        // Add positioned comments from value token
        if (valueTokenPositionedComments.length > 0) {
            for (const posComment of valueTokenPositionedComments) {
                selectItem.addPositionedComments(posComment.position, posComment.comments);
            }
        }
        
        if (asKeywordComments && asKeywordComments.length > 0) {
            selectItem.addPositionedComments('after', asKeywordComments);
        }
        return {
            value: selectItem,
            newIndex: idx,
        };
    }
}